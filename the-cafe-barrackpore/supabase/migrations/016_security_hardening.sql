-- ==============================================================================
-- Migration: 016_security_hardening.sql
-- Description:
-- 1. In the orders SELECT policy, remove the anon condition. Only service_role
--    and active staff of the same restaurant may SELECT orders and order_items.
-- 2. Replace restaurant_tables and menu_item_availability "FOR ALL" policies:
--    Anon gets SELECT only (active tables, availability).
--    Only active owner/manager staff may INSERT/UPDATE/DELETE.
--    Add WITH CHECK clauses to every policy that has USING.
-- 3. REVOKE INSERT, UPDATE, DELETE on all public tables from anon.
--    REVOKE ALL on orders, order_items, payments, staff_profiles, audit tables from anon.
--    Re-GRANT only what the app needs.
-- 4. verified_tokens table for single-use Cloudflare Turnstile verification
--    (5-minute expiry, service_role only).
-- 5. rate_limits table for persistent cross-instance rate limiting (service_role only).
-- 6. Lock down discount_codes: drop anon policy, REVOKE SELECT from anon,
--    and add RPC validate_discount_code(code) returning only the discount.
-- 7. Order references: generate with gen_random_uuid-based or 10+ character random codes,
--    never sequential. In create_order_atomic, generate random payment_token built from
--    two gen_random_uuid (dashes removed, 64 hex chars), store only its hash in
--    payment_token_hash, and return the raw token once to the browser.
-- 8. Require verified Turnstile token inside create_order_atomic and create_reservation_atomic,
--    consuming it atomically from verified_tokens.
-- 9. Helper RPC get_order_status_by_token for token-verified order status checks.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD payment_token_hash COLUMN TO orders
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_payment_token_hash ON public.orders (payment_token_hash);

-- ------------------------------------------------------------------------------
-- 2. HARDENED ORDER REFERENCE GENERATOR (gen_random_uuid-based, 10+ chars random)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_order_reference()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_random_code TEXT;
BEGIN
    -- 10-character random alphanumeric code derived from gen_random_uuid
    v_random_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    RETURN 'CB-' || v_year || '-' || v_random_code;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. FIX orders & order_items SELECT POLICIES (REMOVE anon CONDITION)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_select_orders_tenant" ON public.orders;
DROP POLICY IF EXISTS "Active staff can view orders" ON public.orders;
DROP POLICY IF EXISTS "staff_view_orders" ON public.orders;
DROP POLICY IF EXISTS "public_select_orders" ON public.orders;

CREATE POLICY "staff_select_orders_tenant"
ON public.orders
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_active_staff(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_select_order_items_tenant" ON public.order_items;
DROP POLICY IF EXISTS "Active staff can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "staff_view_order_items" ON public.order_items;

CREATE POLICY "staff_select_order_items_tenant"
ON public.order_items
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_active_staff(auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- 4. REPLACE restaurant_tables "FOR ALL" POLICIES
--    Anon gets SELECT only (active tables). Only active owner/manager staff may INSERT/UPDATE/DELETE.
--    Add WITH CHECK clauses to every policy that has USING.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_manage_tables_tenant" ON public.restaurant_tables;
DROP POLICY IF EXISTS "public_read_restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "staff_manage_restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "anon_select_active_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "staff_select_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "owner_manager_insert_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "owner_manager_update_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "owner_manager_delete_tables" ON public.restaurant_tables;

-- Anon gets SELECT only on active tables
CREATE POLICY "anon_select_active_tables"
ON public.restaurant_tables
FOR SELECT
TO anon
USING (active = true);

-- Staff gets SELECT on all tables of their restaurant
CREATE POLICY "staff_select_tables"
ON public.restaurant_tables
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_active_staff(auth.uid())
    )
);

-- Only active owner/manager staff may INSERT
CREATE POLICY "owner_manager_insert_tables"
ON public.restaurant_tables
FOR INSERT
TO authenticated, service_role
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- Only active owner/manager staff may UPDATE (WITH CHECK added)
CREATE POLICY "owner_manager_update_tables"
ON public.restaurant_tables
FOR UPDATE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- Only active owner/manager staff may DELETE
CREATE POLICY "owner_manager_delete_tables"
ON public.restaurant_tables
FOR DELETE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 5. REPLACE menu_item_availability "FOR ALL" POLICIES
--    Anon gets SELECT only. Only active owner/manager staff may INSERT/UPDATE/DELETE.
--    Add WITH CHECK clauses to every policy that has USING.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_manage_availability_tenant" ON public.menu_item_availability;
DROP POLICY IF EXISTS "public_read_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "staff_manage_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "anon_select_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "staff_select_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "owner_manager_insert_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "owner_manager_update_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "owner_manager_delete_availability" ON public.menu_item_availability;

CREATE POLICY "anon_select_menu_availability"
ON public.menu_item_availability
FOR SELECT
TO anon
USING (true);

CREATE POLICY "staff_select_menu_availability"
ON public.menu_item_availability
FOR SELECT
TO authenticated, service_role
USING (true);

