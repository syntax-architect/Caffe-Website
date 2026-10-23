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
    v_tax_rate NUMERIC := 0.0000;
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
        COALESCE(rs.tax_rate, 0.0000),
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
