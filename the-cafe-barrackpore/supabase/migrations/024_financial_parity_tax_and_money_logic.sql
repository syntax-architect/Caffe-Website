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
            SELECT m.price, m.name, m.available, 'food'
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
