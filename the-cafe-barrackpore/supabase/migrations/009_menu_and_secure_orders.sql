-- ==============================================================================
-- Migration: 009_menu_and_secure_orders.sql
-- Description: Canonical Postgres Menu Catalog, Server-Authoritative Order Calculations,
--              and Deterministic Payment Status Allocation.
-- ==============================================================================

-- 1. CREATE CANONICAL MENU TABLE IN POSTGRES
CREATE TABLE IF NOT EXISTS public.menu (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    category TEXT,
    diet TEXT,
    description TEXT,
    image TEXT,
    tag TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for category, availability & fast lookups
CREATE INDEX IF NOT EXISTS idx_menu_category ON public.menu(category);
CREATE INDEX IF NOT EXISTS idx_menu_is_available ON public.menu(is_available);

-- Compatibility view for menu_items
CREATE OR REPLACE VIEW public.menu_items AS SELECT * FROM public.menu;

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

-- Public can read menu items
DROP POLICY IF EXISTS "public_read_menu" ON public.menu;
CREATE POLICY "public_read_menu"
    ON public.menu
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Active staff can update or insert menu items
DROP POLICY IF EXISTS "staff_manage_menu" ON public.menu;
CREATE POLICY "staff_manage_menu"
    ON public.menu
    FOR ALL
    TO authenticated
    USING (public.is_active_staff())
    WITH CHECK (public.is_active_staff());

-- 3. SEED CANONICAL RESTAURANT MENU DATA
INSERT INTO public.menu (id, name, price, category, diet, description, image, tag, is_available)
VALUES
    ('hot-and-sour-soup', 'Hot And Sour Soup', 130, 'soups-salads', 'all', 'Peppery broth with wild mushrooms, bamboo shoots and cilantro. Available in veg or chicken.', NULL, NULL, true),
    ('lemon-coriander-soup', 'Lemon Coriander Soup', 150, 'soups-salads', 'veg', 'A refreshing and tangy clear soup flavored with lemon juice and fresh coriander.', NULL, 'Healthy', true),
    ('chicken-clear-soup', 'Chicken Clear Soup', 150, 'soups-salads', 'nv', 'A light and soothing clear broth served with tender chicken chunks and veggies.', NULL, NULL, true),
    ('fish-bowl-soup', 'Fish Bowl Soup', 200, 'soups-salads', 'nv', 'Hearty and aromatic seafood broth featuring fresh fish fillets.', NULL, NULL, true),
    ('chicken-manchow-soup', 'Chicken Manchow Soup', 200, 'soups-salads', 'nv', 'Spicy dark soy-based soup topped with crunchy fried noodles.', NULL, 'Spicy', true),
    ('american-chopsuey', 'American Chopsuey', 300, 'soups-salads', 'nv', 'Crispy fried noodles topped with a sweet and tangy tomato-based chicken gravy.', NULL, NULL, true),
    ('green-salad', 'Green Salad', 90, 'soups-salads', 'veg', 'Farm-fresh cucumber, tomatoes, onions, and carrots served with a wedge of lemon.', NULL, 'Vegan', true),
    ('chicken-salad', 'Chicken Salad', 200, 'soups-salads', 'nv', 'Grilled chicken tossed with crisp greens, cherry tomatoes, and house dressing.', NULL, 'High Protein', true),
    ('pasta-salad', 'Pasta Salad', 250, 'soups-salads', 'all', 'Chilled pasta tossed with colorful veggies in a zesty vinaigrette. Add-ons available.', NULL, NULL, true),
    ('veggie-medley-burger', 'Veggie Medley Burger', 180, 'burgers-pizzas', 'veg', 'Spiced potato-corn crunch patty, caramelized onions and melted cheddar in a toasted bun.', NULL, NULL, true),
    ('paneer-burger-1patty', 'Paneer Burger (Single Patty)', 200, 'burgers-pizzas', 'veg', 'Crispy spiced paneer patty with crisp lettuce and creamy mayo.', NULL, NULL, true),
    ('paneer-burger-2patty', 'Paneer Burger (Double Patty)', 220, 'burgers-pizzas', 'veg', 'Double the paneer goodness! Two crispy spiced paneer patties with crisp lettuce.', NULL, 'Hungry', true),
    ('special-chicken-on-a-bun', 'Special Chicken On A Bun', 250, 'burgers-pizzas', 'nv', 'Flame-grilled thick chicken patty with melted mature cheddar, caramelized onions, crispy bacon & house smoked relish.', NULL, 'Crowd Favorite', true),
    ('margherita-pizza', 'Margherita Pizza', 180, 'burgers-pizzas', 'veg', 'San Marzano plum tomato sauce, bocconcini cheese & sweet garden basil.', NULL, 'Classic', true),
    ('chicken-cheese-pizza', 'Chicken Cheese Pizza', 250, 'burgers-pizzas', 'nv', 'Hand-stretched dough, spicy herb marinara, roasted chicken & molten mozzarella.', NULL, NULL, true),
    ('veg-steam-momo', 'Veg Steam Momo', 150, 'starters-momos', 'veg', 'Delicate dumplings stuffed with seasoned minced vegetables. Steamed to perfection.', NULL, NULL, true),
    ('chicken-steam-momo', 'Chicken Steam Momo', 280, 'starters-momos', 'nv', 'Delicate dumpling wraps stuffed with seasoned minced chicken.', NULL, NULL, true),
    ('chicken-pahadi-momo-steam', 'Chicken Pahadi Momo (Steam)', 200, 'starters-momos', 'nv', 'Infused with Himalayan mountain herbs and cilantro broth, steamed soft.', NULL, 'Special', true),
    ('chicken-pahadi-momo-fried', 'Chicken Pahadi Momo (Fried)', 220, 'starters-momos', 'nv', 'Infused with Himalayan mountain herbs, deep fried for a golden crunch.', NULL, NULL, true),
    ('chicken-pahadi-momo-pan-fried', 'Chicken Pahadi Momo (Pan Fried)', 250, 'starters-momos', 'nv', 'Mountain herb infused momos, pan crisped and tossed in a spicy garlic sauce.', NULL, NULL, true),
    ('fish-spring-roll', 'Fish Spring Roll (Pure Vetki)', 200, 'starters-momos', 'nv', 'Crispy rolls stuffed with fresh Vetki fish and oriental spices.', NULL, NULL, true),
    ('fish-and-chips', 'Fish And Chips (Pure Vetki)', 250, 'starters-momos', 'nv', 'Fresh Bhetki fillet in airy golden batter, hand-cut fries, caper tartar sauce.', NULL, 'Bestseller', true),
    ('fish-goujons', 'Fish Goujons', 240, 'starters-momos', 'nv', 'Crispy breaded fish fingers served with tangy tartar dip.', NULL, NULL, true),
    ('golden-fried-prawn', 'Golden Fried Prawn', 350, 'starters-momos', 'nv', 'Crisp Japanese panko crumb crusted tiger prawns with sweet plum chilli dip.', NULL, NULL, true),
    ('prawn-tempura', 'Prawn Tempura', 380, 'starters-momos', 'nv', 'Light and airy battered prawns, deep-fried to a delicate crisp.', NULL, NULL, true),
    ('thai-lemon-fish', 'Thai Lemon Fish', 280, 'starters-momos', 'nv', 'Steamed or fried fish tossed in a zesty, aromatic Thai lemon and herb sauce.', NULL, NULL, true),
    ('thai-lemon-chicken', 'Thai Lemon Chicken', 250, 'starters-momos', 'nv', 'Tender chicken chunks tossed in a zesty, aromatic Thai lemon sauce.', NULL, NULL, true),
    ('chicken-spring-roll', 'Chicken Spring Roll', 180, 'starters-momos', 'nv', 'Crispy golden wrappers filled with savory minced chicken and veggies.', NULL, NULL, true),
    ('crispy-chicken-wings', 'Crispy Chicken Wings', 300, 'starters-momos', 'nv', 'Perfectly seasoned, ultra-crispy fried chicken wings.', NULL, NULL, true),
    ('drums-of-heaven', 'Drums Of Heaven', 300, 'starters-momos', 'nv', 'Crispy wing lollipops smothered in sticky caramelized garlic-chilli glaze.', NULL, 'Spicy', true),
    ('chicken-strips', 'Chicken Strips', 250, 'starters-momos', 'nv', 'Juicy chicken breast strips, breaded and fried till golden brown.', NULL, NULL, true),
    ('cheese-blast-sandwich', 'Cheese Blast Sandwich', 150, 'starters-momos', 'veg', 'An explosion of molten cheese grilled between buttered bread slices.', NULL, NULL, true),
    ('veg-sweet-corn-sandwich', 'Veg Sweet Corn Sandwich', 180, 'starters-momos', 'veg', 'Creamy sweet corn and veggie filling grilled to perfection. Add paneer optional.', NULL, NULL, true),
    ('chicken-cheese-toastie', 'Chicken Cheese Toastie', 220, 'starters-momos', 'nv', 'Toasted sandwich loaded with spiced chicken and melted cheese.', NULL, NULL, true),
    ('chipotle-chicken-sandwich', 'Chipotle & Buffalo Chicken Sandwich', 300, 'starters-momos', 'nv', 'Hickory smoked chicken in spicy chipotle reduction with mozzarella.', NULL, 'Spicy', true),
    ('club-house-sandwich', 'Club House Sandwich', 250, 'starters-momos', 'all', 'Multi-layered classic club sandwich. Available in veg or chicken.', NULL, NULL, true),
    ('french-fries', 'French Fries', 150, 'starters-momos', 'veg', 'Classic salted crispy potato fries.', NULL, NULL, true),
    ('cheesy-french-fries', 'Cheesy French Fries', 180, 'starters-momos', 'veg', 'Crispy fries smothered in warm, liquid cheddar cheese.', NULL, NULL, true),
    ('crispy-chilli-babycorn', 'Crispy Chilli Babycorn', 190, 'starters-momos', 'veg', 'Golden batter baby corn wok-tossed with sweet peppers, scallions and soy.', NULL, NULL, true),
    ('white-sauce-pasta-veg', 'White Sauce Pasta (Veg)', 180, 'mains-platters', 'veg', 'Velvety butter, garlic parmesan cream with assorted vegetables.', NULL, NULL, true),
    ('white-sauce-pasta-chicken', 'White Sauce Pasta (Chicken)', 200, 'mains-platters', 'nv', 'Velvety butter, garlic parmesan cream with grilled chicken chunks.', NULL, NULL, true),
    ('red-sauce-pasta-veg', 'Red Sauce Pasta (Veg)', 200, 'mains-platters', 'veg', 'Spicy Arrabbiata tomato sauce tossed with fresh veggies.', NULL, NULL, true),
    ('red-sauce-pasta-chicken', 'Red Sauce Pasta (Chicken)', 220, 'mains-platters', 'nv', 'Spicy Arrabbiata tomato sauce tossed with tender chicken chunks.', NULL, NULL, true),
    ('fried-rice', 'Fried Rice', 160, 'mains-platters', 'all', 'Classic wok-tossed fried rice. Available in veg, egg, chicken, or mixed.', NULL, NULL, true),
    ('hakka-noodles', 'Hakka Noodles', 150, 'mains-platters', 'all', 'Street-style wok-tossed noodles. Available in veg, egg, chicken, or mixed.', NULL, NULL, true),
    ('veg-manchurian', 'Veg Manchurian', 150, 'mains-platters', 'veg', 'Mixed vegetable dumplings tossed in a dark soy and garlic sauce. Dry or gravy.', NULL, NULL, true),
    ('chilli-chicken', 'Chilli Chicken', 180, 'mains-platters', 'nv', 'Battered boneless chicken pieces in rich garlic soy gravy with peppers. Dry or gravy.', NULL, NULL, true),
    ('hunan-chicken', 'Hunan Chicken', 200, 'mains-platters', 'nv', 'Spicy and tangy Hunan style chicken tossed with veggies.', NULL, NULL, true),
    ('kung-pao-chicken', 'Kung Pao Chicken', 250, 'mains-platters', 'nv', 'Diced tender chicken, roasted peanuts, dry red chillies in dark sweet glaze.', NULL, NULL, true),
    ('chinese-platter', 'Chinese Platter', 450, 'mains-platters', 'nv', 'A grand platter featuring 1pc Spring Roll, 2pcs Chicken Wings, 2pcs Chicken Lollipop, and 2pcs Chicken Cheese Balls.', NULL, 'Platter', true),
    ('tandoori-platter', 'Tandoori Platter', 550, 'mains-platters', 'nv', 'Assortment of kebabs: 2pcs Reshmi, 2pcs Tikka, 2pcs Hara, and 1pc Sheek Kebab.', NULL, 'Platter', true),
    ('masala-cold-drinks', 'Masala Cold Drinks', 100, 'sips-desserts', 'veg', 'Your favorite fizzy drink spiced up with a punchy chaat masala twist.', NULL, NULL, true),
    ('lime-corial', 'Lime Cordial', 120, 'sips-desserts', 'veg', 'Sweet and tangy refreshing lime cooler.', NULL, NULL, true),
    ('basil-lemon-mojito', 'Basil Lemon Mojito', 150, 'sips-desserts', 'veg', 'A refreshing twist on the classic mojito, muddled with fresh basil and lemon.', NULL, NULL, true),
    ('blue-curacao-lemonade', 'Blue Curacao Lemonade', 150, 'sips-desserts', 'veg', 'Vibrant electric blue citrus liqueur, fizzy mineral soda, crushed mint sprigs.', NULL, 'Signature', true),
    ('sunset-paradise', 'Sunset Paradise', 200, 'sips-desserts', 'veg', 'Passion fruit purée, fresh orange juice, ruby grenadine and fizz.', NULL, NULL, true),
    ('summer-in-the-glass', 'The Summer In The Glass', 200, 'sips-desserts', 'veg', 'A tropical, fruity, and refreshing signature mocktail.', NULL, NULL, true),
    ('masala-tea', 'Masala Tea', 120, 'sips-desserts', 'veg', 'Hot, spiced Indian milk tea brewed with aromatic cardamom and ginger.', NULL, NULL, true),
    ('cappuccino', 'Cappuccino', 120, 'sips-desserts', 'veg', 'Single origin Arabica espresso pulled over velvety textured microfoam.', NULL, NULL, true),
    ('oreo-shake', 'Oreo Shake', 150, 'sips-desserts', 'veg', 'Thick, creamy milkshake blended with crushed Oreo cookies.', NULL, NULL, true),
    ('kitkat-shake', 'Kitkat Shake', 150, 'sips-desserts', 'veg', 'Rich chocolate milkshake blended with crispy KitKat wafers.', NULL, NULL, true),
    ('butterscotch-shake', 'Butterscotch Shake', 180, 'sips-desserts', 'veg', 'Sweet and buttery caramel milkshake with crunchy praline bits.', NULL, NULL, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    category = EXCLUDED.category,
    diet = EXCLUDED.diet,
    description = EXCLUDED.description,
    image = EXCLUDED.image,
    tag = EXCLUDED.tag,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc'::text, now());

-- 4. REWRITE create_order_atomic WITH AUTHORITATIVE SERVER PRICING & PAYMENT STATUS
--    Ignores client-sent payment_status, total, unit_price, and line_total.
--    Takes only item ids and quantities, looks up prices from menu_items (and fallback menu),
--    rejects items where available = false, and sets payment_status to 'pending' or 'pay_at_counter'.
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

    -- 2. Determine order reference (generate server-side if not provided or blank)
    v_order_ref := trim(COALESCE(p_order->>'order_ref', ''));
    IF v_order_ref = '' THEN
        v_order_ref := public.generate_order_reference();
    END IF;

    -- 3. Determine payment_status strictly on the server:
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

    -- 4. Calculate subtotal and line items strictly server-side:
    --    Completely IGNORES client-sent unit_price, line_total, and total.
    --    Takes only item ids and quantities, then looks up prices from menu_items / menu.
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

        -- Primary lookup: public.menu_items by ID (if table exists)
        BEGIN
            SELECT mi.price, mi.name, mi.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu_items mi
            WHERE mi.id = v_item_id
            LIMIT 1;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;

        -- Fallback 1: lookup by name in public.menu_items
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT mi.price, mi.name, mi.available
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu_items mi
                WHERE lower(trim(mi.name)) = lower(trim(v_item_id))
                   OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        -- Fallback 2: public.menu table
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name, COALESCE(m.is_available, true)
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
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

    -- 5. Fetch tax settings & compute totals server-side
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
    ORDER BY (rs.id = 'current') DESC
    LIMIT 1;

    IF v_tax_enabled IS TRUE AND v_tax_mode = 'exclusive' AND v_tax_rate > 0 THEN
        v_tax_amount := ROUND((v_computed_subtotal * v_tax_rate)::NUMERIC, 2);
        v_computed_total := v_computed_subtotal + v_tax_amount;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- 6. Insert order record with server-computed financial and payment fields
    INSERT INTO public.orders (
        order_ref,
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

    -- 7. Insert line items with server-verified prices and line totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu_items mi
            WHERE lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name')))
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
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_total', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency
    );
END;
$$;

-- Grant permissions on stored procedure
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;

-- 5. SECURITY: Only verified webhook (service_role) may set payment_status to 'paid'
CREATE OR REPLACE FUNCTION public.guard_order_payment_status_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
        IF current_user NOT IN ('postgres', 'supabase_admin')
           AND COALESCE(auth.role(), '') <> 'service_role'
           AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: Only verified webhook service role may mark an order as paid (current_role: %, auth.role: %)',
                current_user, COALESCE(auth.role(), 'none');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_payment_status_paid ON public.orders;
CREATE TRIGGER trg_guard_order_payment_status_paid
    BEFORE INSERT OR UPDATE OF payment_status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_order_payment_status_paid();
