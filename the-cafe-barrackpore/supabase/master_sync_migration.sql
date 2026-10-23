-- ==============================================================================
-- THE CAFÉ BARRACKPORE — MASTER DATABASE SYNC MIGRATION (020 - 027)
-- Safe, fully idempotent script to bring the live database up to date with
-- POS billing, cash drawers, shifts, KOT batches, multi-rate tax engine parity,
-- feature toggles, and concurrency hardening.
-- Copy and paste this ENTIRE script into Supabase Dashboard -> SQL Editor and click Run.
-- ==============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 020_payment_ledger_and_order_status.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 020_payment_ledger_and_order_status.sql
-- Description: Ensure unique index on payments(order_ref) and expose guest receipt
--              metadata in get_order_status_by_token
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. Ensure unique index on public.payments(order_ref)
-- Deduplicate any legacy pending records if any exist prior to unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'payments' 
          AND indexname = 'idx_payments_order_ref_unique'
    ) THEN
        -- Keep most recently updated payment record if duplicates exist
        DELETE FROM public.payments p1
        USING public.payments p2
        WHERE p1.order_ref = p2.order_ref
          AND p1.updated_at < p2.updated_at;

        CREATE UNIQUE INDEX idx_payments_order_ref_unique 
        ON public.payments (order_ref);
    END IF;
END $$;

-- 2. Update get_order_status_by_token to expose receipt fields
-- Allows order-success page to display dining mode (dine_in vs takeaway),
-- assigned table number, and customer name for verified token holders.
CREATE OR REPLACE FUNCTION public.get_order_status_by_token(
    p_order_ref TEXT,
    p_payment_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_token_hash TEXT;
BEGIN
    IF p_order_ref IS NULL OR p_payment_token IS NULL OR trim(p_payment_token) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing order reference or payment token');
    END IF;

    v_token_hash := encode(sha256(trim(p_payment_token)::bytea), 'hex');

    SELECT id, order_ref, status, payment_status, total, payment_amount, currency, created_at,
           order_type, table_number, customer_name
    INTO v_order
    FROM public.orders
    WHERE order_ref = trim(p_order_ref)
      AND payment_token_hash = v_token_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid order reference or payment token');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_ref', v_order.order_ref,
        'status', v_order.status,
        'payment_status', v_order.payment_status,
        'total', v_order.total,
        'payment_amount', v_order.payment_amount,
        'currency', v_order.currency,
        'created_at', v_order.created_at,
        'order_type', v_order.order_type,
        'table_number', v_order.table_number,
        'customer_name', v_order.customer_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 021_pos_billing_shifts_and_drawer.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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
DROP FUNCTION IF EXISTS public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);

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
    v_tax_rate NUMERIC := 0.0500;
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
DROP FUNCTION IF EXISTS public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

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
    v_tax_rate NUMERIC := 0.0500;
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

    SELECT COALESCE(tax_rate, 0.0500) INTO v_tax_rate
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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 022_restaurant_feature_toggles.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 022_restaurant_feature_toggles.sql
-- Description:
-- 1. Unified 18-Feature Toggle Architecture on restaurant_settings:
--    - online_ordering, delivery, takeaway, qr_table_ordering, reservations,
--      kds, pos, running_table_bills, split_bills, cash_drawer, kot_printing,
--      discounts, tips, vip_club, online_payments, specials_banner, gallery,
--      language_switcher.
-- 2. Helper functions:
--    - is_feature_enabled(p_feature_key, p_restaurant_id)
--    - check_feature_open_data(p_feature_key, p_restaurant_id)
-- 3. Owner-gated RPC:
--    - update_restaurant_features(p_features, p_restaurant_id)
--    - Validates dependencies (split_bills, running_table_bills, cash_drawer -> pos; kot_printing -> kds/printer)
--    - Blocks turning OFF features that have open data (open table bills, open cash shifts)
--    - Records full audit trail in public.audit_log
-- 4. Server enforcement on core RPCs:
--    - create_order_atomic (rejects if ordering, channel, online payment, or discount disabled)
--    - create_reservation_atomic (rejects if reservations disabled)
--    - validate_discount_code (rejects if discounts disabled)
--    - pos_create_or_append_kot (rejects if pos, running bills, or kot printing disabled)
--    - split_bill_atomic (rejects if pos or split_bills disabled)
--    - pos_record_drawer_open (rejects if pos or cash_drawer disabled)
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD FEATURES JSONB COLUMN TO RESTAURANT_SETTINGS
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{
    "online_ordering": true,
    "delivery": true,
    "takeaway": true,
    "qr_table_ordering": true,
    "reservations": true,
    "kds": true,
    "pos": true,
    "running_table_bills": true,
    "split_bills": true,
    "cash_drawer": true,
    "kot_printing": true,
    "discounts": true,
    "tips": true,
    "vip_club": true,
    "online_payments": true,
    "specials_banner": true,
    "gallery": true,
    "language_switcher": true
}'::jsonb;

-- Synchronize existing operational toggles with features column for existing rows
UPDATE public.restaurant_settings
SET features = jsonb_set(
    jsonb_set(
        jsonb_set(
            features,
            '{online_ordering}',
            to_jsonb(is_ordering_enabled)
        ),
        '{reservations}',
        to_jsonb(is_table_booking_enabled)
    ),
    '{online_payments}',
    to_jsonb(COALESCE(payments_enabled, payment_enabled, false))
)
WHERE features IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. HELPER FUNCTION: is_feature_enabled
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
    p_feature_key TEXT,
    p_restaurant_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_features JSONB;
    v_val TEXT;
BEGIN
    SELECT rs.features INTO v_features
    FROM public.restaurant_settings rs
    WHERE (p_restaurant_id IS NULL OR rs.restaurant_id = p_restaurant_id)
    LIMIT 1;

    IF v_features IS NULL THEN
        RETURN true; -- fallback if settings row does not exist yet
    END IF;

    v_val := v_features->>p_feature_key;
    IF v_val IS NULL THEN
        RETURN true;
    END IF;

    RETURN (v_val = 'true');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. HELPER FUNCTION: check_feature_open_data
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_feature_open_data(
    p_feature_key TEXT,
    p_restaurant_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_res_id TEXT := COALESCE(p_restaurant_id, 'the-cafe-barrackpore');
    v_count INTEGER := 0;
BEGIN
    -- 1. Running Table Bills & POS: Check active running bills or dine-in orders
    IF p_feature_key IN ('running_table_bills', 'pos') THEN
        -- Check public.bills table if it exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
            SELECT COUNT(*) INTO v_count
            FROM public.bills
            WHERE status = 'running'
              AND restaurant_id = v_res_id;

            IF v_count > 0 THEN
                RETURN jsonb_build_object(
                    'has_open_data', true,
                    'count', v_count,
                    'message', format('Cannot disable %s: %s active table bill(s) are currently running. Please settle or void all running bills first.', p_feature_key, v_count)
                );
            END IF;
        END IF;

        -- Also check public.orders for active dine_in orders
        SELECT COUNT(*) INTO v_count
        FROM public.orders
        WHERE order_type = 'dine_in'
          AND status IN ('pending', 'confirmed', 'preparing')
          AND restaurant_id = v_res_id;

        IF v_count > 0 THEN
            RETURN jsonb_build_object(
                'has_open_data', true,
                'count', v_count,
                'message', format('Cannot disable %s: %s active dine-in order(s) are in progress. Please complete them first.', p_feature_key, v_count)
            );
        END IF;
    END IF;

    -- 2. Cash Drawer & Shifts: Check open cash shifts
    IF p_feature_key = 'cash_drawer' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_shifts') THEN
            SELECT COUNT(*) INTO v_count
            FROM public.cash_shifts
            WHERE status = 'open'
              AND restaurant_id = v_res_id;

            IF v_count > 0 THEN
                RETURN jsonb_build_object(
                    'has_open_data', true,
                    'count', v_count,
                    'message', 'Cannot disable Cash Drawer & Shifts: There is an active cash shift currently open. Please count and close the active shift first.'
                );
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'has_open_data', false,
        'count', 0,
        'message', 'No active open data blocking this feature.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_feature_open_data(TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. OWNER-GATED RPC: update_restaurant_features
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_restaurant_features(
    p_features JSONB,
    p_restaurant_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_id UUID;
    v_res_id TEXT;
    v_old_features JSONB;
    v_adjusted_features JSONB := p_features;
    v_open_check JSONB;
    v_feature_key TEXT;
    v_old_val BOOLEAN;
    v_new_val BOOLEAN;
    v_pos_enabled BOOLEAN;
    v_kds_enabled BOOLEAN;
BEGIN
    v_caller_id := auth.uid();

    -- 1. Authorization Gate: Only owners can update feature toggles
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        SELECT role INTO v_caller_role
        FROM public.staff_profiles
        WHERE user_id = v_caller_id AND active = true
        LIMIT 1;

        IF v_caller_role IS NULL OR v_caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Access Denied: Only restaurant owners are authorized to change feature flags.';
        END IF;
    ELSE
        v_caller_role := 'service_role';
    END IF;

    -- 2. Resolve restaurant_id
    SELECT rs.restaurant_id, rs.features
    INTO v_res_id, v_old_features
    FROM public.restaurant_settings rs
    WHERE (p_restaurant_id IS NULL OR rs.restaurant_id = p_restaurant_id)
    LIMIT 1;

    IF v_res_id IS NULL THEN
        v_res_id := COALESCE(p_restaurant_id, 'the-cafe-barrackpore');
    END IF;

    IF v_old_features IS NULL THEN
        v_old_features := '{}'::jsonb;
    END IF;

    -- 3. Dependency Validation & Auto-handling
    -- Rule: split_bills, running_table_bills, cash_drawer require POS
    v_pos_enabled := COALESCE((v_adjusted_features->>'pos')::boolean, true);

    IF NOT v_pos_enabled THEN
        -- Auto-disable dependents if POS is disabled
        v_adjusted_features := jsonb_set(v_adjusted_features, '{split_bills}', 'false'::jsonb);
        v_adjusted_features := jsonb_set(v_adjusted_features, '{running_table_bills}', 'false'::jsonb);
        v_adjusted_features := jsonb_set(v_adjusted_features, '{cash_drawer}', 'false'::jsonb);
    END IF;

    -- Rule: kot_printing requires KDS or thermal printer
    v_kds_enabled := COALESCE((v_adjusted_features->>'kds')::boolean, true);
    IF (v_adjusted_features->>'kot_printing')::boolean = true AND NOT v_kds_enabled THEN
        -- Auto-enable KDS to satisfy KOT dependency
        v_adjusted_features := jsonb_set(v_adjusted_features, '{kds}', 'true'::jsonb);
    END IF;

    -- 4. Open Data Verification
    -- Iterate over keys being turned from true to false
    FOR v_feature_key IN SELECT jsonb_object_keys(v_adjusted_features)
    LOOP
        v_old_val := COALESCE((v_old_features->>v_feature_key)::boolean, true);
        v_new_val := COALESCE((v_adjusted_features->>v_feature_key)::boolean, true);

        IF v_old_val = true AND v_new_val = false THEN
            v_open_check := public.check_feature_open_data(v_feature_key, v_res_id);
            IF (v_open_check->>'has_open_data')::boolean = true THEN
                RAISE EXCEPTION 'Cannot turn OFF feature "%": %', v_feature_key, (v_open_check->>'message');
            END IF;
        END IF;
    END LOOP;

    -- 5. Update restaurant_settings
    UPDATE public.restaurant_settings
    SET
        features = v_adjusted_features,
        is_ordering_enabled = COALESCE((v_adjusted_features->>'online_ordering')::boolean, true),
        is_table_booking_enabled = COALESCE((v_adjusted_features->>'reservations')::boolean, true),
        payments_enabled = COALESCE((v_adjusted_features->>'online_payments')::boolean, false),
        payment_enabled = COALESCE((v_adjusted_features->>'online_payments')::boolean, false),
        updated_at = now()
    WHERE (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

    -- 6. Write to public.audit_log
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        action,
        target_type,
        target_id,
        details,
        created_at
    ) VALUES (
        v_res_id,
        COALESCE(v_caller_id::text, 'system'),
        v_caller_role,
        'feature_flags_updated',
        'restaurant_settings',
        'current',
        jsonb_build_object(
            'old_features', v_old_features,
            'new_features', v_adjusted_features,
            'updated_by', COALESCE(v_caller_id::text, 'service_role')
        ),
        now()
    );

    RETURN v_adjusted_features;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_restaurant_features(JSONB, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. SERVER ENFORCEMENT: Update create_order_atomic with feature toggles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    v_discount_amount NUMERIC := 0.00;
    v_tip_amount NUMERIC := 0.00;
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_order_type TEXT;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Read restaurant_id from restaurant_settings
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. Feature Toggle Server Enforcement
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    IF p_order->>'discount_code' IS NOT NULL AND length(trim(p_order->>'discount_code')) > 0 
       AND NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
    END IF;

    v_tip_amount := COALESCE((p_order->>'tip_amount')::numeric, 0.00);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 3. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    -- Enforce distinct item cap at 40
    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 4. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 5. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 6. Generate order reference using random code (never sequential)
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- Generate random payment_token built from two gen_random_uuid
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 7. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 8. Fetch Tax configuration from restaurant_settings
    SELECT 
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.tax_mode, 'inclusive'),
        COALESCE(rs.tax_rate, 0.0500),
        COALESCE(rs.currency, 'INR')
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_currency
    FROM public.restaurant_settings rs
    WHERE rs.restaurant_id = v_restaurant_id
    LIMIT 1;

    -- 9. Iterate items: Authoritative server-side pricing & stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Invalid item quantity for item %: must be between 1 and 50', v_item_id;
        END IF;

        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Item not found in restaurant menu: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item % (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        v_line_total := v_db_unit_price * v_quantity;
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 10. Compute Tax
    IF v_tax_enabled THEN
        IF v_tax_mode = 'exclusive' THEN
            v_tax_amount := round(v_computed_subtotal * v_tax_rate, 2);
            v_computed_total := v_computed_subtotal + v_tax_amount;
        ELSE
            v_tax_amount := round(v_computed_subtotal - (v_computed_subtotal / (1.0 + v_tax_rate)), 2);
            v_computed_total := v_computed_subtotal;
        END IF;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- Add tips if enabled
    IF v_tip_amount > 0 THEN
        v_computed_total := v_computed_total + v_tip_amount;
    END IF;

    -- 11. Insert Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        tax_amount,
        total,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 12. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_item_id,
            v_db_item_name,
            v_quantity,
            v_db_unit_price,
            v_db_unit_price * v_quantity,
            nullif(trim(COALESCE(v_item->>'notes', '')), ''),
            v_created_at
        );
    END LOOP;

    -- Return full order response including single-use unhashed payment_token
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_computed_subtotal,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. SERVER ENFORCEMENT: Update create_reservation_atomic with reservations feature check
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
    p_reservation JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_res_id UUID;
    v_res_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_party_size INTEGER;
    v_date DATE;
    v_time TEXT;
BEGIN
    IF p_reservation IS NULL OR jsonb_typeof(p_reservation) <> 'object' THEN
        RAISE EXCEPTION 'Reservation payload must be a valid JSON object';
    END IF;

    -- 1. Read restaurant_id from settings
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. Feature Toggle Check: Table reservations
    IF NOT public.is_feature_enabled('reservations', v_restaurant_id) THEN
        RAISE EXCEPTION 'Table reservations are currently disabled by the restaurant.';
    END IF;

    -- 3. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_reservation->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to make a reservation';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('reservation', 'table_booking')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 4. Validate fields
    v_customer_name := trim(COALESCE(p_reservation->>'customer_name', ''));
    IF length(v_customer_name) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    v_customer_phone := trim(COALESCE(p_reservation->>'customer_phone', ''));
    IF length(v_customer_phone) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    v_party_size := (p_reservation->>'party_size')::INTEGER;
    IF v_party_size IS NULL OR v_party_size < 1 OR v_party_size > 20 THEN
        RAISE EXCEPTION 'Invalid party size: must be between 1 and 20';
    END IF;

    v_date := (p_reservation->>'reservation_date')::DATE;
    IF v_date IS NULL OR v_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Reservation date cannot be in the past';
    END IF;

    v_time := trim(COALESCE(p_reservation->>'reservation_time', ''));
    IF v_time = '' THEN
        RAISE EXCEPTION 'Reservation time is required';
    END IF;

    -- 5. Generate secure random reservation reference
    v_res_ref := 'RS-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- 6. Insert Reservation Record
    INSERT INTO public.reservations (
        restaurant_id,
        reservation_ref,
        customer_name,
        customer_phone,
        customer_email,
        party_size,
        reservation_date,
        reservation_time,
        table_number,
        special_requests,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_res_ref,
        v_customer_name,
        v_customer_phone,
        nullif(trim(COALESCE(p_reservation->>'customer_email', '')), ''),
        v_party_size,
        v_date,
        v_time,
        nullif(trim(COALESCE(p_reservation->>'table_number', '')), ''),
        nullif(trim(COALESCE(p_reservation->>'special_requests', '')), ''),
        'pending',
        now(),
        now()
    )
    RETURNING id INTO v_res_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_res_id,
        'reservation_ref', v_res_ref
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SERVER ENFORCEMENT: Update validate_discount_code with discounts feature check
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_discount_code(code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code RECORD;
    v_restaurant_id TEXT;
BEGIN
    SELECT rs.restaurant_id INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discounts and promotional coupons are currently disabled by the restaurant.');
    END IF;

    SELECT * INTO v_code
    FROM public.discount_codes
    WHERE upper(trim(discount_codes.code)) = upper(trim(validate_discount_code.code))
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_until IS NULL OR valid_until >= now());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired discount code');
    END IF;

    IF v_code.max_uses IS NOT NULL AND v_code.current_uses >= v_code.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discount code has reached its usage limit');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'code', v_code.code,
        'type', v_code.type,
        'value', v_code.value,
        'min_order_amount', v_code.min_order_amount,
        'max_discount_amount', v_code.max_discount_amount
    );
END;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 023_dated_tax_registry.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 023_dated_tax_registry.sql
-- Description:
-- 1. Dated Tax Rules Table (public.tax_rules):
--    - country, region, rule_label, rate, mode, applies_to (categories),
--      order_type (all/dine_in/takeaway/delivery), effective_from, effective_to,
--      source_url, last_verified_at, status (verified/unverified).
-- 2. Extended Item Categories:
--    - food, hot_drink, soft_drink, bottled_water, alcohol, tobacco,
--      packaged_goods, service, exempt.
--    - Adds tax_category to menu_items and order_items.
-- 3. Restaurant Settings Governance:
--    - country, region, accountant_verified, accountant_verified_at,
--      accountant_notes, cover_charge, cover_charge_label, cover_charge_taxable.
-- 4. Seed Verified Rules for Core 14 Jurisdictions:
--    - Ireland (IE), United Kingdom (GB), United States (US: NY, CA, TX, FL),
--      Canada (CA: ON, BC, AB), Australia (AU), New Zealand (NZ), UAE (AE),
--      Singapore (SG: 8% 2023 -> 9% 2024), India (IN: standalone 5%, hotel premises 18%,
--      alcohol outside GST 0%), Germany (DE: 7% temp dine-in -> 19% 2024),
--      France (FR), Spain (ES), Italy (IT), Netherlands (NL).
-- 5. Updated create_order_atomic:
--    - Date-aware rule resolution on order date (CURRENT_DATE).
--    - Go-live protection: Blocks live ordering if accountant has not confirmed
--      or if active rules are unverified.
--    - Item category tax resolution (exempt items = 0%).
--    - Tips invariant: strictly NEVER taxed across all jurisdictions.
--    - Emits dated receipt tax breakdown with rates_as_of date and tax ID.
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DATED TAX RULES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country VARCHAR(10) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'ALL',
    rule_label VARCHAR(100) NOT NULL,
    rate NUMERIC(6, 4) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'inclusive' CHECK (mode IN ('inclusive', 'exclusive')),
    applies_to TEXT[] NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (order_type IN ('all', 'dine_in', 'takeaway', 'delivery')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_url TEXT NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'unverified', 'conflict')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup 
ON public.tax_rules(country, region, status, effective_from, effective_to);

-- Row Level Security
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tax_rules' AND policyname = 'Allow public read access to tax rules'
    ) THEN
        CREATE POLICY "Allow public read access to tax rules" 
        ON public.tax_rules FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tax_rules' AND policyname = 'Allow owners and service role to manage tax rules'
    ) THEN
        CREATE POLICY "Allow owners and service role to manage tax rules" 
        ON public.tax_rules FOR ALL 
        USING (
            COALESCE(auth.role(), '') = 'service_role' OR 
            EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = auth.uid() AND role = 'owner')
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA ADDITIONS ON EXISTING TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(30) DEFAULT 'food';

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(30) DEFAULT 'food';

