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
GRANT EXECUTE ON FUNCTION public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. HARDENED POS VOID ITEM (Feature Flags + Strict Auth)
-- ------------------------------------------------------------------------------
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

    -- Strict Tax Guard: If tax is enabled and no rule matches, raise error (no 0% silent fallback)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NO_MATCHING_TAX_RULE: No active verified tax rule matches country=%, region=%, category=%, order_type=%, date=%. Tax is enabled but jurisdiction has no matching rule.',
            p_country, p_region, p_category, p_order_type, p_date;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated, anon, service_role;
