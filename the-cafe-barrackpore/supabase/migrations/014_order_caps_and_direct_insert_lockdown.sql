-- ==============================================================================
-- Migration: 014_order_caps_and_direct_insert_lockdown.sql
-- Description:
-- 1. Quantity & Item Caps: Enforce 1-50 quantity limit per item (raises error otherwise)
--    and cap items per order at 40 in create_order_atomic.
-- 2. Lockdown Direct Table Inserts: Drop public insertion policies and REVOKE INSERT
--    on orders, order_items, and reservations from anon and authenticated roles.
-- 3. Stored Procedure Enforcement: Mandate that orders must only be created through
--    create_order_atomic (SECURITY DEFINER) and reservations through create_reservation_atomic (SECURITY DEFINER).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP PUBLIC INSERTION POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public order insertion" ON public.orders;
DROP POLICY IF EXISTS "Allow public order_items insertion" ON public.order_items;
DROP POLICY IF EXISTS "Allow public order item insertion" ON public.order_items;
DROP POLICY IF EXISTS "Allow public reservation insertion" ON public.reservations;

-- ------------------------------------------------------------------------------
-- 2. REVOKE DIRECT TABLE INSERT PRIVILEGES FROM anon AND authenticated
-- ------------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.orders FROM anon, authenticated;
REVOKE INSERT ON TABLE public.order_items FROM anon, authenticated;
REVOKE INSERT ON TABLE public.reservations FROM anon, authenticated;

