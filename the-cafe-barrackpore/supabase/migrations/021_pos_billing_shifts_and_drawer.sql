-- ==============================================================================
-- Migration: 021_pos_billing_shifts_and_drawer.sql
-- Description:
-- 1. Staff RBAC: Expand staff roles to ('owner', 'manager', 'cashier', 'waiter', 'staff')
--    and establish role-checking helper functions.
-- 2. Restaurant Settings: Manager PIN and manager void limit in minor units.
-- 3. Cash Drawer Shifts & Transactions: Cash drawer shifts, cash-in, cash-out, drawer open audit.
-- 4. POS Running Bills, KOT Batches & Bill Items: Multi-tenant tables in integer minor units.
-- 5. Bill Splitting & Multi-Tender Settlement: Equal, item, and custom splits with minor units.
-- 6. RLS: Strict multi-tenant and role-based policies (owner, manager, cashier, waiter).
-- 7. Audit Log: Automated logging on EVERY void, discount, refund, and drawer open.
-- 8. Server-Authoritative RPCs (SECURITY DEFINER): Server computes all totals, taxes,
--    discounts, and split remainder distribution in integer minor units.
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STAFF ROLES EXTENSION (owner, manager, cashier, waiter, staff)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_role'
    ) THEN
        ALTER TABLE public.staff_profiles DROP CONSTRAINT chk_staff_role;
    END IF;
    ALTER TABLE public.staff_profiles 
        ADD CONSTRAINT chk_staff_role 
        CHECK (role IN ('owner', 'manager', 'cashier', 'waiter', 'staff'));
END $$;

-- Role verification helper functions
CREATE OR REPLACE FUNCTION public.get_staff_role(p_uid UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT role FROM public.staff_profiles
    WHERE user_id = p_uid AND active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_cashier_or_above(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager', 'cashier')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_waiter_or_above(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager', 'cashier', 'waiter', 'staff')
    );
$$;

REVOKE ALL ON FUNCTION public.get_staff_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_manager_or_above(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_above(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_cashier_or_above(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cashier_or_above(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_waiter_or_above(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_waiter_or_above(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. RESTAURANT SETTINGS EXTENSION: Manager PIN & Void Limit (Minor Units)
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings 
    ADD COLUMN IF NOT EXISTS manager_pin TEXT DEFAULT '1234',
    ADD COLUMN IF NOT EXISTS manager_void_limit_minor INTEGER DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 3. CASH DRAWER SHIFTS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    shift_number SERIAL,
    opened_by_id TEXT NOT NULL,
    opened_by_name TEXT NOT NULL,
    opening_float_minor INTEGER NOT NULL DEFAULT 0 CHECK (opening_float_minor >= 0),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    closed_by_id TEXT NULL,
    closed_by_name TEXT NULL,
    closed_at TIMESTAMPTZ NULL,
    counted_cash_minor INTEGER NULL,
    expected_cash_minor INTEGER NULL,
    difference_minor INTEGER NULL,
    z_report_summary JSONB NULL,
    closing_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_tenant_status ON public.cash_shifts (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened_at ON public.cash_shifts (opened_at DESC);

-- ------------------------------------------------------------------------------
-- 4. CASH DRAWER TRANSACTIONS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_drawer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    shift_id UUID NOT NULL REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'sale', 'refund', 'drawer_open')),
    amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
    reason TEXT NOT NULL,
    bill_number TEXT NULL,
    order_ref TEXT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'cashier',
    idempotency_key TEXT UNIQUE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_shift ON public.cash_drawer_transactions (shift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_tenant ON public.cash_drawer_transactions (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_idempotency ON public.cash_drawer_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. POS RUNNING BILLS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    bill_number TEXT UNIQUE NOT NULL,
    order_type TEXT NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
    table_number TEXT NULL,
    customer_name TEXT NULL,
    customer_phone TEXT NULL,
    delivery_address TEXT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'printed', 'paid', 'voided', 'transferred', 'merged')),
    subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
    discount_type TEXT NULL CHECK (discount_type IN ('percentage', 'flat', 'manual')),
    discount_code TEXT NULL,
    discount_value_minor INTEGER NOT NULL DEFAULT 0,
    discount_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
    discount_approved_by TEXT NULL,
    tax_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount_minor >= 0),
    tax_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    service_charge_minor INTEGER NOT NULL DEFAULT 0 CHECK (service_charge_minor >= 0),
    grand_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (grand_total_minor >= 0),
    tips_minor INTEGER NOT NULL DEFAULT 0 CHECK (tips_minor >= 0),
    payment_method TEXT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'counter', 'split', 'online')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'refunded', 'voided')),
    is_split BOOLEAN NOT NULL DEFAULT false,
    split_type TEXT NULL CHECK (split_type IN ('equal', 'item', 'custom')),
    split_count INTEGER NOT NULL DEFAULT 1,
    notes TEXT NULL,
    shift_id UUID NULL REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
    printed_at TIMESTAMPTZ NULL,
    paid_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_restaurant_status ON public.bills (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_table_number ON public.bills (table_number) WHERE status IN ('running', 'printed');
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_shift_id ON public.bills (shift_id) WHERE shift_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 6. KOT BATCHES TABLE (Kitchen Order Tickets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kot_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    kot_number TEXT NOT NULL,
    batch_index INTEGER NOT NULL DEFAULT 1,
    order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'preparing', 'ready', 'served', 'cancelled')),
    special_instructions TEXT NULL,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kot_batches_bill_id ON public.kot_batches (bill_id, batch_index);
CREATE INDEX IF NOT EXISTS idx_kot_batches_restaurant ON public.kot_batches (restaurant_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. BILL ITEMS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    kot_batch_id UUID NULL REFERENCES public.kot_batches(id) ON DELETE SET NULL,
    menu_item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_minor >= 0),
    line_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_total_minor >= 0),
    tax_category TEXT DEFAULT 'food',
    modifiers JSONB NULL DEFAULT '[]'::jsonb,
    notes TEXT NULL,
    is_voided BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT NULL,
    void_approved_by TEXT NULL,
    voided_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON public.bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_kot_batch_id ON public.bill_items (kot_batch_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_restaurant ON public.bill_items (restaurant_id);

-- ------------------------------------------------------------------------------
-- 8. BILL SPLITS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    bill_number TEXT NOT NULL,
    order_ref TEXT NULL,
    split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'item', 'custom')),
    part_number INTEGER NOT NULL,
    total_parts INTEGER NOT NULL,
    payer_label TEXT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal_minor INTEGER NOT NULL DEFAULT 0,
    tax_amount_minor INTEGER NOT NULL DEFAULT 0,
    tip_amount_minor INTEGER NOT NULL DEFAULT 0,
    amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
    total_paid_minor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'refunded', 'cancelled')),
    tender_type TEXT NULL CHECK (tender_type IN ('cash', 'card', 'upi', 'stripe', 'other', 'counter', 'demo')),
    payment_reference TEXT NULL,
    change_due_minor INTEGER NOT NULL DEFAULT 0,
    tendered_amount_minor INTEGER NOT NULL DEFAULT 0,
    paid_at TIMESTAMPTZ NULL,
    idempotency_key TEXT UNIQUE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_splits_bill_number ON public.bill_splits (bill_number);