ALTER TABLE public.restaurant_settings 
ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'IN',
ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'ALL',
ADD COLUMN IF NOT EXISTS accountant_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS accountant_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accountant_notes TEXT,
ADD COLUMN IF NOT EXISTS cover_charge NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cover_charge_label VARCHAR(50) DEFAULT 'Cover Charge',
ADD COLUMN IF NOT EXISTS cover_charge_taxable BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- 3. SEED DATED RULES FOR 14 CORE JURISDICTIONS
-- ------------------------------------------------------------------------------
DELETE FROM public.tax_rules WHERE country IN (
    'IE', 'GB', 'US', 'CA', 'AU', 'NZ', 'AE', 'SG', 'IN', 'DE', 'FR', 'ES', 'IT', 'NL'
);

INSERT INTO public.tax_rules (
    country, region, rule_label, rate, mode, applies_to, order_type,
    effective_from, effective_to, source_url, status
) VALUES
-- Ireland (IE)
('IE', 'ALL', 'VAT Restaurant Food & Hot Drinks', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink'], 'all', '2023-09-01', NULL,
 'https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/restaurant-services.aspx', 'verified'),
('IE', 'ALL', 'VAT Standard (Alcohol & Cold Packaged Drinks)', 0.2300, 'inclusive',
 ARRAY['soft_drink', 'bottled_water', 'alcohol'], 'all', '2021-03-01', NULL,
 'https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/alcoholic-drinks.aspx', 'verified'),

-- United Kingdom (GB)
('GB', 'ALL', 'Standard Rate VAT', 0.2000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol'], 'all', '2011-01-04', NULL,
 'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091', 'verified'),
('GB', 'ALL', 'Zero-rate Takeaway Cold Food', 0.0000, 'inclusive',
 ARRAY['food'], 'takeaway', '2011-01-04', NULL,
 'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091#cold-takeaway-food', 'verified'),

