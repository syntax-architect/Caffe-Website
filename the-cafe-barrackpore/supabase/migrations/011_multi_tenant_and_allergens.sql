-- ==============================================================================
-- Migration: 011_multi_tenant_and_allergens.sql
-- Description:
-- 1. Multi-Tenant Foundation: Adds restaurant_id column to all 12 platform tables.
-- 2. Scopes Row Level Security (RLS) policies by restaurant_id.
-- 3. Adds allergen tags column to menu_items table.
-- ==============================================================================

-- 1. ADD restaurant_id TO ALL PLATFORM TABLES (DEFAULT 'the-cafe-barrackpore')
DO $$
BEGIN
    -- 1. orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders (restaurant_id);
    END IF;

    -- 2. order_items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON public.order_items (restaurant_id);
    END IF;

    -- 3. reservations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON public.reservations (restaurant_id);
    END IF;

    -- 4. staff_profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_profiles') THEN
        ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_restaurant_id ON public.staff_profiles (restaurant_id);
    END IF;

    -- 5. restaurant_tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_tables') THEN
        ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant_id ON public.restaurant_tables (restaurant_id);
    END IF;

    -- 6. restaurant_settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_settings') THEN
        ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_restaurant_settings_restaurant_id ON public.restaurant_settings (restaurant_id);
    END IF;

    -- 7. menu_item_availability
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_item_availability') THEN
        ALTER TABLE public.menu_item_availability ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_item_availability_restaurant_id ON public.menu_item_availability (restaurant_id);
    END IF;

    -- 8. payments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id ON public.payments (restaurant_id);
    END IF;

    -- 9. menu (legacy)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu') THEN
        ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_restaurant_id ON public.menu (restaurant_id);
    END IF;

    -- 10. menu_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
        ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON public.menu_categories (restaurant_id);
    END IF;

    -- 11. menu_items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
        ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items (restaurant_id);
        
        -- Add allergen tags array column
        ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS idx_menu_items_allergens ON public.menu_items USING GIN (allergens);
    END IF;

    -- 12. site_content
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_content') THEN
        ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_site_content_restaurant_id ON public.site_content (restaurant_id);
    END IF;
END $$;

-- 2. MULTI-TENANT CONTEXT HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.get_auth_restaurant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT restaurant_id 
    FROM public.staff_profiles 
    WHERE user_id = auth.uid() 
      AND active = true 
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_restaurant_id() TO anon, authenticated, service_role;

-- 3. SCOPE RLS POLICIES BY restaurant_id

-- 3.1 ORDERS RLS
DROP POLICY IF EXISTS "staff_select_orders_tenant" ON public.orders;
CREATE POLICY "staff_select_orders_tenant"
ON public.orders
FOR SELECT
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
    OR (auth.role() = 'anon' AND restaurant_id IS NOT NULL)
);

DROP POLICY IF EXISTS "staff_update_orders_tenant" ON public.orders;
CREATE POLICY "staff_update_orders_tenant"
ON public.orders
FOR UPDATE
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

-- 3.2 RESERVATIONS RLS
DROP POLICY IF EXISTS "staff_select_reservations_tenant" ON public.reservations;
CREATE POLICY "staff_select_reservations_tenant"
ON public.reservations
FOR SELECT
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

DROP POLICY IF EXISTS "staff_update_reservations_tenant" ON public.reservations;
CREATE POLICY "staff_update_reservations_tenant"
ON public.reservations
FOR UPDATE
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

-- 3.3 MENU CATEGORIES & ITEMS RLS
DROP POLICY IF EXISTS "public_select_menu_categories_tenant" ON public.menu_categories;
CREATE POLICY "public_select_menu_categories_tenant"
ON public.menu_categories
FOR SELECT
USING (restaurant_id IS NOT NULL);

DROP POLICY IF EXISTS "staff_modify_menu_categories_tenant" ON public.menu_categories;
CREATE POLICY "staff_modify_menu_categories_tenant"
ON public.menu_categories
FOR ALL
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

DROP POLICY IF EXISTS "public_select_menu_items_tenant" ON public.menu_items;
CREATE POLICY "public_select_menu_items_tenant"
ON public.menu_items
FOR SELECT
USING (restaurant_id IS NOT NULL);

DROP POLICY IF EXISTS "staff_modify_menu_items_tenant" ON public.menu_items;
CREATE POLICY "staff_modify_menu_items_tenant"
ON public.menu_items
FOR ALL
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

-- 3.4 SITE CONTENT RLS
DROP POLICY IF EXISTS "public_select_site_content_tenant" ON public.site_content;
CREATE POLICY "public_select_site_content_tenant"
ON public.site_content
FOR SELECT
USING (restaurant_id IS NOT NULL);

DROP POLICY IF EXISTS "staff_modify_site_content_tenant" ON public.site_content;
CREATE POLICY "staff_modify_site_content_tenant"
ON public.site_content
FOR ALL
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

-- 3.5 RESTAURANT TABLES & AVAILABILITY RLS
DROP POLICY IF EXISTS "staff_manage_tables_tenant" ON public.restaurant_tables;
CREATE POLICY "staff_manage_tables_tenant"
ON public.restaurant_tables
FOR ALL
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
    OR (auth.role() = 'anon' AND active = true)
);

DROP POLICY IF EXISTS "staff_manage_availability_tenant" ON public.menu_item_availability;
CREATE POLICY "staff_manage_availability_tenant"
ON public.menu_item_availability
FOR ALL
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
    OR auth.role() = 'anon'
);

-- 4. UPDATE create_order_atomic WITH restaurant_id PROPAGATION
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
    -- 1. Validate input structures
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 2. Tenant propagation
    v_restaurant_id := trim(COALESCE(p_order->>'restaurant_id', 'the-cafe-barrackpore'));

    -- 3. Determine order reference (generate server-side if not provided or blank)
    v_order_ref := trim(COALESCE(p_order->>'order_ref', ''));
    IF v_order_ref = '' THEN
        v_order_ref := public.generate_order_reference();
    END IF;

    -- 4. Determine payment_status strictly on the server:
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

    -- 5. Calculate subtotal and line items strictly server-side:
    --    Completely IGNORES client-sent unit_price, line_total, and total.
    --    Takes only item ids and quantities, then looks up prices from menu_items.
    --    Rejects items where available = false.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
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

    -- 6. Fetch tax settings & compute totals server-side
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

    -- 7. Insert order record with server-computed financial and payment fields
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
        NULLIF(trim(p_order->>'idempotency_key'), ''),
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 8. Insert line items with server-verified prices and line totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));

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

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