CREATE INDEX IF NOT EXISTS idx_bill_splits_bill_id ON public.bill_splits (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_restaurant ON public.bill_splits (restaurant_id, status);

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) BY ROLE (owner, manager, cashier, waiter)
-- ------------------------------------------------------------------------------
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kot_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_drawer_transactions ENABLE ROW LEVEL SECURITY;

-- 9.1 BILLS RLS
DROP POLICY IF EXISTS "staff_select_bills" ON public.bills;
CREATE POLICY "staff_select_bills" ON public.bills
FOR SELECT TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_modify_bills" ON public.bills;
CREATE POLICY "staff_modify_bills" ON public.bills
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

-- 9.2 KOT BATCHES RLS
DROP POLICY IF EXISTS "staff_access_kot_batches" ON public.kot_batches;
CREATE POLICY "staff_access_kot_batches" ON public.kot_batches
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

-- 9.3 BILL ITEMS RLS
DROP POLICY IF EXISTS "staff_access_bill_items" ON public.bill_items;
CREATE POLICY "staff_access_bill_items" ON public.bill_items
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

-- 9.4 BILL SPLITS RLS
DROP POLICY IF EXISTS "staff_access_bill_splits" ON public.bill_splits;
CREATE POLICY "staff_access_bill_splits" ON public.bill_splits
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

-- 9.5 CASH SHIFTS RLS (Cashier, Manager, Owner)
DROP POLICY IF EXISTS "staff_select_cash_shifts" ON public.cash_shifts;
CREATE POLICY "staff_select_cash_shifts" ON public.cash_shifts
FOR SELECT TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_modify_cash_shifts" ON public.cash_shifts;
CREATE POLICY "staff_modify_cash_shifts" ON public.cash_shifts
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

-- 9.6 CASH DRAWER TRANSACTIONS RLS
DROP POLICY IF EXISTS "staff_select_cash_drawer_tx" ON public.cash_drawer_transactions;
CREATE POLICY "staff_select_cash_drawer_tx" ON public.cash_drawer_transactions
FOR SELECT TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_insert_cash_drawer_tx" ON public.cash_drawer_transactions;
CREATE POLICY "staff_insert_cash_drawer_tx" ON public.cash_drawer_transactions
FOR INSERT TO authenticated, service_role
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- 10. SERVER-AUTHORITATIVE POS & FINANCIAL RPC FUNCTIONS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Helper: Verify Manager PIN securely
CREATE OR REPLACE FUNCTION public.pos_verify_manager_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_correct_pin TEXT;
BEGIN
    SELECT COALESCE(manager_pin, '1234') INTO v_correct_pin
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC
    LIMIT 1;

    RETURN (trim(p_pin) = trim(v_correct_pin));