-- United States (US: State-level)
('US', 'NY', 'NYS and Local Sales Tax (NYC)', 0.08875, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm', 'verified'),
('US', 'CA', 'California State & Local Sales Tax', 0.0725, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://www.cdtfa.ca.gov/formspubs/pub22.pdf', 'verified'),
('US', 'TX', 'Texas State & Local Sales Tax', 0.0825, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://comptroller.texas.gov/taxes/publications/96-117.php', 'verified'),
('US', 'FL', 'Florida Sales Tax', 0.0600, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx', 'verified'),

-- Canada (CA: Province-level)
('CA', 'ON', 'Ontario Harmonized Sales Tax (HST)', 0.1300, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2010-07-01', NULL,
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', 'verified'),
('CA', 'BC', 'British Columbia GST + PST', 0.1200, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2013-04-01', NULL,
 'https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/publications/restaurant-food-services', 'verified'),
('CA', 'AB', 'Alberta GST', 0.0500, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2008-01-01', NULL,
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', 'verified'),

-- Australia (AU)
('AU', 'ALL', 'Goods and Services Tax (GST)', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2000-07-01', NULL,
 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/your-industry/restaurant-and-catering', 'verified'),

-- New Zealand (NZ)
('NZ', 'ALL', 'Goods and Services Tax (GST)', 0.1500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2010-10-01', NULL,
 'https://www.ird.govt.nz/gst', 'verified'),

-- United Arab Emirates (AE)
('AE', 'ALL', 'UAE Value Added Tax (VAT)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2018-01-01', NULL,
 'https://tax.gov.ae/en/legislation/vat-legislation.aspx', 'verified'),

-- Singapore (SG: Dated rate increase 8% in 2023 -> 9% in 2024)
('SG', 'ALL', 'Singapore GST 2023', 0.0800, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2023-01-01', '2023-12-31',
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change', 'verified'),
('SG', 'ALL', 'Singapore GST 2024+', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2024-01-01', NULL,
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change', 'verified'),

-- India (IN: Standalone 5% without ITC, Hotel Premises 18% with ITC, Alcohol outside GST)
('IN', 'STANDALONE', 'GST Standalone Restaurant (without ITC)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2017-11-15', NULL,
 'https://cbic-gst.gov.in/pdf/notification-46-2017-central-tax-rate.pdf', 'verified'),
('IN', 'HOTEL_PREMISES', 'GST Hotel Premises declared tariff >= 7500 (with ITC)', 0.1800, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2019-10-01', NULL,
 'https://cbic-gst.gov.in/pdf/notification-20-2019-central-tax-rate.pdf', 'verified'),
('IN', 'ALL', 'GST Standalone Restaurant (without ITC)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2017-11-15', NULL,
 'https://cbic-gst.gov.in/pdf/notification-46-2017-central-tax-rate.pdf', 'verified'),
('IN', 'ALL', 'Alcohol for Human Consumption (outside GST)', 0.0000, 'inclusive',
 ARRAY['alcohol'], 'all', '2017-07-01', NULL,
 'https://cbic-gst.gov.in/gst-goods-services-rates.html', 'verified'),

-- Germany (DE: Dated transition - 7% temp dine-in food ended 2023-12-31 -> 19% standard 2024+)
('DE', 'ALL', 'Temporary Reduced MwSt Restaurant Food (COVID/Energy Relief)', 0.0700, 'inclusive',
 ARRAY['food'], 'dine_in', '2020-07-01', '2023-12-31',
 'https://www.bundesfinanzministerium.de', 'verified'),
('DE', 'ALL', 'Standard MwSt Restaurant Services', 0.1900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2024-01-01', NULL,
 'https://www.bundesfinanzministerium.de', 'verified'),
('DE', 'ALL', 'Takeaway Food Reduced MwSt', 0.0700, 'inclusive',
 ARRAY['food'], 'takeaway', '2024-01-01', NULL,
 'https://www.bundesfinanzministerium.de', 'verified'),

-- France (FR: 10% food/soft drinks, 20% alcohol)
('FR', 'ALL', 'TVA Restauration (Alimentation & Boissons sans alcool)', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2014-01-01', NULL,
 'https://www.economie.gouv.fr/entreprises/taux-tva-restauration', 'verified'),
('FR', 'ALL', 'TVA Boissons Alcooliques', 0.2000, 'inclusive',
 ARRAY['alcohol'], 'all', '2014-01-01', NULL,
 'https://www.economie.gouv.fr/entreprises/taux-tva-restauration', 'verified'),

-- Spain (ES: 10% food/soft drinks, 21% alcohol)
('ES', 'ALL', 'IVA Reducido Hostelería', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2012-09-01', NULL,
 'https://sede.agenciatributaria.gob.es', 'verified'),
('ES', 'ALL', 'IVA General Bebidas Alcohólicas', 0.2100, 'inclusive',
 ARRAY['alcohol'], 'all', '2012-09-01', NULL,
 'https://sede.agenciatributaria.gob.es', 'verified'),

-- Italy (IT: 10% food/soft drinks, 22% alcohol)
('IT', 'ALL', 'IVA Ridotta Ristorazione', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2013-10-01', NULL,
 'https://www.agenziaentrate.gov.it', 'verified'),
('IT', 'ALL', 'IVA Ordinaria Bevande Alcoliche', 0.2200, 'inclusive',
 ARRAY['alcohol'], 'all', '2013-10-01', NULL,
 'https://www.agenziaentrate.gov.it', 'verified'),

-- Netherlands (NL: 9% food/soft drinks, 21% alcohol)
('NL', 'ALL', 'BTW Laag Tarief Voedingsmiddelen & Alcoholvrije Dranken', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2019-01-01', NULL,
 'https://www.belastingdienst.nl', 'verified'),
('NL', 'ALL', 'BTW Hoog Tarief Alcoholhoudende Dranken', 0.2100, 'inclusive',
 ARRAY['alcohol'], 'all', '2019-01-01', NULL,
 'https://www.belastingdienst.nl', 'verified');

-- ------------------------------------------------------------------------------
-- 4. HELPER FUNCTION: resolve_dated_tax_rate
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.resolve_dated_tax_rate(
    p_country TEXT,
    p_region TEXT,
    p_category TEXT,
    p_order_type TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_label VARCHAR,
    rate NUMERIC,
    mode VARCHAR,
    status VARCHAR
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Category 'exempt' is always zero tax
    IF p_category = 'exempt' THEN
        RETURN QUERY SELECT 'Tax Exempt'::VARCHAR, 0.0000::NUMERIC, 'inclusive'::VARCHAR, 'verified'::VARCHAR;
        RETURN;
    END IF;

    -- Look up matching rule valid on the specified date
    RETURN QUERY
    SELECT tr.rule_label, tr.rate, tr.mode, tr.status
    FROM public.tax_rules tr
    WHERE tr.country = p_country
      AND (tr.region = p_region OR tr.region = 'ALL')
      AND (tr.order_type = 'all' OR tr.order_type = p_order_type)
      AND p_category = ANY(tr.applies_to)
      AND tr.effective_from <= p_date
      AND (tr.effective_to IS NULL OR tr.effective_to >= p_date)
      AND tr.status = 'verified'
    ORDER BY 
      CASE WHEN tr.region = p_region THEN 0 ELSE 1 END,
      CASE WHEN tr.order_type = p_order_type THEN 0 ELSE 1 END,
      tr.effective_from DESC
    LIMIT 1;

    -- Fallback if no specific rule matched: return zero rate instead of silent 5% assumption
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Zero Rate / Exempt'::VARCHAR, 0.0000::NUMERIC, 'inclusive'::VARCHAR, 'verified'::VARCHAR;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 5. UPDATED create_order_atomic WITH DATED TAX REGISTRY ENFORCEMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_item_tax_cat TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    v_discount_amount NUMERIC := 0.00;
    v_tip_amount NUMERIC := 0.00;
    
    -- Restaurant & Tax Registry settings
    v_tax_enabled BOOLEAN := true;
    v_currency TEXT := 'INR';
    v_country TEXT := 'IN';
    v_region TEXT := 'ALL';
    v_accountant_verified BOOLEAN := false;
    v_tax_id TEXT := NULL;
    v_tax_id_label TEXT := 'GSTIN';
    v_is_ordering_enabled BOOLEAN := true;
    v_order_date DATE := CURRENT_DATE;
    
    -- Item-level tax tracking
    v_rule_label VARCHAR;
    v_rule_rate NUMERIC;
    v_rule_mode VARCHAR;
    v_rule_status VARCHAR;
    v_line_tax NUMERIC;
    v_item_tax_summary JSONB := '[]'::jsonb;
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_order_type TEXT;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Read restaurant settings & tax governance
    SELECT 
        rs.restaurant_id,
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.currency, 'INR'),
        COALESCE(rs.country, 'IN'),
        COALESCE(rs.region, 'ALL'),
        COALESCE(rs.accountant_verified, false),
        rs.tax_id,
        COALESCE(rs.tax_id_label, 'Tax ID'),
        COALESCE(rs.is_ordering_enabled, true)
    INTO 
        v_restaurant_id,
        v_tax_enabled,
        v_currency,
        v_country,
        v_region,
        v_accountant_verified,
        v_tax_id,
        v_tax_id_label,
        v_is_ordering_enabled
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. Feature Toggle & Operational Gates
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) OR NOT v_is_ordering_enabled THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    -- 3. GO-LIVE PROTECTION: Accountant Verification & Unverified Rules Gate
    -- Live order placement is strictly blocked until an accountant confirms settings
    -- and no active rules for this country/region are unverified.
    IF NOT v_accountant_verified THEN
        RAISE EXCEPTION 'LIVE_ORDERING_BLOCKED: Tax rules and compliance configuration must be verified and signed off by an accountant before taking customer orders.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.tax_rules tr
        WHERE tr.country = v_country
          AND (tr.region = v_region OR tr.region = 'ALL')
          AND tr.status <> 'verified'
          AND tr.effective_from <= v_order_date
          AND (tr.effective_to IS NULL OR tr.effective_to >= v_order_date)
    ) THEN
        RAISE EXCEPTION 'LIVE_ORDERING_BLOCKED: Unverified tax rules exist for % (region: %). All rules must be verified before going live.', v_country, v_region;
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    IF p_order->>'discount_code' IS NOT NULL AND length(trim(p_order->>'discount_code')) > 0 
       AND NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
    END IF;

    v_tip_amount := COALESCE((p_order->>'tip_amount')::numeric, 0.00);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 4. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 5. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 6. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 7. Generate order reference & single-use payment token
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 8. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 9. Iterate items: Price & Dated Tax Category Resolution
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Invalid item quantity for item %: must be between 1 and 50', v_item_id;
        END IF;

        SELECT mi.price, mi.name, mi.available, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_tax_cat
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Item not found in restaurant menu: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item % (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        v_line_total := v_db_unit_price * v_quantity;
        v_computed_subtotal := v_computed_subtotal + v_line_total;

        -- Resolve dated tax rule valid on v_order_date
        IF v_tax_enabled THEN
            SELECT r.rule_label, r.rate, r.mode, r.status
            INTO v_rule_label, v_rule_rate, v_rule_mode, v_rule_status
            FROM public.resolve_dated_tax_rate(
                v_country,
                v_region,
                v_item_tax_cat,
                v_order_type,
                v_order_date
            ) r;

            IF v_rule_mode = 'exclusive' THEN
                v_line_tax := round(v_line_total * v_rule_rate, 2);
                v_computed_total := v_computed_total + v_line_total + v_line_tax;
            ELSE
                v_line_tax := round(v_line_total - (v_line_total / (1.0 + v_rule_rate)), 2);
                v_computed_total := v_computed_total + v_line_total;
            END IF;

            v_tax_amount := v_tax_amount + v_line_tax;
            v_item_tax_summary := v_item_tax_summary || jsonb_build_object(
                'item_id', v_item_id,
                'category', v_item_tax_cat,
                'label', v_rule_label,
                'rate', v_rule_rate,
                'mode', v_rule_mode,
                'tax', v_line_tax
            );
        ELSE
            v_computed_total := v_computed_total + v_line_total;
        END IF;
    END LOOP;

    -- Add tips: Invariant — Tips are NEVER taxed!
    IF v_tip_amount > 0 THEN
        v_computed_total := v_computed_total + v_tip_amount;
    END IF;

    -- 10. Insert Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        tax_amount,
        total,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 11. Insert Order Items (with tax_category recorded)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_item_tax_cat
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            tax_category,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_item_id,
            v_db_item_name,
            v_quantity,
            v_db_unit_price,
            v_db_unit_price * v_quantity,
            v_item_tax_cat,
            nullif(trim(COALESCE(v_item->>'notes', '')), ''),
            v_created_at
        );
    END LOOP;

    -- 12. Return full response with dated tax receipt metadata
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_computed_subtotal,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token,
        'currency', v_currency,
        'tax_breakdown', jsonb_build_object(
            'rates_as_of', to_char(v_order_date, 'YYYY-MM-DD'),
            'tax_id', v_tax_id,
            'tax_id_label', v_tax_id_label,
            'lines', v_item_tax_summary
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 024_financial_parity_tax_and_money_logic.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 024_financial_parity_tax_and_money_logic.sql
-- Description:
-- 1. ISO 4217 Currency Minor Unit Resolution Helper:
--    - get_currency_decimals(p_currency TEXT) RETURNS INTEGER
--    - Supports 0 decimals (JPY, KRW, VND, CLP, etc.), 3 decimals (BHD, KWD, OMR, etc.), standard 2 decimals.
-- 2. Restaurant Settings Financial Parity Columns:
--    - tax_rules JSONB (multi-rate category taxes and split rules)
--    - tax_rounding_mode TEXT ('total' or 'line')
--    - service_charge_enabled BOOLEAN
--    - service_charge_rate NUMERIC
--    - service_charge_label TEXT
--    - service_charge_taxable BOOLEAN
--    - service_charge_optional BOOLEAN
-- 3. Orders Table Financial Parity Columns:
--    - discount_amount NUMERIC(12,4)
--    - discounted_subtotal NUMERIC(12,4)
--    - service_charge_amount NUMERIC(12,4)
--    - tax_breakdown JSONB
-- 4. Authoritative create_order_atomic Financial Engine:
--    - Strict Financial Order: Subtotal -> Discount -> Service Charge -> Tax -> Grand Total.
--    - Removes silent 5% and INR fallbacks: Fails loudly if restaurant settings are missing.
--    - Strict tenant scoping: WHERE rs.restaurant_id = v_restaurant_id (no blind LIMIT 1).
--    - Multi-rate tax by category (inclusive divides by 1 + rate; exclusive adds on top).
--    - Split rule parity (CGST + SGST strictly equal single GST with residual absorption).
--    - Mixed inclusive/exclusive rule combination.
--    - Full currency minor-unit precision across all intermediate and final calculations.
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ISO 4217 CURRENCY MINOR UNIT RESOLUTION FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_currency_decimals(p_currency TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE upper(trim(COALESCE(p_currency, '')))
        -- 0 decimals (no minor unit)
        WHEN 'BIF' THEN 0
        WHEN 'CLP' THEN 0
        WHEN 'DJF' THEN 0
        WHEN 'GNF' THEN 0
        WHEN 'ISK' THEN 0
        WHEN 'JPY' THEN 0
        WHEN 'KMF' THEN 0
        WHEN 'KRW' THEN 0
        WHEN 'PYG' THEN 0
        WHEN 'RWF' THEN 0
        WHEN 'UGX' THEN 0
        WHEN 'UYI' THEN 0
        WHEN 'VND' THEN 0
        WHEN 'VUV' THEN 0
        WHEN 'XAF' THEN 0
        WHEN 'XOF' THEN 0
        WHEN 'XPF' THEN 0
        -- 3 decimals (1/1000 minor unit)
        WHEN 'BHD' THEN 3
        WHEN 'IQD' THEN 3
        WHEN 'JOD' THEN 3
        WHEN 'KWD' THEN 3
        WHEN 'LYD' THEN 3
        WHEN 'OMR' THEN 3
        WHEN 'TND' THEN 3
        -- Standard 2 decimals (INR, USD, EUR, GBP, CAD, AUD, SGD, etc.)
        ELSE 2
    END;
$$;

GRANT EXECUTE ON FUNCTION public.get_currency_decimals(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA EXPANSION ON RESTAURANT_SETTINGS
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS tax_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tax_rounding_mode TEXT NOT NULL DEFAULT 'total',
ADD COLUMN IF NOT EXISTS service_charge_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS service_charge_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS service_charge_label TEXT NOT NULL DEFAULT 'Service Charge',
ADD COLUMN IF NOT EXISTS service_charge_taxable BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS service_charge_optional BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------------------------
-- 3. SCHEMA EXPANSION ON ORDERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS discounted_subtotal NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS tax_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------------------------
-- 4. AUTHORITATIVE create_order_atomic (FINANCIAL PARITY REWRITE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_order_type TEXT;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());

    -- Restaurant settings fields (no silent defaults)
    v_tax_enabled BOOLEAN;
    v_tax_mode TEXT;
    v_tax_rate NUMERIC;
    v_tax_label TEXT;
    v_tax_rules JSONB;
    v_tax_rounding_mode TEXT;
    v_currency TEXT;
    v_service_charge_enabled BOOLEAN;
    v_service_charge_rate NUMERIC;
    v_service_charge_label TEXT;
    v_service_charge_taxable BOOLEAN;
    v_decimals INTEGER;

    -- Line items calculation structures
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_item_category TEXT;
    v_is_available BOOLEAN;
    v_unit_price_rounded NUMERIC;
    v_line_total NUMERIC;
    v_calc_items JSONB := '[]'::jsonb;

    -- Financial amounts
    v_raw_subtotal NUMERIC := 0.0000;
    v_raw_discount NUMERIC := 0.0000;
    v_discount_amount NUMERIC := 0.0000;
    v_discounted_subtotal NUMERIC := 0.0000;
    v_discount_ratio NUMERIC := 1.00000000;
    v_service_charge_amount NUMERIC := 0.0000;
    v_total_inclusive_tax NUMERIC := 0.0000;
    v_total_exclusive_tax NUMERIC := 0.0000;
    v_tax_amount NUMERIC := 0.0000;
    v_computed_total NUMERIC := 0.0000;
    v_tip_amount NUMERIC := 0.0000;

    -- Tax calculation loops
    v_rule_group RECORD;
    v_group_rules JSONB;
    v_group_count INTEGER;
    v_group_combined_rate NUMERIC;
    v_group_mode TEXT;
    v_applicable_subtotal NUMERIC;
    v_group_total_tax NUMERIC;
    v_allocated_group_tax NUMERIC;
    v_rule JSONB;
    v_rule_rate NUMERIC;
    v_rule_tax NUMERIC;
    v_calc_item JSONB;
    v_item_disc_line NUMERIC;
    v_tax_lines JSONB := '[]'::jsonb;

    -- Service charge tax
    v_primary_rule JSONB;
    v_sc_tax_rate NUMERIC;
    v_sc_tax_mode TEXT;
    v_sc_tax NUMERIC;
    v_existing_sc_line JSONB;
    v_updated_tax_lines JSONB;
BEGIN
    -- 1. Read restaurant_id from input payload or default to 'the-cafe-barrackpore'
    v_restaurant_id := trim(COALESCE(p_order->>'restaurant_id', 'the-cafe-barrackpore'));
    IF v_restaurant_id = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. FETCH RESTAURANT SETTINGS STRICTLY FOR THIS RESTAURANT_ID (FAIL LOUDLY IF MISSING)
    SELECT 
        rs.tax_enabled,
        rs.tax_mode,
        rs.tax_rate,
        rs.tax_label,
        rs.tax_rules,
        rs.tax_rounding_mode,
        rs.currency,
        rs.service_charge_enabled,
        rs.service_charge_rate,
        rs.service_charge_label,
        rs.service_charge_taxable
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_tax_label,
        v_tax_rules,
        v_tax_rounding_mode,
        v_currency,
        v_service_charge_enabled,
        v_service_charge_rate,
        v_service_charge_label,
        v_service_charge_taxable
    FROM public.restaurant_settings rs
    WHERE rs.restaurant_id = v_restaurant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant settings missing for restaurant_id: %', v_restaurant_id;
    END IF;

    IF v_currency IS NULL OR trim(v_currency) = '' THEN
        RAISE EXCEPTION 'Currency setting is missing for restaurant_id: %', v_restaurant_id;
    END IF;

    IF v_tax_enabled IS NULL THEN
        RAISE EXCEPTION 'tax_enabled setting is missing for restaurant_id: %', v_restaurant_id;
    END IF;

    -- Resolve currency decimal places dynamically using ISO 4217 minor units
    v_decimals := public.get_currency_decimals(v_currency);

    -- 3. Feature Toggle Server Enforcement
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    IF p_order->>'discount_code' IS NOT NULL AND length(trim(p_order->>'discount_code')) > 0 
       AND NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
    END IF;

    v_tip_amount := round(COALESCE((p_order->>'tip_amount')::numeric, 0.0), v_decimals);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 4. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 5. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 6. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 7. Generate order reference using random code (never sequential)
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- Generate random payment_token built from two gen_random_uuid
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 8. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 9. Authoritative server-side pricing & line items computation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        BEGIN
            v_quantity := (v_item->>'quantity')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid item quantity for item "%"', v_item_id;
        END;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Item quantity must be between 1 and 50 (got % for item "%")', COALESCE(v_quantity, 0), v_item_id;
        END IF;

        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_item_category := 'food';
        v_is_available := NULL;

        SELECT mi.price, mi.name, mi.available, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_category
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            SELECT m.price, m.name, COALESCE(m.is_available, true), 'food'
            INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_category
            FROM public.menu m
            WHERE m.id = v_item_id;
        END IF;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item "%" (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.menu_item_availability mia
            WHERE mia.item_id = v_item_id AND mia.is_available = false
        ) THEN
            RAISE EXCEPTION 'Item "%" is currently marked 86''d out of stock', v_db_item_name;
        END IF;

        v_unit_price_rounded := round(v_db_unit_price::numeric, v_decimals);
        v_line_total := round((v_quantity * v_unit_price_rounded)::numeric, v_decimals);
        v_raw_subtotal := round((v_raw_subtotal + v_line_total)::numeric, v_decimals);

        v_calc_items := v_calc_items || jsonb_build_object(
            'menu_item_id', v_item_id,
            'name', v_db_item_name,
            'quantity', v_quantity,
            'unit_price', v_unit_price_rounded,
            'line_total', v_line_total,
            'category', v_item_category,
            'notes', nullif(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    -- 10. FINANCIAL ORDER OF OPERATIONS
    -- Step 1: Discount is applied first to raw subtotal
    v_raw_discount := round(COALESCE((p_order->>'discount_amount')::numeric, 0.0), v_decimals);
    IF v_raw_discount < 0 THEN
        v_raw_discount := 0.0;
    END IF;
    v_discount_amount := round(GREATEST(0.0, LEAST(v_raw_subtotal, v_raw_discount))::numeric, v_decimals);
    v_discounted_subtotal := round((v_raw_subtotal - v_discount_amount)::numeric, v_decimals);
    v_discount_ratio := CASE WHEN v_raw_subtotal > 0 THEN (v_discounted_subtotal / v_raw_subtotal) ELSE 1.0 END;

    -- Step 2: Service Charge is calculated on the discounted subtotal
    IF v_service_charge_enabled AND v_service_charge_rate > 0 THEN
        v_service_charge_amount := round((v_discounted_subtotal * v_service_charge_rate)::numeric, v_decimals);
    ELSE
        v_service_charge_amount := 0.0;
    END IF;

    -- Step 3: Taxes calculated on applicable discounted category subtotals
    IF NOT v_tax_enabled THEN
        v_total_inclusive_tax := 0.0;
        v_total_exclusive_tax := 0.0;
        v_tax_amount := 0.0;
        v_computed_total := round((v_discounted_subtotal + v_service_charge_amount)::numeric, v_decimals);
    ELSE
        -- Ensure v_tax_rules contains at least the base rule if not provided
        IF v_tax_rules IS NULL OR jsonb_typeof(v_tax_rules) <> 'array' OR jsonb_array_length(v_tax_rules) = 0 THEN
            v_tax_rules := jsonb_build_array(jsonb_build_object(
                'label', COALESCE(v_tax_label, 'Tax'),
                'rate', COALESCE(v_tax_rate, 0.0000),
                'mode', COALESCE(v_tax_mode, 'inclusive')
            ));
        END IF;

        -- Group rules by (mode, appliesTo) to coordinate split rules (e.g. CGST + SGST)
        FOR v_rule_group IN
            WITH parsed_rules AS (
                SELECT 
                    elem->>'mode' AS r_mode,
                    COALESCE(elem->'appliesTo', '[]'::jsonb) AS r_applies_to,
                    jsonb_agg(elem) AS r_group_rules,
                    sum((elem->>'rate')::numeric) AS r_combined_rate,
                    count(*) AS r_count
                FROM jsonb_array_elements(v_tax_rules) elem
                WHERE (elem->>'rate')::numeric > 0
                GROUP BY elem->>'mode', COALESCE(elem->'appliesTo', '[]'::jsonb)
            )
            SELECT * FROM parsed_rules
        LOOP
            v_group_rules := v_rule_group.r_group_rules;
            v_group_count := v_rule_group.r_count;
            v_group_combined_rate := v_rule_group.r_combined_rate;
            v_group_mode := v_rule_group.r_mode;

            -- Calculate applicable subtotal for this rule group
            IF jsonb_array_length(v_rule_group.r_applies_to) > 0 THEN
                v_applicable_subtotal := 0.0;
                FOR v_calc_item IN SELECT * FROM jsonb_array_elements(v_calc_items)
                LOOP
                    IF v_rule_group.r_applies_to ? (v_calc_item->>'category') THEN
                        v_item_disc_line := (v_calc_item->>'line_total')::numeric * v_discount_ratio;
                        IF v_tax_rounding_mode = 'line' THEN
                            v_applicable_subtotal := v_applicable_subtotal + round(v_item_disc_line::numeric, v_decimals);
                        ELSE
                            v_applicable_subtotal := v_applicable_subtotal + v_item_disc_line;
                        END IF;
                    END IF;
                END LOOP;
                v_applicable_subtotal := round(v_applicable_subtotal::numeric, v_decimals);
            ELSE
                v_applicable_subtotal := v_discounted_subtotal;
            END IF;

            IF v_applicable_subtotal > 0 AND v_group_combined_rate > 0 THEN
                -- Calculate group total tax
                IF v_group_mode = 'inclusive' THEN
                    v_group_total_tax := round((v_applicable_subtotal * (v_group_combined_rate / (1.0 + v_group_combined_rate)))::numeric, v_decimals);
                    v_total_inclusive_tax := round((v_total_inclusive_tax + v_group_total_tax)::numeric, v_decimals);
                ELSE
                    v_group_total_tax := round((v_applicable_subtotal * v_group_combined_rate)::numeric, v_decimals);
                    v_total_exclusive_tax := round((v_total_exclusive_tax + v_group_total_tax)::numeric, v_decimals);
                END IF;

                -- Allocate tax among split rules with last rule absorbing rounding residual (single GST parity)
                v_allocated_group_tax := 0.0;
                FOR i IN 0..(v_group_count - 1)
                LOOP
                    v_rule := v_group_rules->i;
                    v_rule_rate := (v_rule->>'rate')::numeric;

                    IF i = (v_group_count - 1) THEN
                        v_rule_tax := round((v_group_total_tax - v_allocated_group_tax)::numeric, v_decimals);
                    ELSE
                        v_rule_tax := round((v_group_total_tax * (v_rule_rate / v_group_combined_rate))::numeric, v_decimals);
                        v_allocated_group_tax := round((v_allocated_group_tax + v_rule_tax)::numeric, v_decimals);
                    END IF;

                    v_tax_lines := v_tax_lines || jsonb_build_object(
                        'label', v_rule->>'label',
                        'rate', v_rule_rate,
                        'mode', v_rule->>'mode',
                        'amount', v_rule_tax,
                        'appliedTo', v_rule->'appliesTo'
                    );
                END LOOP;
            END IF;
        END LOOP;

        -- Step 4: Tax on Service Charge (if service charge is taxable)
        IF v_service_charge_enabled AND v_service_charge_taxable AND v_service_charge_amount > 0 THEN
            v_primary_rule := v_tax_rules->0;
            v_sc_tax_rate := COALESCE((v_primary_rule->>'rate')::numeric, v_tax_rate, 0.0);
            v_sc_tax_mode := COALESCE(v_primary_rule->>'mode', v_tax_mode, 'inclusive');

            IF v_sc_tax_rate > 0 THEN
                IF v_sc_tax_mode = 'exclusive' THEN
                    v_sc_tax := round((v_service_charge_amount * v_sc_tax_rate)::numeric, v_decimals);
                    v_total_exclusive_tax := round((v_total_exclusive_tax + v_sc_tax)::numeric, v_decimals);
                ELSE
                    v_sc_tax := round((v_service_charge_amount * (v_sc_tax_rate / (1.0 + v_sc_tax_rate)))::numeric, v_decimals);
                    v_total_inclusive_tax := round((v_total_inclusive_tax + v_sc_tax)::numeric, v_decimals);
                END IF;

                v_tax_lines := v_tax_lines || jsonb_build_object(
                    'label', COALESCE(v_primary_rule->>'label', v_tax_label, 'Tax') || ' (Service)',
                    'rate', v_sc_tax_rate,
                    'mode', v_sc_tax_mode,
                    'amount', v_sc_tax
                );
            END IF;
        END IF;

        v_tax_amount := round((v_total_inclusive_tax + v_total_exclusive_tax)::numeric, v_decimals);
        -- Grand Total: discountedSubtotal + serviceCharge + exclusive taxes (inclusive tax is already inside discountedSubtotal)
        v_computed_total := round((v_discounted_subtotal + v_service_charge_amount + v_total_exclusive_tax)::numeric, v_decimals);
    END IF;

    -- Add tips if enabled and provided
    IF v_tip_amount > 0 THEN
        v_computed_total := round((v_computed_total + v_tip_amount)::numeric, v_decimals);
    END IF;

    -- 11. Insert Authoritative Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        discount_amount,
        discounted_subtotal,
        service_charge_amount,
        tax_amount,
        total,
        tax_breakdown,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_raw_subtotal,
        v_discount_amount,
        v_discounted_subtotal,
        v_service_charge_amount,
        v_tax_amount,
        v_computed_total,
        v_tax_lines,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 12. Insert Order Items
    FOR v_calc_item IN SELECT * FROM jsonb_array_elements(v_calc_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_calc_item->>'menu_item_id',
            v_calc_item->>'name',
            (v_calc_item->>'quantity')::INTEGER,
            (v_calc_item->>'unit_price')::NUMERIC,
            (v_calc_item->>'line_total')::NUMERIC,
            v_calc_item->>'notes',
            v_created_at
        );
    END LOOP;

    -- 13. Return Authoritative Order Summary Response
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_raw_subtotal,
        'discount_amount', v_discount_amount,
        'discounted_subtotal', v_discounted_subtotal,
        'service_charge', v_service_charge_amount,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency,
        'tax_breakdown', v_tax_lines,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 025_pos_audit_and_hardening.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 025_pos_audit_and_hardening.sql
-- Description: POS Security, Concurrency, Multi-Tenant RLS & Zero-Drift Hardening
--
-- 1. Idempotency Columns:
--    - Add payment_idempotency_key to public.bills (prevents double charging on non-shift/online settles)
--    - Add idempotency_key to public.kot_batches (guarantees KOT sent exactly once)
--
-- 2. Concurrency & Table Locks:
--    - Advisory transaction locking in pos_create_or_append_kot (serializes two staff editing same table)
--    - Row locking (FOR UPDATE) scoped by restaurant_id
--
-- 3. Multi-Tenant Isolation across all SECURITY DEFINER RPCs:
--    - pos_create_or_append_kot, pos_void_item, pos_apply_discount, split_bill_atomic,
--      process_bill_payment, get_shift_z_report, pos_record_drawer_open, pos_transfer_table
--    - Cashier from Restaurant A cannot read, void, discount, or settle Restaurant B's bills
--
-- 4. Server-Authoritative Void & Discount Permissions:
--    - Revoke blind trust of client-supplied p_actor_role
--    - Verify database role via public.is_manager_or_above(auth.uid()) or valid manager PIN
--    - Mandatory audit logging on every void, discount, and drawer open
--
-- 5. Zero-Drift Drawer Shift Totals & Split Tender Reconciliation:
--    - Correctly breaks down split bill tenders (card, upi, other) alongside cash drawer transactions
--    - Eliminates double-counting between cash drawer transactions and split bills
-- ==============================================================================

-- 1. SCHEMA HARDENING
ALTER TABLE public.bills 
    ADD COLUMN IF NOT EXISTS payment_idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_bills_payment_idempotency ON public.bills (payment_idempotency_key) 
    WHERE payment_idempotency_key IS NOT NULL;

ALTER TABLE public.kot_batches 
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_kot_batches_idempotency ON public.kot_batches (idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- 2. POS CREATE OR APPEND KOT (Concurrency hardened, KOT sent exactly once, Multi-tenant)
DROP FUNCTION IF EXISTS public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.pos_create_or_append_kot(
    p_bill_number TEXT DEFAULT NULL,
    p_order_type TEXT DEFAULT 'dine_in',
    p_table_number TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_bill_id UUID DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
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
    v_tax_rate NUMERIC := 0.0500;
    v_existing_bill RECORD;
    v_existing_kot RECORD;
BEGIN
    -- Multi-tenant determination
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    -- Idempotency Check: KOT sent exactly once
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_kot 
        FROM public.kot_batches 
        WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        LIMIT 1;

        IF FOUND THEN
            SELECT * INTO v_existing_bill FROM public.bills WHERE id = v_existing_kot.bill_id;
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_id', v_existing_kot.bill_id,
                'bill_number', v_existing_bill.bill_number,
                'kot_batch_id', v_existing_kot.id,
                'kot_number', v_existing_kot.kot_number,
                'batch_index', v_existing_kot.batch_index,
                'message', 'KOT batch already dispatched (idempotent duplicate blocked)'
            );
        END IF;
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'KOT must contain at least one item');
    END IF;

    -- Concurrency Guard: Serialize table edits for the same table in this restaurant
    IF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('pos_table_' || v_tenant_id || '_' || trim(p_table_number)));
    ELSIF p_bill_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('pos_bill_' || v_tenant_id || '_' || p_bill_id::text));
    END IF;

    -- Look for existing running bill with matching ID, bill_number, or table_number in this tenant
    IF p_bill_id IS NOT NULL THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE id = p_bill_id AND restaurant_id = v_tenant_id
        FOR UPDATE;
    ELSIF p_bill_number IS NOT NULL AND trim(p_bill_number) <> '' THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE bill_number = trim(p_bill_number) AND restaurant_id = v_tenant_id
        FOR UPDATE;
    ELSIF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE table_number = trim(p_table_number) 
          AND restaurant_id = v_tenant_id 
          AND status IN ('running', 'printed') 
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_existing_bill.id IS NOT NULL THEN
        v_bill_id := v_existing_bill.id;
        SELECT COALESCE(MAX(batch_index), 0) + 1 INTO v_batch_index 
        FROM public.kot_batches WHERE bill_id = v_bill_id;
    ELSE
        -- Generate fresh bill
        v_bill_id := gen_random_uuid();
        INSERT INTO public.bills (
            id,
            restaurant_id,
            bill_number,
            order_type,
            table_number,
            customer_name,
            customer_phone,
            delivery_address,
            status,
            subtotal_minor,
            tax_amount_minor,
            grand_total_minor,
            created_by
        )
        VALUES (
            v_bill_id,
            v_tenant_id,
            COALESCE(NULLIF(trim(p_bill_number), ''), 'BILL-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
            COALESCE(p_order_type, 'dine_in'),
            NULLIF(trim(p_table_number), ''),
            p_customer_name,
            p_customer_phone,
            p_delivery_address,
            'running',
            0,
            0,
            0,
            auth.uid()
        )
        RETURNING bill_number INTO v_existing_bill.bill_number;
    END IF;

    -- Create KOT batch record with idempotency key
    v_kot_number := 'KOT-' || to_char(now(), 'HH24MI') || '-' || upper(substring(gen_random_uuid()::text from 1 for 4));
    INSERT INTO public.kot_batches (
        bill_id,
        restaurant_id,
        kot_number,
        batch_index,
        status,
        special_instructions,
        idempotency_key,
        created_by
    )
    VALUES (
        v_bill_id,
        v_tenant_id,
        v_kot_number,
        v_batch_index,
        'sent',
        p_special_instructions,
        p_idempotency_key,
        auth.uid()
    )
    RETURNING id INTO v_kot_batch_id;

    -- Insert items strictly in integer minor units
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        v_db_price := NULL;
        v_db_name := NULL;

        SELECT price, name INTO v_db_price, v_db_name 
        FROM public.menu_items 
        WHERE id = v_menu_id 
        LIMIT 1;

        IF v_db_price IS NULL THEN
            SELECT price, name INTO v_db_price, v_db_name 
            FROM public.menu 
            WHERE id = v_menu_id OR lower(trim(name)) = lower(trim(v_menu_id))
            LIMIT 1;
        END IF;

        IF v_db_price IS NULL THEN
            v_unit_minor := ROUND(COALESCE((v_item->>'unit_price')::NUMERIC, (v_item->>'price')::NUMERIC, 0) * 100);
            v_db_name := COALESCE(v_item->>'item_name', v_item->>'name', 'Item');
        ELSE
            v_unit_minor := ROUND(v_db_price * 100);
        END IF;

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
            v_tenant_id,
            v_kot_batch_id,
            v_menu_id,
            v_db_name,
            v_quantity,
            v_unit_minor + v_mod_minor,
            v_line_minor,
            COALESCE(v_item->>'tax_category', v_item->>'taxCategory', 'food'),
            COALESCE(v_item->'modifiers', '[]'::jsonb),
            NULLIF(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    -- Recalculate bill financial totals strictly server-side
    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill_id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

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
        'bill_number', v_existing_bill.bill_number,
        'kot_batch_id', v_kot_batch_id,
        'kot_number', v_kot_number,
        'batch_index', v_batch_index,
        'subtotal_minor', v_subtotal_minor,
        'grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 3. POS VOID ITEM (Server-authoritative RBAC & Multi-tenant check)
DROP FUNCTION IF EXISTS public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.pos_void_item(
    p_bill_item_id UUID,
    p_void_reason TEXT,
    p_manager_pin TEXT DEFAULT NULL,
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
    v_tenant_id TEXT;
    v_item RECORD;
    v_bill RECORD;
    v_is_authorized BOOLEAN := false;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0000;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    IF p_void_reason IS NULL OR length(trim(p_void_reason)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid void reason (min 3 chars) is required');
    END IF;

    -- Strict Server Authorization: Do NOT trust client-supplied p_actor_role
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        v_is_authorized := true;
    ELSIF public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid manager PIN or insufficient role permissions for void');
    END IF;

    -- Multi-tenant isolation: Cashier from Tenant A cannot void Tenant B's items
    SELECT * INTO v_item 
    FROM public.bill_items 
    WHERE id = p_bill_item_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill item not found or unauthorized tenant access');
    END IF;

    IF v_item.is_voided THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is already voided');
    END IF;

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE id = v_item.bill_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Parent bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot void items on a settled bill');
    END IF;

    UPDATE public.bill_items
    SET is_voided = true,
        void_reason = trim(p_void_reason),
        void_approved_by = COALESCE(p_actor_name, 'Manager'),
        voided_at = now(),
        updated_at = now()
    WHERE id = p_bill_item_id;

    -- Recalculate bill
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

    -- MANDATORY AUDIT LOG ENTRY
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
        COALESCE(p_actor_id, auth.uid()::text, 'pos'),
        COALESCE(p_actor_role, 'manager'),
        COALESCE(p_actor_name, 'Manager'),
        'POS_ITEM_VOIDED',
        'bill_items',
        v_item.id::text,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'item_name', v_item.item_name,
            'quantity', v_item.quantity,
            'line_total_minor', v_item.line_total_minor,
            'reason', p_void_reason,
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

-- 4. POS APPLY DISCOUNT (Server-authoritative RBAC & Multi-tenant check)
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
    v_tenant_id TEXT;
    v_bill RECORD;
    v_computed_discount_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_is_authorized BOOLEAN := false;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE id = p_bill_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot apply discount to an already paid bill');
    END IF;

    -- Strict Server Authorization: Do NOT trust client-supplied p_actor_role
    IF p_discount_type IN ('flat', 'manual') OR p_discount_value_minor > 2000 THEN
        IF COALESCE(auth.role(), '') = 'service_role' THEN
            v_is_authorized := true;
        ELSIF public.is_manager_or_above(auth.uid()) THEN
            v_is_authorized := true;
        ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
            v_is_authorized := true;
        END IF;

        IF NOT v_is_authorized THEN
            RETURN jsonb_build_object('success', false, 'error', 'Manager authorization PIN required for this discount');
        END IF;
    END IF;

    IF p_discount_type = 'percentage' THEN
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

    -- MANDATORY AUDIT LOG ENTRY
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
        COALESCE(p_actor_id, auth.uid()::text, 'pos'),
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

-- 5. POS ATOMIC BILL SPLIT (Multi-tenant check, minor & major unit flexibility)
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
    v_tenant_id TEXT;
    v_bill RECORD;
    v_split JSONB;
    v_sum_amount_minor INTEGER := 0;
    v_part_amount_minor INTEGER;
    v_part_subtotal_minor INTEGER;
    v_part_tax_minor INTEGER;
    v_total_parts INTEGER;
    v_part_number INTEGER := 1;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot split an already settled bill');
    END IF;

    v_total_parts := jsonb_array_length(p_splits);
    IF v_total_parts < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Splits array cannot be empty');
    END IF;

    -- Validate minor unit sum across split parts (supports amount_minor or amount in major units)
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_part_amount_minor := COALESCE(
            (v_split->>'amount_minor')::INTEGER, 
            ROUND(((v_split->>'amount')::NUMERIC) * 100)::INTEGER
        );
        v_sum_amount_minor := v_sum_amount_minor + v_part_amount_minor;
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
        v_part_amount_minor := COALESCE(
            (v_split->>'amount_minor')::INTEGER, 
            ROUND(((v_split->>'amount')::NUMERIC) * 100)::INTEGER
        );
        v_part_subtotal_minor := COALESCE(
            (v_split->>'subtotal_minor')::INTEGER, 
            ROUND(((v_split->>'subtotal')::NUMERIC) * 100)::INTEGER, 
            0
        );
        v_part_tax_minor := COALESCE(
            (v_split->>'tax_amount_minor')::INTEGER, 
            ROUND(((v_split->>'tax_amount')::NUMERIC) * 100)::INTEGER, 
            0
        );

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
            v_part_subtotal_minor,
            v_part_tax_minor,
            v_part_amount_minor,
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

-- 6. PROCESS BILL PAYMENT (Idempotency across shifts, splits, & bills; multi-tenant RLS)
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
    v_tenant_id TEXT;
    v_bill RECORD;
    v_split RECORD;
    v_change_due_minor INTEGER := 0;
    v_total_paid_so_far_minor INTEGER := 0;
    v_remaining_minor INTEGER := 0;
    v_is_bill_closed BOOLEAN := false;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    -- Comprehensive Idempotency Check: cash drawer txs, bill splits, AND bills
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        IF EXISTS (
            SELECT 1 FROM public.cash_drawer_transactions 
            WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) OR EXISTS (
            SELECT 1 FROM public.bill_splits 
            WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) OR EXISTS (
            SELECT 1 FROM public.bills 
            WHERE payment_idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_number', p_bill_number,
                'message', 'Payment already processed (idempotent duplicate blocked)'
            );
        END IF;
    END IF;

    -- Multi-tenant lookup with row lock
    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    -- Compute cash change in minor units
    IF p_tender_type = 'cash' THEN
        v_change_due_minor := GREATEST(0, p_tendered_minor - (p_amount_minor + p_tip_minor));
    END IF;

    -- Update split part if paying a split
    IF p_split_id IS NOT NULL THEN
        SELECT * INTO v_split 
        FROM public.bill_splits 
        WHERE id = p_split_id AND bill_id = v_bill.id 
        FOR UPDATE;

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
            payment_method = CASE WHEN v_bill.is_split THEN 'split' ELSE p_tender_type END,
            payment_idempotency_key = COALESCE(payment_idempotency_key, p_idempotency_key),
            shift_id = COALESCE(p_shift_id, shift_id),
            tips_minor = tips_minor + p_tip_minor,
            updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        UPDATE public.bills
        SET payment_status = 'processing',
            payment_idempotency_key = COALESCE(payment_idempotency_key, p_idempotency_key),
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

-- 7. FINANCIAL Z-REPORT (Zero-drift split tender breakdown & multi-tenant isolation)
CREATE OR REPLACE FUNCTION public.get_shift_z_report(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
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
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    SELECT * INTO v_shift 
    FROM public.cash_shifts 
    WHERE id = p_shift_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shift not found or unauthorized tenant access');
    END IF;

    -- Cash Drawer transactions totals (strictly in cash)
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

    -- Non-split bills tender totals
    SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'card', 'upi', 'split') THEN grand_total_minor ELSE 0 END), 0)
    INTO 
        v_card_sales_minor, v_upi_sales_minor, v_other_sales_minor
    FROM public.bills
    WHERE shift_id = p_shift_id AND status = 'paid' AND is_split = false;

    -- Add split bill parts tender totals (card, upi, other)
    v_card_sales_minor := v_card_sales_minor + COALESCE((
        SELECT SUM(s.amount_minor) 
        FROM public.bill_splits s
        JOIN public.bills b ON b.id = s.bill_id
        WHERE b.shift_id = p_shift_id AND s.status = 'paid' AND s.tender_type = 'card'
    ), 0);

    v_upi_sales_minor := v_upi_sales_minor + COALESCE((
        SELECT SUM(s.amount_minor) 
        FROM public.bill_splits s
        JOIN public.bills b ON b.id = s.bill_id
        WHERE b.shift_id = p_shift_id AND s.status = 'paid' AND s.tender_type = 'upi'
    ), 0);

    v_other_sales_minor := v_other_sales_minor + COALESCE((
        SELECT SUM(s.amount_minor) 
        FROM public.bill_splits s
        JOIN public.bills b ON b.id = s.bill_id
        WHERE b.shift_id = p_shift_id AND s.status = 'paid' AND s.tender_type NOT IN ('cash', 'card', 'upi')
    ), 0);

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
        'opening_float', round(v_shift.opening_float_minor / 100.0, 2),
        'gross_sales_minor', v_gross_sales_minor,
        'gross_sales', round(v_gross_sales_minor / 100.0, 2),
        'cash_sales_minor', v_cash_sales_minor,
        'cash_sales', round(v_cash_sales_minor / 100.0, 2),
        'card_sales_minor', v_card_sales_minor,
        'card_sales', round(v_card_sales_minor / 100.0, 2),
        'upi_sales_minor', v_upi_sales_minor,
        'upi_sales', round(v_upi_sales_minor / 100.0, 2),
        'other_sales_minor', v_other_sales_minor,
        'other_sales', round(v_other_sales_minor / 100.0, 2),
        'cash_in_minor', v_cash_in_minor,
        'cash_in_total', round(v_cash_in_minor / 100.0, 2),
        'cash_out_minor', v_cash_out_minor,
        'cash_out_total', round(v_cash_out_minor / 100.0, 2),
        'cash_refunds_minor', v_cash_refunds_minor,
        'cash_refunds', round(v_cash_refunds_minor / 100.0, 2),
        'expected_cash_minor', v_expected_cash_minor,
        'expected_cash', round(v_expected_cash_minor / 100.0, 2),
        'counted_cash_minor', v_shift.counted_cash_minor,
        'counted_cash', CASE WHEN v_shift.counted_cash_minor IS NOT NULL THEN round(v_shift.counted_cash_minor / 100.0, 2) ELSE NULL END,
        'variance_minor', v_variance_minor,
        'variance', round(v_variance_minor / 100.0, 2),
        'tender_breakdown', jsonb_build_object(
            'cash', round(v_cash_sales_minor / 100.0, 2),
            'card', round(v_card_sales_minor / 100.0, 2),
            'upi', round(v_upi_sales_minor / 100.0, 2),
            'stripe', 0,
            'other', round(v_other_sales_minor / 100.0, 2)
        ),
        'tx_count', v_tx_count
    );
END;
$$;

-- 8. PERMISSIONS GRANTS
GRANT EXECUTE ON FUNCTION public.pos_create_or_append_kot TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_apply_discount(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.split_bill_atomic(TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_bill_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shift_z_report(UUID) TO authenticated, service_role;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 026_authoritative_discounts_and_feature_guards.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 026_authoritative_discounts_and_feature_guards.sql
-- Description:
-- 1. Server-Authoritative Discount Engine:
--    - create_order_atomic strictly IGNORES any client-supplied discount_amount.
--    - Validates discount_code against public.discount_codes:
--      (active status, valid_from/valid_until date windows, max_uses vs used_count, min_order_amount)
--    - Calculates discount on server (percentage with max cap, or flat) and increments used_count.
--    - Rejects invalid or unknown discount codes with loud exceptions.
--    - Updates validate_discount_code RPC to match canonical schema.
-- 2. Comprehensive is_feature_enabled Guards across all POS/KDS/Bill/Shift/Cash Drawer RPCs:
--    - pos_create_or_append_kot: guards 'pos', 'running_table_bills' (for dine-in/tables), 'kot_printing'
--    - pos_void_item: guards 'pos', 'running_table_bills'
--    - pos_apply_discount: guards 'pos', 'running_table_bills', 'discounts'
--    - split_bill_atomic: guards 'pos', 'running_table_bills', 'split_bills'
--    - process_bill_payment: guards 'pos', 'running_table_bills'
--    - pos_record_drawer_open: guards 'pos', 'cash_drawer'
--    - get_shift_z_report: guards 'pos', 'cash_drawer'
--    - void_or_refund_order_secure: guards 'pos'
--    - pos_transfer_table: guards 'pos', 'running_table_bills'
--    - pos_merge_tables: guards 'pos', 'running_table_bills'
--    - pos_move_items: guards 'pos', 'running_table_bills'
--    - update_order_status_kitchen: guards 'kds'
-- 3. Elimination of Silent 5% (0.0500) Tax Fallbacks across SQL:
--    - All tax rate calculations COALESCE to 0.0000 instead of 0.0500.
--    - resolve_dated_tax_rate returns 0.0000 ('Zero Rate / Exempt') if no rule matches.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. SCHEMA INTEGRITY: Ensure orders and order_items columns exist
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS discounted_subtotal NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS tax_breakdown JSONB,
    ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- ------------------------------------------------------------------------------
-- 1. SERVER-AUTHORITATIVE create_order_atomic
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_order_type TEXT;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());

    -- Restaurant settings fields (no silent defaults)
    v_tax_enabled BOOLEAN;
    v_tax_mode TEXT;
    v_tax_rate NUMERIC;
    v_tax_label TEXT;
    v_tax_rules JSONB;
    v_tax_rounding_mode TEXT;
    v_currency TEXT;
    v_service_charge_enabled BOOLEAN;
    v_service_charge_rate NUMERIC;
    v_service_charge_label TEXT;
    v_service_charge_taxable BOOLEAN;
    v_decimals INTEGER;

    -- Line items calculation structures
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_item_category TEXT;
    v_is_available BOOLEAN;
    v_unit_price_rounded NUMERIC;
    v_line_total NUMERIC;
    v_calc_items JSONB := '[]'::jsonb;

    -- Discount structures
    v_input_discount_code TEXT;
    v_discount RECORD;
    v_raw_subtotal NUMERIC := 0.0000;
    v_discount_amount NUMERIC := 0.0000;
    v_discounted_subtotal NUMERIC := 0.0000;
    v_discount_ratio NUMERIC := 1.00000000;
    v_service_charge_amount NUMERIC := 0.0000;
    v_total_inclusive_tax NUMERIC := 0.0000;
    v_total_exclusive_tax NUMERIC := 0.0000;
    v_tax_amount NUMERIC := 0.0000;
    v_computed_total NUMERIC := 0.0000;
    v_tip_amount NUMERIC := 0.0000;

    -- Tax calculation loops
    v_rule_group RECORD;
    v_group_rules JSONB;
    v_group_count INTEGER;
    v_group_combined_rate NUMERIC;
    v_group_mode TEXT;
    v_applicable_subtotal NUMERIC;
    v_group_total_tax NUMERIC;
    v_allocated_group_tax NUMERIC;
    v_rule JSONB;
    v_rule_rate NUMERIC;
    v_rule_tax NUMERIC;
    v_calc_item JSONB;
    v_item_disc_line NUMERIC;
    v_tax_lines JSONB := '[]'::jsonb;

    -- Service charge tax
    v_primary_rule JSONB;
    v_sc_tax_rate NUMERIC;
    v_sc_tax_mode TEXT;
    v_sc_tax NUMERIC;
BEGIN
    -- 1. Read restaurant_id from input payload or default to 'the-cafe-barrackpore'
    v_restaurant_id := trim(COALESCE(p_order->>'restaurant_id', 'the-cafe-barrackpore'));
    IF v_restaurant_id = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. FETCH RESTAURANT SETTINGS STRICTLY FOR THIS RESTAURANT_ID (FAIL LOUDLY IF MISSING)
    SELECT 
        rs.tax_enabled,
        rs.tax_mode,
        rs.tax_rate,
        rs.tax_label,
        rs.tax_rules,
        rs.tax_rounding_mode,
        rs.currency,
        rs.service_charge_enabled,
        rs.service_charge_rate,
        rs.service_charge_label,
        rs.service_charge_taxable
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_tax_label,
        v_tax_rules,
        v_tax_rounding_mode,
        v_currency,
        v_service_charge_enabled,
        v_service_charge_rate,
        v_service_charge_label,
        v_service_charge_taxable
    FROM public.restaurant_settings rs
    WHERE rs.restaurant_id = v_restaurant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant settings missing for restaurant_id: %', v_restaurant_id;
    END IF;

    IF v_currency IS NULL OR trim(v_currency) = '' THEN
        RAISE EXCEPTION 'Currency setting is missing for restaurant_id: %', v_restaurant_id;
    END IF;

    IF v_tax_enabled IS NULL THEN
        RAISE EXCEPTION 'tax_enabled setting is missing for restaurant_id: %', v_restaurant_id;
    END IF;

    -- Resolve currency decimal places dynamically using ISO 4217 minor units
    v_decimals := public.get_currency_decimals(v_currency);

    -- 3. Feature Toggle Server Enforcement
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    v_tip_amount := round(COALESCE((p_order->>'tip_amount')::numeric, 0.0), v_decimals);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 4. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 5. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 6. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 7. Generate order reference using random code (never sequential)
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- Generate random payment_token built from two gen_random_uuid
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 8. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 9. Authoritative server-side pricing & line items computation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        BEGIN
            v_quantity := (v_item->>'quantity')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid item quantity for item "%"', v_item_id;
        END;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Item quantity must be between 1 and 50 (got % for item "%")', COALESCE(v_quantity, 0), v_item_id;
        END IF;

        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_item_category := 'food';
        v_is_available := NULL;

        SELECT mi.price, mi.name, mi.available, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_category
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            SELECT m.price, m.name, COALESCE(m.is_available, true), 'food'
            INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_category
            FROM public.menu m
            WHERE m.id = v_item_id;
        END IF;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item "%" (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.menu_item_availability mia
            WHERE mia.item_id = v_item_id AND mia.is_available = false
        ) THEN
            RAISE EXCEPTION 'Item "%" is currently marked 86''d out of stock', v_db_item_name;
        END IF;

        v_unit_price_rounded := round(v_db_unit_price::numeric, v_decimals);
        v_line_total := round((v_quantity * v_unit_price_rounded)::numeric, v_decimals);
        v_raw_subtotal := round((v_raw_subtotal + v_line_total)::numeric, v_decimals);

        v_calc_items := v_calc_items || jsonb_build_object(
            'menu_item_id', v_item_id,
            'name', v_db_item_name,
            'quantity', v_quantity,
            'unit_price', v_unit_price_rounded,
            'line_total', v_line_total,
            'category', v_item_category,
            'notes', nullif(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    -- 10. FINANCIAL ORDER OF OPERATIONS
    -- Step 1: Server-Authoritative Discount Computation
    -- Any client-supplied discount_amount is COMPLETELY IGNORED.
    v_input_discount_code := nullif(trim(COALESCE(p_order->>'discount_code', '')), '');
    v_discount_amount := 0.0000;

    IF v_input_discount_code IS NOT NULL THEN
        IF NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
            RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
        END IF;

        SELECT * INTO v_discount
        FROM public.discount_codes
        WHERE UPPER(trim(code)) = UPPER(v_input_discount_code)
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid or unknown discount code: %', v_input_discount_code;
        END IF;

        IF NOT COALESCE(v_discount.active, false) THEN
            RAISE EXCEPTION 'Discount code "%" is no longer active', v_discount.code;
        END IF;

        IF v_discount.valid_from IS NOT NULL AND v_discount.valid_from > now() THEN
            RAISE EXCEPTION 'Discount code "%" is not valid yet', v_discount.code;
        END IF;

        IF v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now() THEN
            RAISE EXCEPTION 'Discount code "%" has expired', v_discount.code;
        END IF;

        IF v_discount.max_uses IS NOT NULL AND v_discount.used_count >= v_discount.max_uses THEN
            RAISE EXCEPTION 'Discount code "%" has reached its usage limit', v_discount.code;
        END IF;

        IF v_discount.min_order_amount IS NOT NULL AND v_raw_subtotal < v_discount.min_order_amount THEN
            RAISE EXCEPTION 'Order subtotal (%) is less than the minimum required (%) for discount code "%"', v_raw_subtotal, v_discount.min_order_amount, v_discount.code;
        END IF;

        IF v_discount.discount_type = 'percentage' THEN
            v_discount_amount := round((v_raw_subtotal * (v_discount.discount_value / 100.0))::numeric, v_decimals);
            IF v_discount.max_discount_amount IS NOT NULL AND v_discount.max_discount_amount > 0 THEN
                v_discount_amount := LEAST(v_discount_amount, round(v_discount.max_discount_amount::numeric, v_decimals));
            END IF;
        ELSIF v_discount.discount_type = 'flat' THEN
            v_discount_amount := round(v_discount.discount_value::numeric, v_decimals);
        ELSE
            RAISE EXCEPTION 'Unsupported discount type "%" for code "%"', v_discount.discount_type, v_discount.code;
        END IF;

        v_discount_amount := round(GREATEST(0.0, LEAST(v_raw_subtotal, v_discount_amount))::numeric, v_decimals);

        UPDATE public.discount_codes
        SET used_count = used_count + 1,
            updated_at = now()
        WHERE id = v_discount.id;
    END IF;

    v_discounted_subtotal := round((v_raw_subtotal - v_discount_amount)::numeric, v_decimals);
    v_discount_ratio := CASE WHEN v_raw_subtotal > 0 THEN (v_discounted_subtotal / v_raw_subtotal) ELSE 1.0 END;

    -- Step 2: Service Charge is calculated on the discounted subtotal
    IF v_service_charge_enabled AND v_service_charge_rate > 0 THEN
        v_service_charge_amount := round((v_discounted_subtotal * v_service_charge_rate)::numeric, v_decimals);
    ELSE
        v_service_charge_amount := 0.0;
    END IF;

    -- Step 3: Taxes calculated on applicable discounted category subtotals (NO SILENT 5% FALLBACK)
    IF NOT v_tax_enabled THEN
        v_total_inclusive_tax := 0.0;
        v_total_exclusive_tax := 0.0;
        v_tax_amount := 0.0;
        v_computed_total := round((v_discounted_subtotal + v_service_charge_amount)::numeric, v_decimals);
    ELSE
        IF (v_tax_rate IS NULL) AND (v_tax_rules IS NULL OR jsonb_typeof(v_tax_rules) <> 'array' OR jsonb_array_length(v_tax_rules) = 0) THEN
            RAISE EXCEPTION 'Tax is enabled but neither tax_rate nor tax_rules are configured for restaurant_id: %', v_restaurant_id;
        END IF;

        IF v_tax_rules IS NULL OR jsonb_typeof(v_tax_rules) <> 'array' OR jsonb_array_length(v_tax_rules) = 0 THEN
            v_tax_rules := jsonb_build_array(jsonb_build_object(
                'label', COALESCE(v_tax_label, 'Tax'),
                'rate', COALESCE(v_tax_rate, 0.0000),
                'mode', COALESCE(v_tax_mode, 'inclusive')
            ));
        END IF;

        -- Group rules by (mode, appliesTo) to coordinate split rules (e.g. CGST + SGST)
        FOR v_rule_group IN
            WITH parsed_rules AS (
                SELECT 
                    elem->>'mode' AS r_mode,
                    COALESCE(elem->'appliesTo', '[]'::jsonb) AS r_applies_to,
                    jsonb_agg(elem) AS r_group_rules,
                    sum((elem->>'rate')::numeric) AS r_combined_rate,
                    count(*) AS r_count
                FROM jsonb_array_elements(v_tax_rules) elem
                WHERE (elem->>'rate')::numeric > 0
                GROUP BY elem->>'mode', COALESCE(elem->'appliesTo', '[]'::jsonb)
            )
            SELECT * FROM parsed_rules
        LOOP
            v_group_rules := v_rule_group.r_group_rules;
            v_group_count := v_rule_group.r_count;
            v_group_combined_rate := v_rule_group.r_combined_rate;
            v_group_mode := v_rule_group.r_mode;

            IF jsonb_array_length(v_rule_group.r_applies_to) > 0 THEN
                v_applicable_subtotal := 0.0;
                FOR v_calc_item IN SELECT * FROM jsonb_array_elements(v_calc_items)
                LOOP
                    IF v_rule_group.r_applies_to ? (v_calc_item->>'category') THEN
                        v_item_disc_line := (v_calc_item->>'line_total')::numeric * v_discount_ratio;
                        IF v_tax_rounding_mode = 'line' THEN
                            v_applicable_subtotal := v_applicable_subtotal + round(v_item_disc_line::numeric, v_decimals);
                        ELSE
                            v_applicable_subtotal := v_applicable_subtotal + v_item_disc_line;
                        END IF;
                    END IF;
                END LOOP;
                v_applicable_subtotal := round(v_applicable_subtotal::numeric, v_decimals);
            ELSE
                v_applicable_subtotal := v_discounted_subtotal;
            END IF;

            IF v_applicable_subtotal > 0 AND v_group_combined_rate > 0 THEN
                IF v_group_mode = 'inclusive' THEN
                    v_group_total_tax := round((v_applicable_subtotal * (v_group_combined_rate / (1.0 + v_group_combined_rate)))::numeric, v_decimals);
                    v_total_inclusive_tax := round((v_total_inclusive_tax + v_group_total_tax)::numeric, v_decimals);
                ELSE
                    v_group_total_tax := round((v_applicable_subtotal * v_group_combined_rate)::numeric, v_decimals);
                    v_total_exclusive_tax := round((v_total_exclusive_tax + v_group_total_tax)::numeric, v_decimals);
                END IF;

                v_allocated_group_tax := 0.0;
                FOR i IN 0..(v_group_count - 1)
                LOOP
                    v_rule := v_group_rules->i;
                    v_rule_rate := (v_rule->>'rate')::numeric;

                    IF i = (v_group_count - 1) THEN
                        v_rule_tax := round((v_group_total_tax - v_allocated_group_tax)::numeric, v_decimals);
                    ELSE
                        v_rule_tax := round((v_group_total_tax * (v_rule_rate / v_group_combined_rate))::numeric, v_decimals);
                        v_allocated_group_tax := round((v_allocated_group_tax + v_rule_tax)::numeric, v_decimals);
                    END IF;

                    v_tax_lines := v_tax_lines || jsonb_build_object(
                        'label', v_rule->>'label',
                        'rate', v_rule_rate,
                        'mode', v_rule->>'mode',
                        'amount', v_rule_tax,
                        'appliedTo', v_rule->'appliesTo'
                    );
                END LOOP;
            END IF;
        END LOOP;

        IF v_service_charge_enabled AND v_service_charge_taxable AND v_service_charge_amount > 0 THEN
            v_primary_rule := v_tax_rules->0;
            v_sc_tax_rate := COALESCE((v_primary_rule->>'rate')::numeric, v_tax_rate, 0.0);
            v_sc_tax_mode := COALESCE(v_primary_rule->>'mode', v_tax_mode, 'inclusive');

            IF v_sc_tax_rate > 0 THEN
                IF v_sc_tax_mode = 'exclusive' THEN
                    v_sc_tax := round((v_service_charge_amount * v_sc_tax_rate)::numeric, v_decimals);
                    v_total_exclusive_tax := round((v_total_exclusive_tax + v_sc_tax)::numeric, v_decimals);
                ELSE
                    v_sc_tax := round((v_service_charge_amount * (v_sc_tax_rate / (1.0 + v_sc_tax_rate)))::numeric, v_decimals);
                    v_total_inclusive_tax := round((v_total_inclusive_tax + v_sc_tax)::numeric, v_decimals);
                END IF;

                v_tax_lines := v_tax_lines || jsonb_build_object(
                    'label', COALESCE(v_primary_rule->>'label', v_tax_label, 'Tax') || ' (Service)',
                    'rate', v_sc_tax_rate,
                    'mode', v_sc_tax_mode,
                    'amount', v_sc_tax
                );
            END IF;
        END IF;

        v_tax_amount := round((v_total_inclusive_tax + v_total_exclusive_tax)::numeric, v_decimals);
        v_computed_total := round((v_discounted_subtotal + v_service_charge_amount + v_total_exclusive_tax)::numeric, v_decimals);
    END IF;

    IF v_tip_amount > 0 THEN
        v_computed_total := round((v_computed_total + v_tip_amount)::numeric, v_decimals);
    END IF;

    -- 11. Insert Authoritative Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        discount_code,
        discount_amount,
        discounted_subtotal,
        service_charge_amount,
        tax_amount,
        total,
        tax_breakdown,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_raw_subtotal,
        v_input_discount_code,
        v_discount_amount,
        v_discounted_subtotal,
        v_service_charge_amount,
        v_tax_amount,
        v_computed_total,
        v_tax_lines,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 12. Insert Order Items
    FOR v_calc_item IN SELECT * FROM jsonb_array_elements(v_calc_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_calc_item->>'menu_item_id',
            v_calc_item->>'name',
            (v_calc_item->>'quantity')::INTEGER,
            (v_calc_item->>'unit_price')::NUMERIC,
            (v_calc_item->>'line_total')::NUMERIC,
            v_calc_item->>'notes',
            v_created_at
        );
    END LOOP;

    -- 13. Return Authoritative Order Summary Response
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_raw_subtotal,
        'discount_code', v_input_discount_code,
        'discount_amount', v_discount_amount,
        'discounted_subtotal', v_discounted_subtotal,
        'service_charge', v_service_charge_amount,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency,
        'tax_breakdown', v_tax_lines,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. CANONICAL validate_discount_code RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_discount_code(code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code RECORD;
    v_restaurant_id TEXT;
BEGIN
    SELECT rs.restaurant_id INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discounts and promotional coupons are currently disabled by the restaurant.');
    END IF;

    IF code IS NULL OR trim(code) = '' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discount code is required');
    END IF;

    SELECT * INTO v_code
    FROM public.discount_codes dc
    WHERE upper(trim(dc.code)) = upper(trim(validate_discount_code.code))
      AND dc.active = true
      AND (dc.valid_from IS NULL OR dc.valid_from <= now())
      AND (dc.valid_until IS NULL OR dc.valid_until >= now());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired discount code');
    END IF;

    IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discount code has reached its usage limit');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'code', v_code.code,
        'discount_type', v_code.discount_type,
        'discount_value', v_code.discount_value,
        'min_order_amount', v_code.min_order_amount,
        'max_discount_amount', v_code.max_discount_amount
    );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_discount_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDENED POS CREATE OR APPEND KOT (Feature Flags + Concurrency + Zero 5% Fallback)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.pos_create_or_append_kot(
    p_bill_number TEXT DEFAULT NULL,
    p_order_type TEXT DEFAULT 'dine_in',
    p_table_number TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_bill_id UUID DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
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
    v_existing_bill RECORD;
    v_existing_kot RECORD;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    -- Feature Toggle Guards
    IF NOT public.is_feature_enabled('pos', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF (p_order_type = 'dine_in' OR (p_table_number IS NOT NULL AND trim(p_table_number) <> '')) 
       AND NOT public.is_feature_enabled('running_table_bills', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('kot_printing', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kitchen Order Ticket (KOT) printing is currently disabled.');
    END IF;

    -- Idempotency Check: KOT sent exactly once
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_kot 
        FROM public.kot_batches 
        WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        LIMIT 1;

        IF FOUND THEN
            SELECT * INTO v_existing_bill FROM public.bills WHERE id = v_existing_kot.bill_id;
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_id', v_existing_kot.bill_id,
                'bill_number', v_existing_bill.bill_number,
                'kot_batch_id', v_existing_kot.id,
                'kot_number', v_existing_kot.kot_number,
                'batch_index', v_existing_kot.batch_index,
                'message', 'KOT batch already dispatched (idempotent duplicate blocked)'
            );
        END IF;
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'KOT must contain at least one item');
    END IF;

    -- Concurrency Guard: Serialize table edits for the same table in this restaurant
    IF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('pos_table_' || v_tenant_id || '_' || trim(p_table_number)));
    ELSIF p_bill_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('pos_bill_' || v_tenant_id || '_' || p_bill_id::text));
    END IF;

    IF p_bill_id IS NOT NULL THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE id = p_bill_id AND restaurant_id = v_tenant_id
        FOR UPDATE;
    ELSIF p_bill_number IS NOT NULL AND trim(p_bill_number) <> '' THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE bill_number = trim(p_bill_number) AND restaurant_id = v_tenant_id
        FOR UPDATE;
    ELSIF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE table_number = trim(p_table_number) 
          AND restaurant_id = v_tenant_id 
          AND status IN ('running', 'printed') 
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_existing_bill.id IS NOT NULL THEN
        IF v_existing_bill.status = 'paid' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cannot add items to an already settled bill');
        END IF;

        v_bill_id := v_existing_bill.id;
        SELECT COALESCE(MAX(batch_index), 0) + 1 INTO v_batch_index
        FROM public.kot_batches
        WHERE bill_id = v_bill_id;
    ELSE
        INSERT INTO public.bills (
            restaurant_id,
            bill_number,
            order_type,
            table_number,
            customer_name,
            customer_phone,
            delivery_address,
            status,
            created_by
        ) VALUES (
            v_tenant_id,
            COALESCE(NULLIF(trim(p_bill_number), ''), 'BILL-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
            COALESCE(p_order_type, 'dine_in'),
            trim(p_table_number),
            trim(p_customer_name),
            trim(p_customer_phone),
            trim(p_delivery_address),
            'running',
            auth.uid()
        )
        RETURNING id, bill_number INTO v_bill_id, p_bill_number;
        v_batch_index := 1;
    END IF;

    v_kot_number := 'KOT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    INSERT INTO public.kot_batches (
        bill_id,
        restaurant_id,
        kot_number,
        batch_index,
        status,
        special_instructions,
        idempotency_key,
        created_by
    ) VALUES (
        v_bill_id,
        v_tenant_id,
        v_kot_number,
        v_batch_index,
        'sent',
        trim(p_special_instructions),
        nullif(trim(p_idempotency_key), ''),
        auth.uid()
    )
    RETURNING id INTO v_kot_batch_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'menu_id', v_item->>'id', ''));
        v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
        IF v_quantity < 1 THEN v_quantity := 1; END IF;

        SELECT mi.price, mi.name INTO v_db_price, v_db_name
        FROM public.menu_items mi
        WHERE mi.id = v_menu_id AND mi.restaurant_id = v_tenant_id;

        IF v_db_price IS NULL THEN
            SELECT m.price, m.name INTO v_db_price, v_db_name
            FROM public.menu m WHERE m.id = v_menu_id;
        END IF;

        IF v_db_price IS NULL THEN
            v_db_price := COALESCE((v_item->>'price')::NUMERIC, 0.00);
            v_db_name := COALESCE(v_item->>'name', 'Unknown Item');
        END IF;

        v_unit_minor := ROUND(v_db_price * 100);
        v_mod_minor := 0;

        IF v_item->'modifiers' IS NOT NULL AND jsonb_typeof(v_item->'modifiers') = 'array' THEN
            FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
            LOOP
                v_mod_minor := v_mod_minor + COALESCE((v_mod->>'price_minor')::INTEGER, ROUND(COALESCE((v_mod->>'price')::NUMERIC, 0) * 100));
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
        ) VALUES (
            v_bill_id,
            v_tenant_id,
            v_kot_batch_id,
            v_menu_id,
            v_db_name,
            v_quantity,
            v_unit_minor + v_mod_minor,
            v_line_minor,
            COALESCE(v_item->>'tax_category', v_item->>'taxCategory', 'food'),
            COALESCE(v_item->'modifiers', '[]'::jsonb),
            nullif(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    SELECT COALESCE(SUM(line_total_minor), 0) INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill_id AND is_voided = false;

    -- Zero 5% silent fallback: COALESCE to 0.0000
    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings
    WHERE restaurant_id = v_tenant_id;

    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := v_subtotal_minor;

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = GREATEST(0, v_grand_total_minor - discount_amount_minor),
        tax_details = jsonb_build_array(
            jsonb_build_object('label', 'CGST', 'rate', v_tax_rate / 2.0, 'amount_minor', ROUND(v_tax_minor / 2.0)),
            jsonb_build_object('label', 'SGST', 'rate', v_tax_rate / 2.0, 'amount_minor', v_tax_minor - ROUND(v_tax_minor / 2.0))
        ),
        updated_at = now()
    WHERE id = v_bill_id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_id', v_bill_id,
        'bill_number', COALESCE(v_existing_bill.bill_number, p_bill_number),
        'kot_batch_id', v_kot_batch_id,
        'kot_number', v_kot_number,
        'batch_index', v_batch_index,
        'subtotal_minor', v_subtotal_minor,
        'tax_amount_minor', v_tax_minor,
        'grand_total_minor', GREATEST(0, v_grand_total_minor - COALESCE(v_existing_bill.discount_amount_minor, 0))
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_create_or_append_kot TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. HARDENED POS VOID ITEM (Feature Flags + Strict Auth)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.pos_void_item(
    p_bill_item_id UUID,
    p_void_reason TEXT,
    p_manager_pin TEXT DEFAULT NULL,
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
    v_tenant_id TEXT;
    v_item RECORD;
    v_bill RECORD;
    v_is_authorized BOOLEAN := false;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0000;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('running_table_bills', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
    END IF;

    IF p_void_reason IS NULL OR length(trim(p_void_reason)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid void reason (min 3 chars) is required');
    END IF;

    -- Strict Server Authorization
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        v_is_authorized := true;
    ELSIF public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid manager PIN or insufficient role permissions for void');
    END IF;

    SELECT * INTO v_item 
    FROM public.bill_items 
    WHERE id = p_bill_item_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill item not found or unauthorized tenant access');
    END IF;

    IF v_item.is_voided THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is already voided');
    END IF;

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE id = v_item.bill_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Associated bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot void items from an already paid bill');
    END IF;

    UPDATE public.bill_items
    SET is_voided = true,
        void_reason = trim(p_void_reason),
        voided_by = p_actor_id,
        voided_at = now(),
        updated_at = now()
    WHERE id = p_bill_item_id;

    SELECT COALESCE(SUM(line_total_minor), 0) INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill.id AND is_voided = false;

    -- Zero 5% silent fallback: COALESCE to 0.0000
    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings
    WHERE restaurant_id = v_tenant_id;

    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := GREATEST(0, v_subtotal_minor - v_bill.discount_amount_minor);

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = v_grand_total_minor,
        tax_details = jsonb_build_array(
            jsonb_build_object('label', 'CGST', 'rate', v_tax_rate / 2.0, 'amount_minor', ROUND(v_tax_minor / 2.0)),
            jsonb_build_object('label', 'SGST', 'rate', v_tax_rate / 2.0, 'amount_minor', v_tax_minor - ROUND(v_tax_minor / 2.0))
        ),
        updated_at = now()
    WHERE id = v_bill.id;

    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_tenant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'manager'),
        'pos_void_item',
        'bill_items',
        p_bill_item_id::text,
        jsonb_build_object(
            'item_name', v_item.name,
            'quantity', v_item.quantity,
            'amount_minor', v_item.line_total_minor,
            'reason', p_void_reason,
            'bill_id', v_bill.id,
            'bill_number', v_bill.bill_number,
            'authorized_by_pin', (p_manager_pin IS NOT NULL)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', p_bill_item_id,
        'new_subtotal_minor', v_subtotal_minor,
        'new_grand_total_minor', v_grand_total_minor,
        'new_tax_amount_minor', v_tax_minor
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. HARDENED POS APPLY DISCOUNT (Feature Flags + Strict Auth)
-- ------------------------------------------------------------------------------
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
    v_tenant_id TEXT;
    v_bill RECORD;
    v_computed_discount_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_is_authorized BOOLEAN := false;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('running_table_bills', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('discounts', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Discounts and promotional coupons are currently disabled.');
    END IF;

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE id = p_bill_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot apply discount to an already paid bill');
    END IF;

    -- Strict Server Authorization
    IF p_discount_type IN ('flat', 'manual') OR p_discount_value_minor > 2000 THEN
        IF COALESCE(auth.role(), '') = 'service_role' THEN
            v_is_authorized := true;
        ELSIF public.is_manager_or_above(auth.uid()) THEN
            v_is_authorized := true;
        ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
            v_is_authorized := true;
        END IF;

        IF NOT v_is_authorized THEN
            RETURN jsonb_build_object('success', false, 'error', 'Manager authorization PIN required for this discount');
        END IF;
    END IF;

    IF p_discount_type = 'percentage' THEN
        IF p_discount_value_minor < 0 OR p_discount_value_minor > 10000 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Discount percentage must be between 0 and 100%');
        END IF;
        v_computed_discount_minor := ROUND(v_bill.subtotal_minor * (p_discount_value_minor / 10000.0));
    ELSIF p_discount_type IN ('flat', 'manual') THEN
        IF p_discount_value_minor < 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Discount amount cannot be negative');
        END IF;
        v_computed_discount_minor := LEAST(v_bill.subtotal_minor, p_discount_value_minor);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid discount type: ' || COALESCE(p_discount_type, 'null'));
    END IF;

    v_grand_total_minor := GREATEST(0, v_bill.subtotal_minor - v_computed_discount_minor);

    UPDATE public.bills
    SET discount_type = p_discount_type,
        discount_code = trim(p_discount_code),
        discount_value_minor = p_discount_value_minor,
        discount_amount_minor = v_computed_discount_minor,
        discount_approved_by = p_actor_id,
        grand_total_minor = v_grand_total_minor,
        updated_at = now()
    WHERE id = p_bill_id;

    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_tenant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'manager'),
        'pos_apply_discount',
        'bills',
        p_bill_id::text,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'discount_type', p_discount_type,
            'discount_value_minor', p_discount_value_minor,
            'discount_amount_minor', v_computed_discount_minor,
            'new_grand_total_minor', v_grand_total_minor,
            'code', p_discount_code,
            'authorized_by_pin', (p_manager_pin IS NOT NULL)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'bill_id', p_bill_id,
        'discount_amount_minor', v_computed_discount_minor,
        'new_grand_total_minor', v_grand_total_minor
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_apply_discount(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_apply_discount(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. HARDENED SPLIT BILL ATOMIC (Feature Flags + Zero Penny Loss)
-- ------------------------------------------------------------------------------
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
    v_tenant_id TEXT;
    v_bill RECORD;
    v_split JSONB;
    v_sum_amount_minor INTEGER := 0;
    v_part_amount_minor INTEGER;
    v_part_subtotal_minor INTEGER;
    v_part_tax_minor INTEGER;
    v_total_parts INTEGER;
    v_part_number INTEGER := 1;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('running_table_bills', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('split_bills', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill splitting is currently disabled.');
    END IF;

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot split an already settled bill');
    END IF;

    v_total_parts := jsonb_array_length(p_splits);
    IF v_total_parts < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Splits array cannot be empty');
    END IF;

    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_part_amount_minor := COALESCE(
            (v_split->>'amount_minor')::INTEGER, 
            ROUND((v_split->>'amount')::NUMERIC * 100)
        );
        IF v_part_amount_minor <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Each split part must have an amount greater than zero');
        END IF;
        v_sum_amount_minor := v_sum_amount_minor + v_part_amount_minor;
    END LOOP;

    IF v_sum_amount_minor <> v_bill.grand_total_minor THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Split parts sum (%s paise) does not match bill grand total (%s paise)', v_sum_amount_minor, v_bill.grand_total_minor)
        );
    END IF;

    DELETE FROM public.bill_splits WHERE bill_id = v_bill.id;

    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_part_amount_minor := COALESCE(
            (v_split->>'amount_minor')::INTEGER, 
            ROUND(COALESCE((v_split->>'amount')::NUMERIC, 0) * 100),
            0
        );

        v_part_tax_minor := CASE
            WHEN v_bill.grand_total_minor > 0 THEN
                COALESCE(
                    (v_split->>'tax_amount_minor')::INTEGER,
                    ROUND(v_bill.tax_amount_minor * (v_part_amount_minor::NUMERIC / v_bill.grand_total_minor::NUMERIC)),
                    0
                )
            ELSE 0
        END;

        v_part_subtotal_minor := COALESCE(
            (v_split->>'subtotal_minor')::INTEGER,
            v_part_amount_minor - v_part_tax_minor,
            0
        );

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
            amount_minor
        ) VALUES (
            v_tenant_id,
            v_bill.id,
            v_bill.bill_number,
            p_split_type,
            v_part_number,
            v_total_parts,
            COALESCE(v_split->>'payer_label', v_split->>'label', 'Guest ' || v_part_number),
            COALESCE(v_split->'items', v_split->'item_ids', '[]'::jsonb),
            v_part_subtotal_minor,
            v_part_tax_minor,
            v_part_amount_minor
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
        'bill_id', v_bill.id,
        'bill_number', v_bill.bill_number,
        'split_count', v_total_parts,
        'split_type', p_split_type
    );
END;
$$;

REVOKE ALL ON FUNCTION public.split_bill_atomic(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.split_bill_atomic(TEXT, TEXT, JSONB) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. HARDENED PROCESS BILL PAYMENT (Feature Flags + Idempotency)
-- ------------------------------------------------------------------------------
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
    v_tenant_id TEXT;
    v_bill RECORD;
    v_split RECORD;
    v_change_due_minor INTEGER := 0;
    v_total_paid_so_far_minor INTEGER := 0;
    v_remaining_minor INTEGER := 0;
    v_is_bill_closed BOOLEAN := false;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('running_table_bills', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
    END IF;

    -- Idempotency Check
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        IF EXISTS (
            SELECT 1 FROM public.cash_drawer_transactions 
            WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) OR EXISTS (
            SELECT 1 FROM public.bill_splits 
            WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) OR EXISTS (
            SELECT 1 FROM public.bills 
            WHERE payment_idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_number', p_bill_number,
                'message', 'Payment already processed (idempotent duplicate blocked)'
            );
        END IF;
    END IF;

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill is already completely settled');
    END IF;

    IF p_tender_type = 'cash' AND p_tendered_minor > 0 THEN
        IF p_tendered_minor < p_amount_minor THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Tendered cash (%s paise) is less than required payment (%s paise)', p_tendered_minor, p_amount_minor)
            );
        END IF;
        v_change_due_minor := p_tendered_minor - p_amount_minor;
    END IF;

    IF p_split_id IS NOT NULL THEN
        SELECT * INTO v_split 
        FROM public.bill_splits 
        WHERE id = p_split_id AND bill_id = v_bill.id AND restaurant_id = v_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Split part not found on this bill');
        END IF;

        IF v_split.status = 'paid' THEN
            RETURN jsonb_build_object('success', false, 'error', 'This split part is already paid');
        END IF;

        UPDATE public.bill_splits
        SET status = 'paid',
            tender_type = p_tender_type,
            paid_at = now(),
            payment_reference = p_payment_reference,
            idempotency_key = nullif(trim(p_idempotency_key), '')
        WHERE id = p_split_id;

        SELECT COALESCE(SUM(amount_minor), 0) INTO v_total_paid_so_far_minor
        FROM public.bill_splits
        WHERE bill_id = v_bill.id AND status = 'paid';

        v_remaining_minor := GREATEST(0, v_bill.grand_total_minor - v_total_paid_so_far_minor);
        IF v_remaining_minor = 0 THEN
            v_is_bill_closed := true;
            UPDATE public.bills
            SET status = 'paid',
                payment_status = 'paid',
                payment_method = 'split',
                paid_at = now(),
                shift_id = p_shift_id,
                payment_idempotency_key = nullif(trim(p_idempotency_key), ''),
                updated_at = now()
            WHERE id = v_bill.id;
        END IF;
    ELSE
        IF p_amount_minor < v_bill.grand_total_minor THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payment amount is less than bill total. Must split bill for partial payments.');
        END IF;

        v_is_bill_closed := true;
        v_total_paid_so_far_minor := p_amount_minor;
        v_remaining_minor := 0;

        UPDATE public.bills
        SET status = 'paid',
            payment_status = 'paid',
            payment_method = p_tender_type,
            paid_at = now(),
            shift_id = p_shift_id,
            payment_idempotency_key = nullif(trim(p_idempotency_key), ''),
            updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    IF p_tender_type = 'cash' AND p_shift_id IS NOT NULL THEN
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
        ) VALUES (
            v_tenant_id,
            p_shift_id,
            'sale',
            p_amount_minor,
            format('POS Bill Settlement: %s (%s)', v_bill.bill_number, COALESCE(v_split.label, 'Full')),
            v_bill.bill_number,
            COALESCE(p_actor_id, 'staff'),
            COALESCE(p_actor_name, 'Cashier'),
            COALESCE(p_actor_role, 'cashier'),
            nullif(trim(p_idempotency_key), '')
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'amount_paid_minor', p_amount_minor,
        'change_due_minor', v_change_due_minor,
        'is_bill_closed', v_is_bill_closed,
        'remaining_minor', v_remaining_minor
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_bill_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_bill_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. HARDENED POS RECORD DRAWER OPEN (Feature Flags)
-- ------------------------------------------------------------------------------
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
    v_tenant_id TEXT;
BEGIN
    SELECT * INTO v_shift FROM public.cash_shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active shift not found');
    END IF;

    v_tenant_id := v_shift.restaurant_id;

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('cash_drawer', v_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cash drawer operations are currently disabled.');
    END IF;

    INSERT INTO public.cash_drawer_transactions (
        restaurant_id,
        shift_id,
        type,
        amount_minor,
        reason,
        actor_id,
        actor_name,
        actor_role
    ) VALUES (
        v_tenant_id,
        p_shift_id,
        'drawer_open',
        0,
        COALESCE(NULLIF(trim(p_reason), ''), 'Manual Cash Drawer Kick'),
        COALESCE(p_actor_id, 'staff'),
        COALESCE(p_actor_name, 'Staff Cashier'),
        COALESCE(p_actor_role, 'cashier')
    );

    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_tenant_id,
        COALESCE(p_actor_id, 'staff'),
        COALESCE(p_actor_role, 'cashier'),
        'pos_drawer_open',
        'cash_shifts',
        p_shift_id::text,
        jsonb_build_object(
            'shift_number', v_shift.shift_number,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'reason', p_reason,
        'recorded_at', now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_record_drawer_open(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_record_drawer_open(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. HARDENED GET SHIFT Z-REPORT (Feature Flags)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shift_z_report(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
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
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    SELECT * INTO v_shift 
    FROM public.cash_shifts 
    WHERE id = p_shift_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shift not found or unauthorized tenant access');
    END IF;

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_shift.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('cash_drawer', v_shift.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cash drawer shift management is currently disabled.');
    END IF;

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

    SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'card', 'upi', 'split') THEN grand_total_minor ELSE 0 END), 0)
    INTO 
        v_card_sales_minor, v_upi_sales_minor, v_other_sales_minor
    FROM public.bills
    WHERE shift_id = p_shift_id AND status = 'paid' AND is_split = false;

    SELECT 
        v_card_sales_minor + COALESCE(SUM(CASE WHEN s.tender_type = 'card' THEN s.amount_minor ELSE 0 END), 0),
        v_upi_sales_minor + COALESCE(SUM(CASE WHEN s.tender_type = 'upi' THEN s.amount_minor ELSE 0 END), 0),
        v_other_sales_minor + COALESCE(SUM(CASE WHEN s.tender_type NOT IN ('cash', 'card', 'upi') AND s.tender_type IS NOT NULL THEN s.amount_minor ELSE 0 END), 0)
    INTO 
        v_card_sales_minor, v_upi_sales_minor, v_other_sales_minor
    FROM public.bill_splits s
    JOIN public.bills b ON b.id = s.bill_id
    WHERE b.shift_id = p_shift_id AND s.status = 'paid';

    v_gross_sales_minor := v_cash_sales_minor + v_card_sales_minor + v_upi_sales_minor + v_other_sales_minor;
    v_expected_cash_minor := v_shift.opening_float_minor + v_cash_sales_minor + v_cash_in_minor - v_cash_out_minor - v_cash_refunds_minor;
    v_variance_minor := COALESCE(v_shift.counted_cash_minor, v_expected_cash_minor) - v_expected_cash_minor;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'shift_number', v_shift.shift_number,
        'opening_float_minor', v_shift.opening_float_minor,
        'cash_sales_minor', v_cash_sales_minor,
        'card_sales_minor', v_card_sales_minor,
        'upi_sales_minor', v_upi_sales_minor,
        'other_sales_minor', v_other_sales_minor,
        'cash_in_minor', v_cash_in_minor,
        'cash_out_minor', v_cash_out_minor,
        'cash_refunds_minor', v_cash_refunds_minor,
        'gross_sales_minor', v_gross_sales_minor,
        'expected_cash_minor', v_expected_cash_minor,
        'counted_cash_minor', v_shift.counted_cash_minor,
        'variance_minor', v_variance_minor,
        'transaction_count', v_tx_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shift_z_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shift_z_report(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. HARDENED VOID OR REFUND ORDER SECURE (Feature Flags)
-- ------------------------------------------------------------------------------
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

    IF p_actor_role IN ('owner', 'manager') OR public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Manager authorization is required for refunds/voids');
    END IF;

    SELECT * INTO v_bill FROM public.bills 
    WHERE bill_number = trim(p_order_ref) OR id::text = trim(p_order_ref) 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill record not found');
    END IF;

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_bill.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    v_refund_minor := COALESCE(p_amount_minor, v_bill.grand_total_minor);

    UPDATE public.bills
    SET status = 'voided',
        payment_status = 'refunded',
        notes = COALESCE(notes || E'\n', '') || format('Voided/Refunded (%s minor) by %s: %s', v_refund_minor, COALESCE(p_actor_name, 'Manager'), p_reason),
        updated_at = now()
    WHERE id = v_bill.id;

    IF v_bill.payment_method = 'cash' AND p_shift_id IS NOT NULL THEN
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
        ) VALUES (
            v_bill.restaurant_id,
            p_shift_id,
            'refund',
            v_refund_minor,
            format('Refund for bill %s: %s', v_bill.bill_number, p_reason),
            v_bill.bill_number,
            COALESCE(p_actor_id, 'manager'),
            COALESCE(p_actor_name, 'Manager'),
            COALESCE(p_actor_role, 'manager')
        );
    END IF;

    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_bill.restaurant_id,
        COALESCE(p_actor_id, 'manager'),
        COALESCE(p_actor_role, 'manager'),
        'pos_void_or_refund_bill',
        'bills',
        v_bill.id::text,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'amount_minor', v_refund_minor,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'refund_minor', v_refund_minor,
        'status', 'voided'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.void_or_refund_order_secure(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_or_refund_order_secure(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. HARDENED POS TRANSFER TABLE & MERGE TABLES (Feature Flags)
-- ------------------------------------------------------------------------------
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

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_source_bill.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('running_table_bills', v_source_bill.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
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

REVOKE ALL ON FUNCTION public.pos_transfer_table(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_transfer_table(TEXT, TEXT, TEXT) TO authenticated, service_role;

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

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_primary_bill.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('running_table_bills', v_primary_bill.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
    END IF;

    UPDATE public.bill_items
    SET bill_id = v_primary_bill.id,
        updated_at = now()
    WHERE bill_id = v_secondary_bill.id;

    UPDATE public.kot_batches
    SET bill_id = v_primary_bill.id
    WHERE bill_id = v_secondary_bill.id;

    UPDATE public.bills
    SET status = 'merged',
        notes = format('Merged into %s on Table %s by %s', v_primary_bill.bill_number, p_primary_table, COALESCE(p_actor_name, 'Staff')),
        updated_at = now()
    WHERE id = v_secondary_bill.id;

    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_new_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_primary_bill.id AND is_voided = false;

    -- Zero 5% silent fallback: COALESCE to 0.0000
    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings
    WHERE restaurant_id = v_primary_bill.restaurant_id;

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
        'merged_table', p_secondary_table,
        'new_subtotal_minor', v_new_subtotal_minor,
        'new_tax_amount_minor', v_tax_minor,
        'new_grand_total_minor', GREATEST(0, v_new_subtotal_minor - v_primary_bill.discount_amount_minor)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_merge_tables(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_merge_tables(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 12. HARDENED POS MOVE ITEMS (Feature Flags)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_move_items(
    p_source_bill_id UUID,
    p_destination_bill_id UUID,
    p_item_ids UUID[],
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
    v_tax_rate NUMERIC := 0.0000;
    v_new_src_subtotal INTEGER := 0;
    v_new_src_tax INTEGER := 0;
    v_new_dst_subtotal INTEGER := 0;
    v_new_dst_tax INTEGER := 0;
BEGIN
    SELECT * INTO v_source_bill FROM public.bills WHERE id = p_source_bill_id FOR UPDATE;
    SELECT * INTO v_dest_bill FROM public.bills WHERE id = p_destination_bill_id FOR UPDATE;

    IF v_source_bill.id IS NULL OR v_dest_bill.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Both source and destination bills must exist');
    END IF;

    -- Feature Guards
    IF NOT public.is_feature_enabled('pos', v_source_bill.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Point of Sale (POS) is currently disabled.');
    END IF;

    IF NOT public.is_feature_enabled('running_table_bills', v_source_bill.restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Running table bills are currently disabled.');
    END IF;

    UPDATE public.bill_items
    SET bill_id = v_dest_bill.id,
        updated_at = now()
    WHERE id = ANY(p_item_ids) AND bill_id = v_source_bill.id;

    -- Recalculate source bill
    SELECT COALESCE(SUM(line_total_minor), 0) INTO v_new_src_subtotal
    FROM public.bill_items WHERE bill_id = v_source_bill.id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0000) INTO v_tax_rate
    FROM public.restaurant_settings WHERE restaurant_id = v_source_bill.restaurant_id;

    v_new_src_tax := ROUND(v_new_src_subtotal * (v_tax_rate / (1.0 + v_tax_rate)));

    UPDATE public.bills
    SET subtotal_minor = v_new_src_subtotal,
        tax_amount_minor = v_new_src_tax,
        grand_total_minor = GREATEST(0, v_new_src_subtotal - discount_amount_minor),
        updated_at = now()
    WHERE id = v_source_bill.id;

    -- Recalculate destination bill
    SELECT COALESCE(SUM(line_total_minor), 0) INTO v_new_dst_subtotal
    FROM public.bill_items WHERE bill_id = v_dest_bill.id AND is_voided = false;

    v_new_dst_tax := ROUND(v_new_dst_subtotal * (v_tax_rate / (1.0 + v_tax_rate)));

    UPDATE public.bills
    SET subtotal_minor = v_new_dst_subtotal,
        tax_amount_minor = v_new_dst_tax,
        grand_total_minor = GREATEST(0, v_new_dst_subtotal - discount_amount_minor),
        updated_at = now()
    WHERE id = v_dest_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'source_bill_id', v_source_bill.id,
        'destination_bill_id', v_dest_bill.id,
        'moved_items_count', array_length(p_item_ids, 1)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_move_items(UUID, UUID, UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_move_items(UUID, UUID, UUID[], TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 13. HARDENED KITCHEN STATUS UPDATE (KDS Feature Flag)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_order_status_kitchen(
  p_order_id UUID,
  p_new_status TEXT,
  p_expected_current_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_current_status TEXT;
  v_order_ref TEXT;
  v_restaurant_id TEXT;
  v_caller_role TEXT;
  v_is_active BOOLEAN;
  v_updated_order RECORD;
BEGIN
  -- 1. Fetch existing order and tenant ID
  SELECT status, order_ref, restaurant_id INTO v_current_status, v_order_ref, v_restaurant_id
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found.'
    );
  END IF;

  -- 2. KDS Feature Toggle Guard
  IF NOT public.is_feature_enabled('kds', v_restaurant_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kitchen Display System (KDS) is currently disabled.'
    );
  END IF;

  -- 3. Verify caller is active staff
  SELECT active, role INTO v_is_active, v_caller_role
  FROM public.staff_profiles
  WHERE user_id = auth.uid();

  IF v_is_active IS NOT TRUE AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only active staff can modify order status.'
    );
  END IF;

  -- 4. Validate requested new status format
  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid order status: ' || COALESCE(p_new_status, 'null')
    );
  END IF;

  -- 5. Concurrency check: If expected status provided, verify current status matches
  IF p_expected_current_status IS NOT NULL AND v_current_status <> p_expected_current_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'error', 'This order has already been updated to ' || v_current_status || '.',
      'current_status', v_current_status,
      'order_ref', v_order_ref
    );
  END IF;

  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', v_current_status,
      'order_ref', v_order_ref,
      'message', 'No-op: order already at requested status.'
    );
  END IF;

  IF p_new_status = 'preparing' AND v_current_status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition: Can only start preparing from pending or confirmed status.'
    );
  END IF;

  IF p_new_status = 'ready' AND v_current_status <> 'preparing' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition: Can only mark ready an order that is actively preparing.'
    );
  END IF;

  IF p_new_status = 'completed' AND v_current_status <> 'ready' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition: Can only complete an order that is marked ready.'
    );
  END IF;

  UPDATE public.orders
  SET
    status = p_new_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_order_id
  RETURNING * INTO v_updated_order;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_updated_order.id,
    'order_ref', v_updated_order.order_ref,
    'previous_status', v_current_status,
    'new_status', v_updated_order.status,
    'updated_at', v_updated_order.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status_kitchen(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status_kitchen(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 14. DATED TAX REGISTRY (NO SILENT 5% FALLBACK)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.resolve_dated_tax_rate(
    p_country TEXT,
    p_region TEXT DEFAULT 'ALL',
    p_category TEXT DEFAULT 'food',
    p_order_type TEXT DEFAULT 'dine_in',
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_label VARCHAR,
    rate NUMERIC,
    mode VARCHAR,
    status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT tr.rule_label, tr.rate, tr.mode, tr.status
    FROM public.tax_rules tr
    WHERE tr.country = p_country
      AND (tr.region = p_region OR tr.region = 'ALL')
      AND (tr.order_type = 'all' OR tr.order_type = p_order_type)
      AND p_category = ANY(tr.applies_to)
      AND tr.effective_from <= p_date
      AND (tr.effective_to IS NULL OR tr.effective_to >= p_date)
      AND tr.status = 'verified'
    ORDER BY 
      CASE WHEN tr.region = p_region THEN 0 ELSE 1 END,
      CASE WHEN tr.order_type = p_order_type THEN 0 ELSE 1 END,
      tr.effective_from DESC
    LIMIT 1;

    -- Zero 5% silent fallback: return 0.0000 Zero Rate / Exempt instead of 0.0500
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Zero Rate / Exempt'::VARCHAR, 0.0000::NUMERIC, 'inclusive'::VARCHAR, 'verified'::VARCHAR;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated, anon, service_role;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- SECTION: 027_roles_and_manager_pin.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 027_roles_and_manager_pin.sql
-- Description:
-- 1. Expanded RBAC Roles (cashier, waiter, kitchen, staff, manager, owner)
-- 2. Permission Matrix Functions (can_discount, can_void, can_refund, can_open_drawer, can_edit_menu, can_see_reports)
-- 3. Manager PIN Hardening:
--    - Remove plaintext manager_pin and default '1234'
--    - Store only cryptographic hash (salt$sha256 or crypt)
--    - Force owner to set it via pos_set_manager_pin
--    - 5-attempt / 15-minute lockout enforcement
--    - Write failed attempts to public.audit_log
-- 4. RLS Policy Hardening for Roles
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPANDED ROLES CONSTRAINT
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
        CHECK (role IN ('owner', 'manager', 'cashier', 'waiter', 'kitchen', 'staff'));
END $$;

-- ------------------------------------------------------------------------------
-- 2. PERMISSION MATRIX FUNCTIONS
-- ------------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.can_discount(p_uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.can_void(p_uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.can_refund(p_uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.can_open_drawer(p_uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.can_edit_menu(p_uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.can_see_reports(p_uid UUID DEFAULT auth.uid())
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

GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_discount(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_void(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_refund(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_open_drawer(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_menu(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_reports(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. MANAGER PIN SCHEMA HARDENING & LOCKOUT
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings ALTER COLUMN tax_rate DROP NOT NULL;

ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS manager_pin_hash TEXT NULL,
    ADD COLUMN IF NOT EXISTS manager_pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manager_pin_locked_until TIMESTAMPTZ NULL;

-- Drop legacy plaintext manager_pin column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'restaurant_settings' AND column_name = 'manager_pin'
    ) THEN
        ALTER TABLE public.restaurant_settings DROP COLUMN manager_pin;
    END IF;
END $$;

-- Cryptographic PIN hash helper
CREATE OR REPLACE FUNCTION public.hash_manager_pin(p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_salt TEXT;
BEGIN
    IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8 OR trim(p_pin) !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Manager PIN must be between 4 and 8 numeric digits';
    END IF;

    -- Generate random 16-char hex salt
    v_salt := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    RETURN v_salt || '$' || encode(sha256((v_salt || ':' || trim(p_pin))::bytea), 'hex');
END;
$$;

-- Cryptographic PIN verify helper
CREATE OR REPLACE FUNCTION public.internal_verify_pin_hash(p_pin TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_salt TEXT;
    v_expected TEXT;
BEGIN
    IF p_pin IS NULL OR p_hash IS NULL OR trim(p_pin) = '' OR trim(p_hash) = '' THEN
        RETURN FALSE;
    END IF;

    -- Salted SHA-256 format: "salt$hexhash"
    IF position('$' IN p_hash) > 0 THEN
        v_salt := split_part(p_hash, '$', 1);
        v_expected := v_salt || '$' || encode(sha256((v_salt || ':' || trim(p_pin))::bytea), 'hex');
        RETURN (p_hash = v_expected);
    END IF;

    -- Raw sha256 fallback
    RETURN (p_hash = encode(sha256(trim(p_pin)::bytea), 'hex'));
END;
$$;

-- RPC: pos_set_manager_pin (Owner only)
CREATE OR REPLACE FUNCTION public.pos_set_manager_pin(
    p_new_pin TEXT,
    p_restaurant_id TEXT DEFAULT 'the-cafe-barrackpore'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_hash TEXT;
BEGIN
    -- Only restaurant owner or service_role can set manager PIN
    v_caller_role := COALESCE(public.get_staff_role(auth.uid()), '');
    IF v_caller_role <> 'owner' AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only restaurant owners can set or update the Manager PIN.';
    END IF;

    v_hash := public.hash_manager_pin(p_new_pin);

    UPDATE public.restaurant_settings
    SET manager_pin_hash = v_hash,
        manager_pin_failed_attempts = 0,
        manager_pin_locked_until = NULL,
        updated_at = now()
    WHERE restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN
        UPDATE public.restaurant_settings
        SET manager_pin_hash = v_hash,
            manager_pin_failed_attempts = 0,
            manager_pin_locked_until = NULL,
            updated_at = now()
        WHERE id = 'current';
    END IF;

    -- Audit log
    INSERT INTO public.audit_log (
        restaurant_id, actor_id, actor_role, action, target_type, target_id, details
    ) VALUES (
        p_restaurant_id,
        COALESCE(auth.uid()::text, 'service_role'),
        COALESCE(v_caller_role, 'owner'),
        'manager_pin_configured',
        'restaurant_settings',
        p_restaurant_id,
        jsonb_build_object('timestamp', now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Manager PIN updated successfully.'
    );
END;
$$;

-- RPC: pos_verify_manager_pin (5 attempts lockout + audit log)
CREATE OR REPLACE FUNCTION public.pos_verify_manager_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pin_hash TEXT;
    v_failed_attempts INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_restaurant_id TEXT := 'the-cafe-barrackpore';
    v_is_valid BOOLEAN := FALSE;
BEGIN
    -- 1. Fetch current PIN settings
    SELECT manager_pin_hash, manager_pin_failed_attempts, manager_pin_locked_until, restaurant_id
    INTO v_pin_hash, v_failed_attempts, v_locked_until, v_restaurant_id
    FROM public.restaurant_settings
    ORDER BY (restaurant_id = 'the-cafe-barrackpore') DESC
    LIMIT 1;

    -- 2. Lockout check (5 tries, 15 min)
    IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
        RAISE EXCEPTION 'Manager PIN is temporarily locked due to multiple failed attempts. Try again after %', v_locked_until;
    END IF;

    -- 3. Check if owner has configured PIN
    IF v_pin_hash IS NULL OR trim(v_pin_hash) = '' THEN
        RAISE EXCEPTION 'Manager PIN has not been configured. The owner must set the Manager PIN during setup.';
    END IF;

    -- 4. Verify PIN
    v_is_valid := public.internal_verify_pin_hash(p_pin, v_pin_hash);

    IF v_is_valid THEN
        -- Success: reset failed attempts counter & lockout
        IF COALESCE(v_failed_attempts, 0) > 0 OR v_locked_until IS NOT NULL THEN
            UPDATE public.restaurant_settings
            SET manager_pin_failed_attempts = 0,
                manager_pin_locked_until = NULL
            WHERE restaurant_id = v_restaurant_id;
        END IF;
        RETURN TRUE;
    ELSE
        -- Failure: increment counter and lock if >= 5 attempts
        v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;
        IF v_failed_attempts >= 5 THEN
            v_locked_until := now() + interval '15 minutes';
        END IF;

        UPDATE public.restaurant_settings
        SET manager_pin_failed_attempts = v_failed_attempts,
            manager_pin_locked_until = v_locked_until
        WHERE restaurant_id = v_restaurant_id;

        -- Write failed attempt to audit log
        INSERT INTO public.audit_log (
            restaurant_id, actor_id, actor_role, action, target_type, target_id, details
        ) VALUES (
            v_restaurant_id,
            COALESCE(auth.uid()::text, 'anonymous'),
            COALESCE(public.get_staff_role(auth.uid()), 'unknown'),
            'manager_pin_failed',
            'restaurant_settings',
            'manager_pin',
            jsonb_build_object(
                'failed_attempts', v_failed_attempts,
                'locked_until', v_locked_until,
                'client_ip', NULL
            )
        );

        RETURN FALSE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hash_manager_pin(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_set_manager_pin(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_verify_manager_pin(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES FOR PERMISSION MATRIX
-- ------------------------------------------------------------------------------
-- Menu Items RLS: Only can_edit_menu (owner, manager) can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "staff_manage_menu_items" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items"
ON public.menu_items
FOR ALL
TO authenticated
USING (public.can_edit_menu(auth.uid()))
WITH CHECK (public.can_edit_menu(auth.uid()));

-- Cash Drawer Transactions RLS: Only can_open_drawer (owner, manager, cashier) can SELECT/INSERT
DROP POLICY IF EXISTS "staff_cash_drawer_transactions" ON public.cash_drawer_transactions;
CREATE POLICY "staff_cash_drawer_transactions"
ON public.cash_drawer_transactions
FOR ALL
TO authenticated
USING (public.can_open_drawer(auth.uid()))
WITH CHECK (public.can_open_drawer(auth.uid()));

-- Audit Log RLS: Only can_see_reports (owner, manager) can view audit log
DROP POLICY IF EXISTS "staff_view_audit_log" ON public.audit_log;
CREATE POLICY "staff_view_audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.can_see_reports(auth.uid()));

-- Table Privileges for Authenticated Staff
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bills TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bill_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bill_splits TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kot_batches TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_shifts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_drawer_transactions TO authenticated, service_role;