-- Ensure service_role retains administrative privileges
GRANT ALL ON TABLE public.orders TO service_role;
GRANT ALL ON TABLE public.order_items TO service_role;
GRANT ALL ON TABLE public.reservations TO service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDENED create_order_atomic (SECURITY DEFINER) WITH QUANTITY & ITEM CAPS
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
    -- 1. Validate items array presence
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 2. Cap items per order at 40
    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items (got %)', jsonb_array_length(p_items);
    END IF;

    -- 3. Tenant propagation
    v_restaurant_id := trim(COALESCE(p_order->>'restaurant_id', 'the-cafe-barrackpore'));

    -- 4. Determine order reference (generate server-side if not provided or blank)
    v_order_ref := trim(COALESCE(p_order->>'order_ref', ''));
    IF v_order_ref = '' THEN
        v_order_ref := public.generate_order_reference();
    END IF;

    -- 5. Determine payment_status strictly on the server:
    --    Sets payment_status to 'pending' for online payment or 'pay_at_counter' otherwise.
    --    Completely IGNORES client-sent payment_status.
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

    -- 6. Calculate subtotal and line items strictly server-side:
    --    Completely IGNORES client-sent unit_price, line_total, and total.
    --    Validates quantity between 1 and 50 (raising an exception otherwise).
    --    Takes only item ids and quantities, then looks up prices from menu_items.
    --    Rejects items where available = false.
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
        v_is_available := NULL;

        -- Primary lookup: public.menu_items by ID
        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        -- Fallback 1: lookup by name in public.menu_items
        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name, mi.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu_items mi
            WHERE (lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name'))))
              AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
            LIMIT 1;
        END IF;

        -- Fallback 2: public.menu table (if legacy table exists)
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name, COALESCE(m.is_available, true)
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu m
                WHERE (m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name'))))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        -- Reject if item does not exist
        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        -- Reject if item is not available (available = false)
        IF v_is_available IS FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable / sold out', COALESCE(v_db_item_name, v_item_id);
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 7. Fetch tax settings & compute totals server-side
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
    WHERE (rs.restaurant_id = v_restaurant_id OR rs.restaurant_id IS NULL)
    ORDER BY (rs.id = 'current') DESC
    LIMIT 1;

    IF v_tax_enabled IS TRUE AND v_tax_mode = 'exclusive' AND v_tax_rate > 0 THEN
        v_tax_amount := ROUND((v_computed_subtotal * v_tax_rate)::NUMERIC, 2);
        v_computed_total := v_computed_subtotal + v_tax_amount;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- Handle discount amount if applicable
    v_discount_amount := COALESCE((p_order->>'discount_amount')::NUMERIC, 0.00);
    IF v_discount_amount < 0 THEN
        v_discount_amount := 0.00;
    END IF;
    v_computed_total := GREATEST(0.00, v_computed_total - v_discount_amount);

    -- 8. Insert order record with server-computed financial and payment fields
    INSERT INTO public.orders (
        order_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        order_source,
        source,
        subtotal,
        tax_total,
        total,
        status,
        currency,
        payment_required,
        payment_status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_amount,
        discount_code,
        discount_amount,
        idempotency_key,
        created_at,
        updated_at
    )
    VALUES (
        v_order_ref,
        v_restaurant_id,
        COALESCE(trim(p_order->>'customer_name'), 'Guest'),
        COALESCE(trim(p_order->>'customer_phone'), ''),
        COALESCE(p_order->>'order_type', 'takeaway'),
        CASE WHEN p_order->>'order_type' = 'dine_in' THEN NULLIF(trim(p_order->>'table_number'), '') ELSE NULL END,
        NULLIF(trim(p_order->>'special_requests'), ''),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        COALESCE(p_order->>'currency', v_currency, 'INR'),
        v_payment_required,
        v_payment_status,
        v_payment_method,
        NULLIF(trim(p_order->>'payment_provider'), ''),
        NULLIF(trim(p_order->>'payment_reference'), ''),
        v_computed_total,
        NULLIF(trim(p_order->>'discount_code'), ''),
        v_discount_amount,
        NULLIF(trim(p_order->>'idempotency_key'), ''),
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 9. Insert line items with server-verified prices and line totals
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
            SELECT mi.price, mi.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu_items mi
            WHERE (lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name'))))
              AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
            LIMIT 1;
        END IF;

        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name
                INTO v_db_unit_price, v_db_item_name
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);

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
            COALESCE(v_db_item_name, v_item_id),
            v_quantity,
            v_db_unit_price,
            v_line_total,
            COALESCE(v_item->'selected_options', '{}'::jsonb),
            v_created_at
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'restaurant_id', v_restaurant_id,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_total', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency
    );
END;
$$;

-- Backward-compatibility wrapper for scalar parameter calls
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_order_type TEXT,
    p_items JSONB,
    p_table_number TEXT DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    p_order_source TEXT DEFAULT 'website',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.create_order_atomic(
        jsonb_build_object(
            'customer_name', p_customer_name,
            'customer_phone', p_customer_phone,
            'order_type', p_order_type,
            'table_number', p_table_number,
            'special_requests', p_special_requests,
            'source', p_order_source,
            'idempotency_key', p_idempotency_key,
            'payment_method', 'online'
        ),
        p_items
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. HARDENED create_reservation_atomic (SECURITY DEFINER)
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
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_party_size INTEGER;
    v_date DATE;
    v_time TEXT;
BEGIN
    IF p_reservation IS NULL OR jsonb_typeof(p_reservation) <> 'object' THEN
        RAISE EXCEPTION 'Reservation payload must be a valid JSON object';
    END IF;

    -- Tenant Scoping
    v_restaurant_id := trim(COALESCE(p_reservation->>'restaurant_id', 'the-cafe-barrackpore'));
    IF length(v_restaurant_id) < 2 THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- Customer Name Validation
    v_customer_name := trim(COALESCE(p_reservation->>'customer_name', ''));
    IF length(v_customer_name) < 2 THEN
        RAISE EXCEPTION 'Please enter a valid full name (minimum 2 characters)';
    END IF;

    -- Customer Phone Validation
    v_customer_phone := trim(COALESCE(p_reservation->>'customer_phone', ''));
    IF length(v_customer_phone) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number';
    END IF;

    -- Reservation Reference
    v_res_ref := trim(COALESCE(p_reservation->>'reservation_ref', ''));
    IF v_res_ref = '' THEN
        v_res_ref := 'RES-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    END IF;

    -- Date Validation
    IF p_reservation->>'reservation_date' IS NULL OR trim(p_reservation->>'reservation_date') = '' THEN
        RAISE EXCEPTION 'Please select a reservation date';
    END IF;

    BEGIN
        v_date := (p_reservation->>'reservation_date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid reservation date format';
    END;

    -- Time Validation
    v_time := trim(COALESCE(p_reservation->>'reservation_time', ''));
    IF length(v_time) = 0 THEN
        RAISE EXCEPTION 'Please select a reservation time';
    END IF;

    -- Party Size Validation (1 to 20 guests)
    BEGIN
        v_party_size := (p_reservation->>'party_size')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid party size';
    END;

    IF v_party_size IS NULL OR v_party_size < 1 OR v_party_size > 20 THEN
        RAISE EXCEPTION 'Party size must be between 1 and 20 guests';
    END IF;

    -- Insert reservation record
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
-- 5. FUNCTION EXECUTION GRANTS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reservation_atomic(JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(JSONB) TO anon, authenticated, service_role;