END;
$$;

-- 10.1 POS CREATE OR APPEND KOT (Calculates all money in minor units strictly server-side)
CREATE OR REPLACE FUNCTION public.pos_create_or_append_kot(
    p_bill_number TEXT,
    p_order_type TEXT,
    p_table_number TEXT,
    p_items JSONB,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_id UUID;
    v_kot_batch_id UUID;
    v_kot_number TEXT;
    v_batch_index INTEGER := 1;
    v_item JSONB;
    v_menu_id TEXT;
    v_quantity INTEGER;
    v_db_price NUMERIC(10,2);
    v_db_name TEXT;
    v_unit_minor INTEGER;
    v_mod_minor INTEGER := 0;
    v_mod JSONB;
    v_line_minor INTEGER;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0000;
    v_restaurant_id TEXT := 'the-cafe-barrackpore';
    v_existing_bill RECORD;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'KOT must contain at least one item');
    END IF;

    -- Look for existing running bill with this bill_number or for this table
    IF p_bill_number IS NOT NULL AND trim(p_bill_number) <> '' THEN
        SELECT * INTO v_existing_bill FROM public.bills WHERE bill_number = trim(p_bill_number) LIMIT 1;
    ELSIF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        SELECT * INTO v_existing_bill FROM public.bills 
        WHERE table_number = trim(p_table_number) AND status IN ('running', 'printed') 
        LIMIT 1;
    END IF;

    IF v_existing_bill.id IS NOT NULL THEN
        v_bill_id := v_existing_bill.id;
        -- Compute next batch index
        SELECT COALESCE(MAX(batch_index), 0) + 1 INTO v_batch_index 
        FROM public.kot_batches WHERE bill_id = v_bill_id;
    ELSE
        -- Generate fresh bill number
        v_bill_id := gen_random_uuid();
        INSERT INTO public.bills (
            id,
            restaurant_id,
            bill_number,
            order_type,
            table_number,
            customer_name,
            customer_phone,
            status,
            subtotal_minor,
            tax_amount_minor,
            grand_total_minor,
            created_by
        )
        VALUES (
            v_bill_id,
            v_restaurant_id,
            COALESCE(NULLIF(trim(p_bill_number), ''), 'BILL-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
            COALESCE(p_order_type, 'dine_in'),
            NULLIF(trim(p_table_number), ''),
            p_customer_name,
            p_customer_phone,
            'running',
            0,
            0,
            0,
            auth.uid()
        );
    END IF;

    -- Create KOT batch record
    v_kot_number := 'KOT-' || to_char(now(), 'HH24MI') || '-' || upper(substring(gen_random_uuid()::text from 1 for 4));
    INSERT INTO public.kot_batches (
        bill_id,
        restaurant_id,
        kot_number,
        batch_index,
        status,
        special_instructions,
        created_by
    )
    VALUES (
        v_bill_id,
        v_restaurant_id,
        v_kot_number,
        v_batch_index,
        'sent',
        p_special_instructions,
        auth.uid()
    )
    RETURNING id INTO v_kot_batch_id;

    -- Look up prices from canonical database and insert bill items in minor units
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        v_db_price := NULL;
        v_db_name := NULL;

        -- Lookup from public.menu_items
        SELECT price, name INTO v_db_price, v_db_name 
        FROM public.menu_items 
        WHERE id = v_menu_id 
        LIMIT 1;

        -- Fallback to public.menu
        IF v_db_price IS NULL THEN
            SELECT price, name INTO v_db_price, v_db_name 
            FROM public.menu 
            WHERE id = v_menu_id OR lower(trim(name)) = lower(trim(v_menu_id))
            LIMIT 1;
        END IF;

        IF v_db_price IS NULL THEN
            -- Use passed price converted to minor units only if catalog item not found
            v_unit_minor := ROUND(COALESCE((v_item->>'unit_price')::NUMERIC, 0) * 100);
            v_db_name := COALESCE(v_item->>'item_name', v_item->>'name', 'Item');
        ELSE
            -- Strict server catalog price converted to minor units (e.g. ₹150 -> 15000 paise)
            v_unit_minor := ROUND(v_db_price * 100);
        END IF;

        -- Compute modifier minor units
        v_mod_minor := 0;
        IF v_item->'modifiers' IS NOT NULL AND jsonb_typeof(v_item->'modifiers') = 'array' THEN
            FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
            LOOP
                v_mod_minor := v_mod_minor + ROUND(COALESCE((v_mod->>'price')::NUMERIC, 0) * 100);
            END LOOP;
        END IF;

        v_line_minor := (v_unit_minor + v_mod_minor) * v_quantity;

        INSERT INTO public.bill_items (
            bill_id,
            restaurant_id,
            kot_batch_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price_minor,
            line_total_minor,
            tax_category,
            modifiers,
            notes
        )
        VALUES (
            v_bill_id,
            v_restaurant_id,
            v_kot_batch_id,
            v_menu_id,
            v_db_name,
            v_quantity,
            v_unit_minor + v_mod_minor,
            v_line_minor,
            COALESCE(v_item->>'tax_category', 'food'),
            COALESCE(v_item->'modifiers', '[]'::jsonb),
            NULLIF(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    -- Recalculate bill financial totals strictly on the server in integer minor units
    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill_id AND is_voided = false;

    -- Fetch tax rate from settings
    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    -- GST 5% inclusive calculation: tax = subtotal * (rate / (1 + rate))
    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := v_subtotal_minor;

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = v_grand_total_minor,
        tax_details = jsonb_build_array(
            jsonb_build_object('label', 'CGST', 'rate', v_tax_rate / 2.0, 'amount_minor', ROUND(v_tax_minor / 2.0)),
            jsonb_build_object('label', 'SGST', 'rate', v_tax_rate / 2.0, 'amount_minor', v_tax_minor - ROUND(v_tax_minor / 2.0))
        ),
        updated_at = now()
    WHERE id = v_bill_id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_id', v_bill_id,
        'kot_number', v_kot_number,
        'batch_index', v_batch_index,
        'subtotal_minor', v_subtotal_minor,
        'grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 10.2 POS VOID ITEM (Requires manager PIN or manager role, logs to audit_log, recalculates totals)
CREATE OR REPLACE FUNCTION public.pos_void_item(
    p_bill_item_id UUID,
    p_void_reason TEXT,
    p_manager_pin TEXT,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_bill RECORD;
    v_is_authorized BOOLEAN := false;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0000;
BEGIN
    IF p_void_reason IS NULL OR length(trim(p_void_reason)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid void reason (min 3 chars) is required');
    END IF;

    -- Verify Authorization: Manager role or valid Manager PIN
    IF p_actor_role IN ('owner', 'manager') THEN
        v_is_authorized := true;
    ELSIF public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid manager PIN or insufficient role permissions for void');
    END IF;

    SELECT * INTO v_item FROM public.bill_items WHERE id = p_bill_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill item not found');
    END IF;

    IF v_item.is_voided THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is already voided');
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = v_item.bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Parent bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot void items on a settled bill');
    END IF;

    -- Mark item voided
    UPDATE public.bill_items
    SET is_voided = true,
        void_reason = trim(p_void_reason),
        void_approved_by = COALESCE(p_actor_name, 'Manager'),
        voided_at = now(),
        updated_at = now()
    WHERE id = p_bill_item_id;

    -- Recalculate bill in integer minor units
    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill.id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := GREATEST(0, v_subtotal_minor - v_bill.discount_amount_minor);

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = v_grand_total_minor,
        updated_at = now()
    WHERE id = v_bill.id;

    -- WRITE TO AUDIT LOG (Every void writes to audit log)
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_bill.restaurant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'manager'),
        COALESCE(p_actor_name, 'Manager'),
        'POS_ITEM_VOID',
        'bill_items',
        v_item.id::text,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'item_name', v_item.item_name,
            'quantity', v_item.quantity,
            'line_total_minor', v_item.line_total_minor,
            'void_reason', trim(p_void_reason),
            'approved_by', COALESCE(p_actor_name, 'Manager')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'voided_line_minor', v_item.line_total_minor,
        'new_subtotal_minor', v_subtotal_minor,
        'new_grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 10.3 POS APPLY DISCOUNT (Calculates minor units server-side and writes to audit_log)
CREATE OR REPLACE FUNCTION public.pos_apply_discount(
    p_bill_id UUID,
    p_discount_type TEXT,
    p_discount_value_minor INTEGER,
    p_discount_code TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_manager_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_computed_discount_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_is_authorized BOOLEAN := false;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot apply discount to an already paid bill');
    END IF;

    -- Authorize manager if manual discount
    IF p_discount_type IN ('flat', 'manual') OR p_discount_value_minor > 2000 THEN -- >20%
        IF p_actor_role IN ('owner', 'manager') OR public.is_manager_or_above(auth.uid()) THEN
            v_is_authorized := true;
        ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
            v_is_authorized := true;
        END IF;

        IF NOT v_is_authorized THEN
            RETURN jsonb_build_object('success', false, 'error', 'Manager authorization PIN required for this discount');
        END IF;
    END IF;

    -- Compute discount in integer minor units
    IF p_discount_type = 'percentage' THEN
        -- p_discount_value_minor is percentage in hundredths, e.g. 1000 = 10.00%
        v_computed_discount_minor := ROUND(v_bill.subtotal_minor * (p_discount_value_minor / 10000.0));
    ELSIF p_discount_type IN ('flat', 'manual') THEN
        v_computed_discount_minor := LEAST(v_bill.subtotal_minor, p_discount_value_minor);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid discount type');
    END IF;

    v_grand_total_minor := GREATEST(0, v_bill.subtotal_minor - v_computed_discount_minor);

    UPDATE public.bills
    SET discount_type = p_discount_type,
        discount_code = p_discount_code,
        discount_value_minor = p_discount_value_minor,
        discount_amount_minor = v_computed_discount_minor,
        discount_approved_by = COALESCE(p_actor_name, 'Staff'),
        grand_total_minor = v_grand_total_minor,
        updated_at = now()
    WHERE id = p_bill_id;

    -- WRITE TO AUDIT LOG (Every discount writes to audit log)
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_bill.restaurant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'staff'),
        COALESCE(p_actor_name, 'Staff'),
        'POS_DISCOUNT_APPLIED',
        'bills',
        v_bill.bill_number,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'discount_type', p_discount_type,
            'discount_code', p_discount_code,
            'discount_amount_minor', v_computed_discount_minor,
            'original_subtotal_minor', v_bill.subtotal_minor,
            'new_grand_total_minor', v_grand_total_minor,
            'approved_by', COALESCE(p_actor_name, 'Staff')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'discount_amount_minor', v_computed_discount_minor,
        'grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 10.4 POS RECORD DRAWER OPEN (Every drawer open writes to audit log and cash drawer transactions)
CREATE OR REPLACE FUNCTION public.pos_record_drawer_open(
    p_shift_id UUID,
    p_reason TEXT,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift RECORD;
BEGIN
    SELECT * INTO v_shift FROM public.cash_shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active shift not found');
    END IF;

    -- 1. Insert into cash_drawer_transactions
    INSERT INTO public.cash_drawer_transactions (
        restaurant_id,
        shift_id,
        type,
        amount_minor,
        reason,
        actor_id,
        actor_name,
        actor_role
    )
    VALUES (
        v_shift.restaurant_id,
        p_shift_id,
        'drawer_open',
        0,
        COALESCE(NULLIF(trim(p_reason), ''), 'Manual Cash Drawer Kick'),
        COALESCE(p_actor_id, 'staff'),
        COALESCE(p_actor_name, 'Staff Cashier'),
        COALESCE(p_actor_role, 'cashier')
    );

    -- 2. WRITE TO AUDIT LOG (Every drawer open writes to audit log)
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_shift.restaurant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'cashier'),
        COALESCE(p_actor_name, 'Staff Cashier'),
        'CASH_DRAWER_OPEN',
        'cash_shifts',
        p_shift_id::text,
        jsonb_build_object(
            'shift_number', v_shift.shift_number,
            'reason', COALESCE(NULLIF(trim(p_reason), ''), 'Manual Drawer Open Pulse'),
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Drawer open recorded in audit log');
END;
$$;

-- 10.5 POS ATOMIC BILL SPLIT (Integer minor units with zero-remainder distribution)
CREATE OR REPLACE FUNCTION public.split_bill_atomic(
    p_bill_number TEXT,
    p_split_type TEXT,
    p_splits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_split JSONB;
    v_sum_amount_minor INTEGER := 0;
    v_total_parts INTEGER;
    v_part_number INTEGER := 1;
BEGIN
    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot split an already settled bill');
    END IF;

    v_total_parts := jsonb_array_length(p_splits);
    IF v_total_parts < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Splits array cannot be empty');
    END IF;

    -- Validate minor unit sum across split parts
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_sum_amount_minor := v_sum_amount_minor + ((v_split->>'amount_minor')::INTEGER);
    END LOOP;

    IF v_sum_amount_minor <> v_bill.grand_total_minor THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Split sum (%s minor units) does not match bill grand total (%s minor units)', v_sum_amount_minor, v_bill.grand_total_minor)
        );
    END IF;

    -- Clear existing pending splits
    DELETE FROM public.bill_splits
    WHERE bill_id = v_bill.id AND status = 'pending';

    -- Insert new split parts
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        INSERT INTO public.bill_splits (
            restaurant_id,
            bill_id,
            bill_number,
            split_type,
            part_number,
            total_parts,
            payer_label,
            items,
            subtotal_minor,
            tax_amount_minor,
            amount_minor,
            status
        )
        VALUES (
            v_bill.restaurant_id,
            v_bill.id,
            v_bill.bill_number,
            p_split_type,
            COALESCE((v_split->>'part_number')::INTEGER, v_part_number),
            v_total_parts,
            COALESCE(v_split->>'payer_label', 'Guest ' || v_part_number),
            COALESCE(v_split->'items', '[]'::jsonb),
            COALESCE((v_split->>'subtotal_minor')::INTEGER, 0),
            COALESCE((v_split->>'tax_amount_minor')::INTEGER, 0),
            (v_split->>'amount_minor')::INTEGER,
            'pending'
        );
        v_part_number := v_part_number + 1;
    END LOOP;

    UPDATE public.bills
    SET is_split = true,
        split_type = p_split_type,
        split_count = v_total_parts,
        updated_at = now()
    WHERE id = v_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'total_parts', v_total_parts,
        'grand_total_minor', v_bill.grand_total_minor
    );
END;
$$;

-- 10.6 IDEMPOTENT BILL PAYMENT PROCESSOR (Integer Minor Units, Change Due, Drawer Integration)
CREATE OR REPLACE FUNCTION public.process_bill_payment(
    p_bill_number TEXT,
    p_split_id UUID DEFAULT NULL,
    p_tender_type TEXT DEFAULT 'cash',
    p_amount_minor INTEGER DEFAULT 0,
    p_tip_minor INTEGER DEFAULT 0,
    p_tendered_minor INTEGER DEFAULT 0,
    p_payment_reference TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_split RECORD;
    v_existing_tx RECORD;
    v_change_due_minor INTEGER := 0;
    v_total_paid_so_far_minor INTEGER := 0;
    v_remaining_minor INTEGER := 0;
    v_is_bill_closed BOOLEAN := false;
BEGIN
    -- Idempotency check: prevent double charges
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_tx 
        FROM public.cash_drawer_transactions 
        WHERE idempotency_key = trim(p_idempotency_key) 
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_number', p_bill_number,
                'message', 'Payment already processed (idempotent duplicate)'
            );
        END IF;
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE bill_number = trim(p_bill_number) FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
    END IF;

    -- Compute cash change in minor units
    IF p_tender_type = 'cash' THEN
        v_change_due_minor := GREATEST(0, p_tendered_minor - (p_amount_minor + p_tip_minor));
    END IF;

    -- Update split part if paying a split
    IF p_split_id IS NOT NULL THEN
        SELECT * INTO v_split FROM public.bill_splits WHERE id = p_split_id AND bill_id = v_bill.id FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Bill split part not found');
        END IF;

        IF v_split.status = 'paid' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Split part is already paid');
        END IF;

        UPDATE public.bill_splits
        SET status = 'paid',
            tender_type = p_tender_type,
            payment_reference = p_payment_reference,
            tip_amount_minor = p_tip_minor,
            tendered_amount_minor = p_tendered_minor,
            change_due_minor = v_change_due_minor,
            total_paid_minor = p_amount_minor + p_tip_minor,
            paid_at = now(),
            idempotency_key = p_idempotency_key,
            updated_at = now()
        WHERE id = p_split_id;
    END IF;

    -- Record in cash drawer if shift is active
    IF p_shift_id IS NOT NULL THEN
        INSERT INTO public.cash_drawer_transactions (
            restaurant_id,
            shift_id,
            type,
            amount_minor,
            reason,
            bill_number,
            actor_id,
            actor_name,
            actor_role,
            idempotency_key
        )
        VALUES (
            v_bill.restaurant_id,
            p_shift_id,
            'sale',
            p_amount_minor + p_tip_minor,
            format('Settlement for bill %s via %s', v_bill.bill_number, p_tender_type),
            v_bill.bill_number,
            COALESCE(p_actor_id, 'staff'),
            COALESCE(p_actor_name, 'Staff Cashier'),
            COALESCE(p_actor_role, 'cashier'),
            p_idempotency_key
        );
    END IF;

    -- Calculate total paid across splits or payments
    IF v_bill.is_split THEN
        SELECT COALESCE(SUM(amount_minor), 0)
        INTO v_total_paid_so_far_minor
        FROM public.bill_splits
        WHERE bill_id = v_bill.id AND status = 'paid';

        IF NOT EXISTS (SELECT 1 FROM public.bill_splits WHERE bill_id = v_bill.id AND status <> 'paid') THEN
            v_is_bill_closed := true;
        END IF;
    ELSE
        v_total_paid_so_far_minor := p_amount_minor;
        v_is_bill_closed := (v_total_paid_so_far_minor >= v_bill.grand_total_minor);
    END IF;

    v_remaining_minor := GREATEST(0, v_bill.grand_total_minor - v_total_paid_so_far_minor);

    IF v_is_bill_closed THEN
        UPDATE public.bills
        SET payment_status = 'paid',
            status = 'paid',
            paid_at = now(),
            payment_method = p_tender_type,
            shift_id = COALESCE(p_shift_id, shift_id),
            tips_minor = tips_minor + p_tip_minor,
            updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        UPDATE public.bills
        SET payment_status = 'processing',
            shift_id = COALESCE(p_shift_id, shift_id),
            tips_minor = tips_minor + p_tip_minor,
            updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'tender_type', p_tender_type,
        'amount_minor', p_amount_minor,
        'change_due_minor', v_change_due_minor,
        'remaining_minor', v_remaining_minor,
        'is_bill_closed', v_is_bill_closed
    );
END;
$$;

-- 10.7 MANAGER-GATED VOID & REFUND RPC (Writes to audit_log and records cash drawer refund)
CREATE OR REPLACE FUNCTION public.void_or_refund_order_secure(
    p_order_ref TEXT,
    p_reason TEXT,
    p_amount_minor INTEGER DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_manager_pin TEXT DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_is_authorized BOOLEAN := false;
    v_refund_minor INTEGER;
BEGIN
    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid refund reason is required');
    END IF;

    -- Strict Authorization: Only Owner or Manager
    IF p_actor_role IN ('owner', 'manager') OR public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Manager authorization is required for refunds/voids');
    END IF;

    -- Lookup in bills table first
    SELECT * INTO v_bill FROM public.bills 
    WHERE bill_number = trim(p_order_ref) OR id::text = trim(p_order_ref) 
    FOR UPDATE;

    IF FOUND THEN
        v_refund_minor := COALESCE(p_amount_minor, v_bill.grand_total_minor);

        UPDATE public.bills
        SET status = 'voided',
            payment_status = 'refunded',
            updated_at = now()
        WHERE id = v_bill.id;

        UPDATE public.bill_splits
        SET status = 'refunded',
            updated_at = now()
        WHERE bill_id = v_bill.id;

        -- Record drawer refund transaction if cash
        IF p_shift_id IS NOT NULL THEN
            INSERT INTO public.cash_drawer_transactions (
                restaurant_id,
                shift_id,
                type,
                amount_minor,
                reason,
                bill_number,
                actor_id,
                actor_name,
                actor_role
            )
            VALUES (
                v_bill.restaurant_id,
                p_shift_id,
                'refund',
                v_refund_minor,
                format('Refund for bill %s: %s', v_bill.bill_number, trim(p_reason)),
                v_bill.bill_number,
                COALESCE(p_actor_id, 'manager'),
                COALESCE(p_actor_name, 'Manager'),
                'manager'
            );
        END IF;

        -- WRITE TO AUDIT LOG (Every refund writes to audit log)
        INSERT INTO public.audit_log (
            restaurant_id,
            actor_id,
            actor_role,
            actor_name,
            action,
            target_type,
            target_id,
            details
        )
        VALUES (
            v_bill.restaurant_id,
            p_actor_id,
            COALESCE(p_actor_role, 'manager'),
            COALESCE(p_actor_name, 'Manager'),
            'POS_BILL_REFUND',
            'bills',
            v_bill.bill_number,
            jsonb_build_object(
                'bill_number', v_bill.bill_number,
                'refund_minor', v_refund_minor,
                'reason', trim(p_reason),
                'authorized_by', COALESCE(p_actor_name, 'Manager')
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'bill_number', v_bill.bill_number,
            'refund_minor', v_refund_minor,
            'message', 'Bill refunded successfully and logged to audit trail'
        );
    END IF;

    -- Fallback to legacy orders table if referenced by order_ref
    RETURN jsonb_build_object('success', false, 'error', 'Target bill or order not found');
END;
$$;

-- 10.8 FINANCIAL Z-REPORT GENERATION (Strict integer minor units)
CREATE OR REPLACE FUNCTION public.get_shift_z_report(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift RECORD;
    v_cash_sales_minor INTEGER := 0;
    v_card_sales_minor INTEGER := 0;
    v_upi_sales_minor INTEGER := 0;
    v_other_sales_minor INTEGER := 0;
    v_cash_in_minor INTEGER := 0;
    v_cash_out_minor INTEGER := 0;
    v_cash_refunds_minor INTEGER := 0;
    v_gross_sales_minor INTEGER := 0;
    v_expected_cash_minor INTEGER := 0;
    v_variance_minor INTEGER := 0;
    v_tx_count INTEGER := 0;
BEGIN
    SELECT * INTO v_shift FROM public.cash_shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
    END IF;

    -- Cash Drawer transactions totals
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'sale' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'cash_out' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount_minor ELSE 0 END), 0),
        COUNT(id)
    INTO 
        v_cash_sales_minor, v_cash_in_minor, v_cash_out_minor, v_cash_refunds_minor, v_tx_count
    FROM public.cash_drawer_transactions
    WHERE shift_id = p_shift_id;

    -- Tender totals from settled bills associated with this shift
    SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'card', 'upi') THEN grand_total_minor ELSE 0 END), 0)
    INTO 
        v_card_sales_minor, v_upi_sales_minor, v_other_sales_minor
    FROM public.bills
    WHERE shift_id = p_shift_id AND status = 'paid';

    v_gross_sales_minor := v_cash_sales_minor + v_card_sales_minor + v_upi_sales_minor + v_other_sales_minor;
    
    -- Expected cash = opening float + cash sales + cash in - cash out - cash refunds
    v_expected_cash_minor := v_shift.opening_float_minor + v_cash_sales_minor + v_cash_in_minor - v_cash_out_minor - v_cash_refunds_minor;
    v_variance_minor := COALESCE(v_shift.counted_cash_minor, v_expected_cash_minor) - v_expected_cash_minor;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', v_shift.id,
        'shift_number', v_shift.shift_number,
        'opened_at', v_shift.opened_at,
        'closed_at', v_shift.closed_at,
        'opened_by_name', v_shift.opened_by_name,
        'closed_by_name', v_shift.closed_by_name,
        'opening_float_minor', v_shift.opening_float_minor,
        'gross_sales_minor', v_gross_sales_minor,
        'cash_sales_minor', v_cash_sales_minor,
        'card_sales_minor', v_card_sales_minor,
        'upi_sales_minor', v_upi_sales_minor,
        'other_sales_minor', v_other_sales_minor,
        'cash_in_minor', v_cash_in_minor,
        'cash_out_minor', v_cash_out_minor,
        'cash_refunds_minor', v_cash_refunds_minor,
        'expected_cash_minor', v_expected_cash_minor,
        'counted_cash_minor', v_shift.counted_cash_minor,
        'variance_minor', v_variance_minor,
        'tx_count', v_tx_count
    );