CREATE POLICY "owner_manager_insert_availability"
ON public.menu_item_availability
FOR INSERT
TO authenticated, service_role
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

CREATE POLICY "owner_manager_update_availability"
ON public.menu_item_availability
FOR UPDATE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

CREATE POLICY "owner_manager_delete_availability"
ON public.menu_item_availability
FOR DELETE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 6. BROAD PRIVILEGE REVOCATION & SELECTIVE RE-GRANT
-- ------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.order_items FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.staff_profiles FROM anon;

GRANT SELECT ON TABLE public.menu_categories TO anon;
GRANT SELECT ON TABLE public.menu_items TO anon;
GRANT SELECT ON TABLE public.site_content TO anon;
GRANT SELECT ON TABLE public.restaurant_tables TO anon;
GRANT SELECT ON TABLE public.menu_item_availability TO anon;
GRANT SELECT ON TABLE public.restaurant_settings TO anon;

-- ------------------------------------------------------------------------------
-- 7. VERIFIED TOKENS TABLE (SINGLE-USE, 5-MIN EXPIRY, SERVICE ROLE ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verified_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verified_tokens_token ON public.verified_tokens (token);
CREATE INDEX IF NOT EXISTS idx_verified_tokens_expires_at ON public.verified_tokens (expires_at);

ALTER TABLE public.verified_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.verified_tokens FROM anon, authenticated, public;
GRANT ALL ON TABLE public.verified_tokens TO service_role;

-- ------------------------------------------------------------------------------
-- 8. RATE LIMITS TABLE (PERSISTENT DISTRIBUTED RATE LIMITING, SERVICE ROLE ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits (reset_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated, public;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-- ------------------------------------------------------------------------------
-- 9. DISCOUNT CODES LOCKDOWN & RPC VALIDATOR
--    Drop anon policy, REVOKE SELECT from anon, and expose validate_discount_code(code)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "discount_codes_public_validate" ON public.discount_codes;
REVOKE SELECT ON TABLE public.discount_codes FROM anon;

CREATE OR REPLACE FUNCTION public.validate_discount_code(code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_discount RECORD;
BEGIN
    IF code IS NULL OR trim(code) = '' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discount code is required');
    END IF;

    SELECT 
        dc.code AS disc_code,
        dc.discount_type,
        dc.discount_value,
        dc.min_order_amount,
        dc.max_discount_amount
    INTO v_discount
    FROM public.discount_codes dc
    WHERE UPPER(dc.code) = UPPER(trim(validate_discount_code.code))
      AND dc.active = true
      AND (dc.valid_until IS NULL OR dc.valid_until > now())
      AND (dc.max_uses IS NULL OR dc.used_count < dc.max_uses)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired discount code');
    END IF;

    -- Return only the discount details to protect internal business analytics
    RETURN jsonb_build_object(
        'valid', true,
        'code', v_discount.disc_code,
        'discount_type', v_discount.discount_type,
        'discount_value', v_discount.discount_value,
        'min_order_amount', v_discount.min_order_amount,
        'max_discount_amount', v_discount.max_discount_amount
    );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_discount_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. SECURE TOKEN-BASED ORDER STATUS RPC (FOR DINERS WITH TOKEN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_status_by_token(
    p_order_ref TEXT,
    p_payment_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_token_hash TEXT;
BEGIN
    IF p_order_ref IS NULL OR p_payment_token IS NULL OR trim(p_payment_token) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing order reference or payment token');
    END IF;

    v_token_hash := encode(sha256(trim(p_payment_token)::bytea), 'hex');

    SELECT id, order_ref, status, payment_status, total, payment_amount, currency, created_at
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
        'created_at', v_order.created_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. HARDENED create_order_atomic WITH TURNSTILE VERIFICATION & gen_random_uuid TOKENS
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
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    -- Enforce distinct item cap at 40
    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 2. Turnstile Bot Defense: Require verified single-use token
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

    -- 3. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF p_order->>'order_type' NOT IN ('dine_in', 'takeaway') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in or takeaway';
    END IF;

    IF p_order->>'order_type' = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 4. Read restaurant_id strictly from restaurant_settings (IGNORE client-supplied p_order.restaurant_id)
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 5. Generate order reference using gen_random_uuid-based 10+ character random code (never sequential)
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- Generate random payment_token built from two gen_random_uuid (dashes removed)
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 6. Determine payment_status strictly on the server
    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 7. Calculate subtotal and line items strictly server-side
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

        -- Enforce quantity cap 1-50
        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Item quantity must be between 1 and 50 (got % for item "%")', COALESCE(v_quantity, 0), v_item_id;
        END IF;

        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_is_available := NULL;

        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT m.price, m.name, m.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu m
            WHERE m.id = v_item_id
            LIMIT 1;
        END IF;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        IF v_is_available = false THEN
            RAISE EXCEPTION 'Item "%" is currently marked as unavailable', v_db_item_name;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.menu_item_availability mia
            WHERE mia.item_id = v_item_id AND mia.is_available = false
        ) THEN
            RAISE EXCEPTION 'Item "%" is currently marked 86''d out of stock', v_db_item_name;
        END IF;

        v_line_total := round((v_quantity * v_db_unit_price)::numeric, 2);
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 8. Read tax & currency settings
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
    LIMIT 1;

    -- Compute tax
    IF v_tax_enabled THEN
        IF v_tax_mode = 'exclusive' THEN
            v_tax_amount := round((v_computed_subtotal * v_tax_rate)::numeric, 2);
            v_computed_total := v_computed_subtotal + v_tax_amount;
        ELSE
            v_tax_amount := round((v_computed_subtotal - (v_computed_subtotal / (1 + v_tax_rate)))::numeric, 2);
            v_computed_total := v_computed_subtotal;
        END IF;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- 9. Insert Order Header with payment_token_hash
    INSERT INTO public.orders (
        order_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        subtotal,
        total,
        status,
        source,
        currency,
        payment_required,
        payment_status,
        payment_provider,
        payment_reference,
        payment_token_hash,
        created_at,
        updated_at
    )
    VALUES (
        v_order_ref,
        v_restaurant_id,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        p_order->>'order_type',
        CASE WHEN p_order->>'order_type' = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        trim(COALESCE(p_order->>'special_requests', '')),
        v_computed_subtotal,
        v_computed_total,
        'pending',
        COALESCE(p_order->>'source', 'website'),
        v_currency,
        v_payment_required,
        v_payment_status,
        NULLIF(p_order->>'payment_provider', ''),
        NULLIF(p_order->>'payment_reference', ''),
        v_payment_token_hash,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 10. Insert Line Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT m.price, m.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu m
            WHERE m.id = v_item_id
            LIMIT 1;
        END IF;

        v_line_total := round((v_quantity * v_db_unit_price)::numeric, 2);

        INSERT INTO public.order_items (
            order_id,
            restaurant_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options,
            created_at
        )
        VALUES (
            v_order_id,
            v_restaurant_id,
            v_item_id,
            v_db_item_name,
            v_quantity,
            v_db_unit_price,
            v_line_total,
            COALESCE(v_item->'selected_options', '{}'::jsonb),
            v_created_at
        );
    END LOOP;

    -- 11. Return order details including raw payment_token ONCE to browser
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'payment_token', v_raw_payment_token,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency,
        'restaurant_id', v_restaurant_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. HARDENED create_reservation_atomic WITH TURNSTILE VERIFICATION
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

    -- 1. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_reservation->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to make a reservation';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action = 'reservation'
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 2. Tenant Scoping
    v_restaurant_id := trim(COALESCE(p_reservation->>'restaurant_id', 'the-cafe-barrackpore'));
    IF length(v_restaurant_id) < 2 THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 3. Customer Name Validation
    v_customer_name := trim(COALESCE(p_reservation->>'customer_name', ''));
    IF length(v_customer_name) < 2 THEN
        RAISE EXCEPTION 'Please enter a valid full name (minimum 2 characters)';
    END IF;

    -- 4. Customer Phone Validation
    v_customer_phone := trim(COALESCE(p_reservation->>'customer_phone', ''));
    IF length(v_customer_phone) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number';
    END IF;

    -- 5. Reservation Reference
    v_res_ref := trim(COALESCE(p_reservation->>'reservation_ref', ''));
    IF v_res_ref = '' THEN
        v_res_ref := 'RES-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    END IF;

    -- 6. Date Validation
    IF p_reservation->>'reservation_date' IS NULL OR trim(p_reservation->>'reservation_date') = '' THEN
        RAISE EXCEPTION 'Please select a reservation date';
    END IF;

    BEGIN
        v_date := (p_reservation->>'reservation_date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid reservation date format';
    END;

    -- 7. Time Validation
    v_time := trim(COALESCE(p_reservation->>'reservation_time', ''));
    IF length(v_time) = 0 THEN
        RAISE EXCEPTION 'Please select a reservation time';
    END IF;

    -- 8. Party Size Validation (1 to 20 guests)
    BEGIN
        v_party_size := (p_reservation->>'party_size')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid party size';
    END;

    IF v_party_size IS NULL OR v_party_size < 1 OR v_party_size > 20 THEN
        RAISE EXCEPTION 'Party size must be between 1 and 20 guests';
    END IF;

    -- 9. Insert reservation record
    INSERT INTO public.reservations (
        reservation_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        reservation_date,
        reservation_time,
        party_size,
        special_requests,
        status,
        source,
        created_at,
        updated_at
    )
    VALUES (
        v_res_ref,
        v_restaurant_id,
        v_customer_name,
        v_customer_phone,
        v_date,
        v_time,
        v_party_size,
        NULLIF(trim(p_reservation->>'special_requests'), ''),
        COALESCE(p_reservation->>'status', 'pending'),
        COALESCE(p_reservation->>'source', 'website'),
        now(),
        now()
    )
    RETURNING id INTO v_res_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_res_id,
        'reservation_ref', v_res_ref,
        'restaurant_id', v_restaurant_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. EXECUTE PRIVILEGES ON FUNCTIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reservation_atomic(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_discount_code(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT) TO anon, authenticated, service_role;