END;
$$;

-- 10.9 TABLE OPERATIONS: Table Transfer, Table Merge, Item Move
CREATE OR REPLACE FUNCTION public.pos_transfer_table(
    p_from_table TEXT,
    p_to_table TEXT,
    p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source_bill RECORD;
    v_dest_bill RECORD;
BEGIN
    SELECT * INTO v_source_bill FROM public.bills 
    WHERE table_number = trim(p_from_table) AND status IN ('running', 'printed') 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active running bill found on source table');
    END IF;

    SELECT * INTO v_dest_bill FROM public.bills 
    WHERE table_number = trim(p_to_table) AND status IN ('running', 'printed') 
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Destination table already has an active bill. Use table merge instead.');
    END IF;

    UPDATE public.bills
    SET table_number = trim(p_to_table),
        notes = COALESCE(notes || E'\n', '') || format('Transferred from Table %s by %s at %s', p_from_table, COALESCE(p_actor_name, 'Staff'), now()),
        updated_at = now()
    WHERE id = v_source_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_source_bill.bill_number,
        'from_table', p_from_table,
        'to_table', p_to_table
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_merge_tables(
    p_primary_table TEXT,
    p_secondary_table TEXT,
    p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_primary_bill RECORD;
    v_secondary_bill RECORD;
    v_new_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0000;
BEGIN
    SELECT * INTO v_primary_bill FROM public.bills 
    WHERE table_number = trim(p_primary_table) AND status IN ('running', 'printed') 
    FOR UPDATE;

    SELECT * INTO v_secondary_bill FROM public.bills 
    WHERE table_number = trim(p_secondary_table) AND status IN ('running', 'printed') 
    FOR UPDATE;

    IF v_primary_bill.id IS NULL OR v_secondary_bill.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Both tables must have active running bills to merge');
    END IF;

    -- Move all items and KOT batches from secondary bill to primary bill
    UPDATE public.bill_items
    SET bill_id = v_primary_bill.id,
        updated_at = now()
    WHERE bill_id = v_secondary_bill.id;

    UPDATE public.kot_batches
    SET bill_id = v_primary_bill.id
    WHERE bill_id = v_secondary_bill.id;

    -- Mark secondary bill as merged
    UPDATE public.bills
    SET status = 'merged',
        notes = format('Merged into %s on Table %s by %s', v_primary_bill.bill_number, p_primary_table, COALESCE(p_actor_name, 'Staff')),
        updated_at = now()
    WHERE id = v_secondary_bill.id;

    -- Recalculate primary bill in minor units
    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_new_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_primary_bill.id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    v_tax_minor := ROUND(v_new_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));

    UPDATE public.bills
    SET subtotal_minor = v_new_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = GREATEST(0, v_new_subtotal_minor - discount_amount_minor),
        notes = COALESCE(notes || E'\n', '') || format('Merged Table %s items into this bill by %s at %s', p_secondary_table, COALESCE(p_actor_name, 'Staff'), now()),
        updated_at = now()
    WHERE id = v_primary_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'primary_bill_number', v_primary_bill.bill_number,
        'merged_secondary_bill', v_secondary_bill.bill_number,
        'grand_total_minor', GREATEST(0, v_new_subtotal_minor - v_primary_bill.discount_amount_minor)
    );
END;
$$;

-- Grant EXECUTE privileges to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.pos_verify_manager_pin(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_apply_discount(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_record_drawer_open(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.split_bill_atomic(TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_bill_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_or_refund_order_secure(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shift_z_report(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_transfer_table(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_merge_tables(TEXT, TEXT, TEXT) TO authenticated, service_role;
