-- ==============================================================================
-- Migration: 010_menu_and_site_content.sql
-- Description: Dynamic Postgres Menu Catalog, Content Tables, and Storage Configuration
-- Replaces Sanity and client-side localStorage persistence with authoritative Supabase tables.
-- ==============================================================================

-- 1. DROP OLD COMPATIBILITY VIEW IF PRESENT
DROP VIEW IF EXISTS public.menu_items CASCADE;

-- 2. CREATE MENU_CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for category sorting
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON public.menu_categories (sort_order ASC);

-- 3. CREATE MENU_ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES public.menu_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL CHECK (price >= 0),
    diet TEXT,
    image_url TEXT,
    popular BOOLEAN NOT NULL DEFAULT false,
    available BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indices for fast filtering & category browsing
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items (category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items (available);
CREATE INDEX IF NOT EXISTS idx_menu_items_popular ON public.menu_items (popular);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort ON public.menu_items (sort_order ASC);

-- 4. CREATE SITE_CONTENT TABLE (for hero, story, specials, gallery)
CREATE TABLE IF NOT EXISTS public.site_content (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR MENU_CATEGORIES
-- Anyone can SELECT
DROP POLICY IF EXISTS "public_select_menu_categories" ON public.menu_categories;
CREATE POLICY "public_select_menu_categories"
ON public.menu_categories
FOR SELECT
USING (true);

-- Only active staff_profiles with role owner or manager can INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "staff_manage_menu_categories_insert" ON public.menu_categories;
CREATE POLICY "staff_manage_menu_categories_insert"
ON public.menu_categories
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_categories_update" ON public.menu_categories;
CREATE POLICY "staff_manage_menu_categories_update"
ON public.menu_categories
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_categories_delete" ON public.menu_categories;
CREATE POLICY "staff_manage_menu_categories_delete"
ON public.menu_categories
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 7. RLS POLICIES FOR MENU_ITEMS
-- Anyone can SELECT
DROP POLICY IF EXISTS "public_select_menu_items" ON public.menu_items;
CREATE POLICY "public_select_menu_items"
ON public.menu_items
FOR SELECT
USING (true);

-- Only active staff_profiles with role owner or manager can INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "staff_manage_menu_items_insert" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items_insert"
ON public.menu_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_items_update" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items_update"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_items_delete" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items_delete"
ON public.menu_items
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 8. RLS POLICIES FOR SITE_CONTENT
-- Anyone can SELECT
DROP POLICY IF EXISTS "public_select_site_content" ON public.site_content;
CREATE POLICY "public_select_site_content"
ON public.site_content
FOR SELECT
USING (true);

-- Only active staff_profiles with role owner or manager can INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "staff_manage_site_content_insert" ON public.site_content;
CREATE POLICY "staff_manage_site_content_insert"
ON public.site_content
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_site_content_update" ON public.site_content;
CREATE POLICY "staff_manage_site_content_update"
ON public.site_content
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_site_content_delete" ON public.site_content;
CREATE POLICY "staff_manage_site_content_delete"
ON public.site_content
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 9. CONFIGURE PUBLIC STORAGE BUCKET "site-images"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'site-images',
    'site-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Storage bucket RLS policies
DROP POLICY IF EXISTS "public_read_site_images" ON storage.objects;
CREATE POLICY "public_read_site_images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'site-images');

DROP POLICY IF EXISTS "staff_upload_site_images" ON storage.objects;
CREATE POLICY "staff_upload_site_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'site-images' AND
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_update_site_images" ON storage.objects;
CREATE POLICY "staff_update_site_images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'site-images' AND
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_delete_site_images" ON storage.objects;
CREATE POLICY "staff_delete_site_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'site-images' AND
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 10. REALTIME PUBLICATION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'menu_categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'menu_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'site_content'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.site_content;
    END IF;
END $$;

-- 11. SEED MENU_CATEGORIES
INSERT INTO public.menu_categories (id, name, sort_order)
VALUES
    ('burgers-pizzas', 'Burgers & Pizzas', 1),
    ('starters-momos', 'Starters & Momos', 2),
    ('mains-platters', 'Mains & Platters', 3),
    ('sips-desserts', 'Sips & Desserts', 4),
    ('soups-salads', 'Soups & Salads', 5)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- 12. SEED MENU_ITEMS (Canonical catalog from src/data/menu.ts)
INSERT INTO public.menu_items (id, category_id, name, description, price, diet, image_url, popular, available, sort_order)
VALUES
    ('hot-and-sour-soup', 'soups-salads', 'Hot And Sour Soup', 'Peppery broth with wild mushrooms, bamboo shoots and cilantro. Available in veg or chicken.', 130, 'all', NULL, false, true, 1),
    ('lemon-coriander-soup', 'soups-salads', 'Lemon Coriander Soup', 'A refreshing and tangy clear soup flavored with lemon juice and fresh coriander.', 150, 'veg', NULL, true, true, 2),
    ('chicken-clear-soup', 'soups-salads', 'Chicken Clear Soup', 'A light and soothing clear broth served with tender chicken chunks and veggies.', 150, 'nv', NULL, false, true, 3),
    ('fish-bowl-soup', 'soups-salads', 'Fish Bowl Soup', 'Hearty and aromatic seafood broth featuring fresh fish fillets.', 200, 'nv', NULL, false, true, 4),
    ('chicken-manchow-soup', 'soups-salads', 'Chicken Manchow Soup', 'Spicy dark soy-based soup topped with crunchy fried noodles.', 200, 'nv', NULL, true, true, 5),
    ('american-chopsuey', 'soups-salads', 'American Chopsuey', 'Crispy fried noodles topped with a sweet and tangy tomato-based chicken gravy.', 300, 'nv', NULL, false, true, 6),
    ('green-salad', 'soups-salads', 'Green Salad', 'Farm-fresh cucumber, tomatoes, onions, and carrots served with a wedge of lemon.', 90, 'veg', NULL, true, true, 7),
    ('chicken-salad', 'soups-salads', 'Chicken Salad', 'Grilled chicken tossed with crisp greens, cherry tomatoes, and house dressing.', 200, 'nv', NULL, true, true, 8),
    ('pasta-salad', 'soups-salads', 'Pasta Salad', 'Chilled pasta tossed with colorful veggies in a zesty vinaigrette. Add-ons available.', 250, 'all', NULL, false, true, 9),
    ('veggie-medley-burger', 'burgers-pizzas', 'Veggie Medley Burger', 'Spiced potato-corn crunch patty, caramelized onions and melted cheddar in a toasted bun.', 180, 'veg', NULL, false, true, 10),
    ('paneer-burger-1patty', 'burgers-pizzas', 'Paneer Burger (Single Patty)', 'Crispy spiced paneer patty with crisp lettuce and creamy mayo.', 200, 'veg', NULL, false, true, 11),
    ('paneer-burger-2patty', 'burgers-pizzas', 'Paneer Burger (Double Patty)', 'Double the paneer goodness! Two crispy spiced paneer patties with crisp lettuce.', 220, 'veg', NULL, true, true, 12),
    ('special-chicken-on-a-bun', 'burgers-pizzas', 'Special Chicken On A Bun', 'Flame-grilled thick chicken patty with melted mature cheddar, caramelized onions, crispy bacon & house smoked relish.', 250, 'nv', NULL, true, true, 13),
    ('margherita-pizza', 'burgers-pizzas', 'Margherita Pizza', 'San Marzano plum tomato sauce, bocconcini cheese & sweet garden basil.', 180, 'veg', NULL, true, true, 14),
    ('chicken-cheese-pizza', 'burgers-pizzas', 'Chicken Cheese Pizza', 'Hand-stretched dough, spicy herb marinara, roasted chicken & molten mozzarella.', 250, 'nv', NULL, false, true, 15),
    ('veg-steam-momo', 'starters-momos', 'Veg Steam Momo', 'Delicate dumplings stuffed with seasoned minced vegetables. Steamed to perfection.', 150, 'veg', NULL, false, true, 16),
    ('chicken-steam-momo', 'starters-momos', 'Chicken Steam Momo', 'Delicate dumpling wraps stuffed with seasoned minced chicken.', 280, 'nv', NULL, false, true, 17),
    ('chicken-pahadi-momo-steam', 'starters-momos', 'Chicken Pahadi Momo (Steam)', 'Infused with Himalayan mountain herbs and cilantro broth, steamed soft.', 200, 'nv', NULL, true, true, 18),
    ('chicken-pahadi-momo-fried', 'starters-momos', 'Chicken Pahadi Momo (Fried)', 'Infused with Himalayan mountain herbs, deep fried for a golden crunch.', 220, 'nv', NULL, false, true, 19),
    ('chicken-pahadi-momo-pan-fried', 'starters-momos', 'Chicken Pahadi Momo (Pan Fried)', 'Mountain herb infused momos, pan crisped and tossed in a spicy garlic sauce.', 250, 'nv', NULL, false, true, 20),
    ('fish-spring-roll', 'starters-momos', 'Fish Spring Roll (Pure Vetki)', 'Crispy rolls stuffed with fresh Vetki fish and oriental spices.', 200, 'nv', NULL, false, true, 21),
    ('fish-and-chips', 'starters-momos', 'Fish And Chips (Pure Vetki)', 'Fresh Bhetki fillet in airy golden batter, hand-cut fries, caper tartar sauce.', 250, 'nv', NULL, true, true, 22),
    ('fish-goujons', 'starters-momos', 'Fish Goujons', 'Crispy breaded fish fingers served with tangy tartar dip.', 240, 'nv', NULL, false, true, 23),
    ('golden-fried-prawn', 'starters-momos', 'Golden Fried Prawn', 'Crisp Japanese panko crumb crusted tiger prawns with sweet plum chilli dip.', 350, 'nv', NULL, false, true, 24),
    ('prawn-tempura', 'starters-momos', 'Prawn Tempura', 'Light and airy battered prawns, deep-fried to a delicate crisp.', 380, 'nv', NULL, false, true, 25),
    ('thai-lemon-fish', 'starters-momos', 'Thai Lemon Fish', 'Steamed or fried fish tossed in a zesty, aromatic Thai lemon and herb sauce.', 280, 'nv', NULL, false, true, 26),
    ('thai-lemon-chicken', 'starters-momos', 'Thai Lemon Chicken', 'Tender chicken chunks tossed in a zesty, aromatic Thai lemon sauce.', 250, 'nv', NULL, false, true, 27),
    ('chicken-spring-roll', 'starters-momos', 'Chicken Spring Roll', 'Crispy golden wrappers filled with savory minced chicken and veggies.', 180, 'nv', NULL, false, true, 28),
    ('crispy-chicken-wings', 'starters-momos', 'Crispy Chicken Wings', 'Perfectly seasoned, ultra-crispy fried chicken wings.', 300, 'nv', NULL, false, true, 29),
    ('drums-of-heaven', 'starters-momos', 'Drums Of Heaven', 'Crispy wing lollipops smothered in sticky caramelized garlic-chilli glaze.', 300, 'nv', NULL, true, true, 30),
    ('chicken-strips', 'starters-momos', 'Chicken Strips', 'Juicy chicken breast strips, breaded and fried till golden brown.', 250, 'nv', NULL, false, true, 31),
    ('cheese-blast-sandwich', 'starters-momos', 'Cheese Blast Sandwich', 'An explosion of molten cheese grilled between buttered bread slices.', 150, 'veg', NULL, false, true, 32),
    ('veg-sweet-corn-sandwich', 'starters-momos', 'Veg Sweet Corn Sandwich', 'Creamy sweet corn and veggie filling grilled to perfection. Add paneer optional.', 180, 'veg', NULL, false, true, 33),
    ('chicken-cheese-toastie', 'starters-momos', 'Chicken Cheese Toastie', 'Toasted sandwich loaded with spiced chicken and melted cheese.', 220, 'nv', NULL, false, true, 34),
    ('chipotle-chicken-sandwich', 'starters-momos', 'Chipotle & Buffalo Chicken Sandwich', 'Hickory smoked chicken in spicy chipotle reduction with mozzarella.', 300, 'nv', NULL, true, true, 35),
    ('club-house-sandwich', 'starters-momos', 'Club House Sandwich', 'Multi-layered classic club sandwich. Available in veg or chicken.', 250, 'all', NULL, false, true, 36),
    ('french-fries', 'starters-momos', 'French Fries', 'Classic salted crispy potato fries.', 150, 'veg', NULL, false, true, 37),
    ('cheesy-french-fries', 'starters-momos', 'Cheesy French Fries', 'Crispy fries smothered in warm, liquid cheddar cheese.', 180, 'veg', NULL, false, true, 38),
    ('crispy-chilli-babycorn', 'starters-momos', 'Crispy Chilli Babycorn', 'Golden batter baby corn wok-tossed with sweet peppers, scallions and soy.', 190, 'veg', NULL, false, true, 39),
    ('white-sauce-pasta-veg', 'mains-platters', 'White Sauce Pasta (Veg)', 'Velvety butter, garlic parmesan cream with assorted vegetables.', 180, 'veg', NULL, false, true, 40),
    ('white-sauce-pasta-chicken', 'mains-platters', 'White Sauce Pasta (Chicken)', 'Velvety butter, garlic parmesan cream with grilled chicken chunks.', 200, 'nv', NULL, false, true, 41),
    ('red-sauce-pasta-veg', 'mains-platters', 'Red Sauce Pasta (Veg)', 'Spicy Arrabbiata tomato sauce tossed with fresh veggies.', 200, 'veg', NULL, false, true, 42),
    ('red-sauce-pasta-chicken', 'mains-platters', 'Red Sauce Pasta (Chicken)', 'Spicy Arrabbiata tomato sauce tossed with tender chicken chunks.', 220, 'nv', NULL, false, true, 43),
    ('fried-rice', 'mains-platters', 'Fried Rice', 'Classic wok-tossed fried rice. Available in veg, egg, chicken, or mixed.', 160, 'all', NULL, false, true, 44),
    ('hakka-noodles', 'mains-platters', 'Hakka Noodles', 'Street-style wok-tossed noodles. Available in veg, egg, chicken, or mixed.', 150, 'all', NULL, false, true, 45),
    ('veg-manchurian', 'mains-platters', 'Veg Manchurian', 'Mixed vegetable dumplings tossed in a dark soy and garlic sauce. Dry or gravy.', 150, 'veg', NULL, false, true, 46),
    ('chilli-chicken', 'mains-platters', 'Chilli Chicken', 'Battered boneless chicken pieces in rich garlic soy gravy with peppers. Dry or gravy.', 180, 'nv', NULL, false, true, 47),
    ('hunan-chicken', 'mains-platters', 'Hunan Chicken', 'Spicy and tangy Hunan style chicken tossed with veggies.', 200, 'nv', NULL, false, true, 48),
    ('kung-pao-chicken', 'mains-platters', 'Kung Pao Chicken', 'Diced tender chicken, roasted peanuts, dry red chillies in dark sweet glaze.', 250, 'nv', NULL, false, true, 49),
    ('chinese-platter', 'mains-platters', 'Chinese Platter', 'A grand platter featuring 1pc Spring Roll, 2pcs Chicken Wings, 2pcs Chicken Lollipop, and 2pcs Chicken Cheese Balls.', 450, 'nv', NULL, true, true, 50),
    ('tandoori-platter', 'mains-platters', 'Tandoori Platter', 'Assortment of kebabs: 2pcs Reshmi, 2pcs Tikka, 2pcs Hara, and 1pc Sheek Kebab.', 550, 'nv', NULL, true, true, 51),
    ('masala-cold-drinks', 'sips-desserts', 'Masala Cold Drinks', 'Your favorite fizzy drink spiced up with a punchy chaat masala twist.', 100, 'veg', NULL, false, true, 52),
    ('lime-corial', 'sips-desserts', 'Lime Cordial', 'Sweet and tangy refreshing lime cooler.', 120, 'veg', NULL, false, true, 53),
    ('basil-lemon-mojito', 'sips-desserts', 'Basil Lemon Mojito', 'A refreshing twist on the classic mojito, muddled with fresh basil and lemon.', 150, 'veg', NULL, false, true, 54),
    ('blue-curacao-lemonade', 'sips-desserts', 'Blue Curacao Lemonade', 'Vibrant electric blue citrus liqueur, fizzy mineral soda, crushed mint sprigs.', 150, 'veg', NULL, true, true, 55),
    ('sunset-paradise', 'sips-desserts', 'Sunset Paradise', 'Passion fruit purée, fresh orange juice, ruby grenadine and fizz.', 200, 'veg', NULL, false, true, 56),
    ('summer-in-the-glass', 'sips-desserts', 'The Summer In The Glass', 'A tropical, fruity, and refreshing signature mocktail.', 200, 'veg', NULL, false, true, 57),
    ('masala-tea', 'sips-desserts', 'Masala Tea', 'Hot, spiced Indian milk tea brewed with aromatic cardamom and ginger.', 120, 'veg', NULL, false, true, 58),
    ('cappuccino', 'sips-desserts', 'Cappuccino', 'Single origin Arabica espresso pulled over velvety textured microfoam.', 120, 'veg', NULL, false, true, 59),
    ('oreo-shake', 'sips-desserts', 'Oreo Shake', 'Thick, creamy milkshake blended with crushed Oreo cookies.', 150, 'veg', NULL, false, true, 60),
    ('kitkat-shake', 'sips-desserts', 'Kitkat Shake', 'Rich chocolate milkshake blended with crispy KitKat wafers.', 150, 'veg', NULL, false, true, 61),
    ('butterscotch-shake', 'sips-desserts', 'Butterscotch Shake', 'Sweet and buttery caramel milkshake with crunchy praline bits.', 180, 'veg', NULL, false, true, 62)
ON CONFLICT (id) DO UPDATE
SET category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    diet = EXCLUDED.diet,
    image_url = EXCLUDED.image_url,
    popular = EXCLUDED.popular,
    sort_order = EXCLUDED.sort_order;

-- 13. SEED INITIAL SITE_CONTENT (hero, story, specials, gallery)
INSERT INTO public.site_content (key, value)
VALUES
    ('hero', '{
        "headline": "Step Into Barrackpore’s Trendsetting Dining Retreat",
        "subtext": "Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.",
        "src": "/images/hero-bar.webp",
        "alt": "Premium Lounge Bar"
    }'::jsonb),
    ('story', '{
        "title": "Crafting Barrackpore’s finest nocturnal escape",
        "description": "We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.",
        "src": "/images/story-pour.webp",
        "alt": "Artisanal Espresso Pour"
    }'::jsonb),
    ('specials', '{
        "title": "Special Banquet & Hangout Platters",
        "description": "Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.",
        "image": "/images/hero-bar.webp"
    }'::jsonb),
    ('gallery', '{
        "images": [
            { "src": "/images/gallery-couple.webp", "alt": "Nightlife Couple" },
            { "src": "/images/gallery-pizza.webp", "alt": "Wood-Fired Pizza" },
            { "src": "/images/gallery-beans.webp", "alt": "Artisanal Coffee Beans" },
            { "src": "/images/gallery-guitar.webp", "alt": "Acoustic Weekend Guitar" }
        ]
    }'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = timezone('utc'::text, now());

-- 14. AUTHORITATIVE create_order_atomic WITH SERVER-SIDE PRICING & PAYMENT STATUS
--     Ignores client-sent payment_status, total, unit_price, and line_total.
--     Takes only item ids and quantities, looks up prices from public.menu_items,
--     rejects items where available = false, and sets payment_status to 'pending' or 'pay_at_counter'.
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
        LIMIT 1;

        -- Fallback 1: lookup by name in public.menu_items
        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name, mi.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu_items mi
            WHERE lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name')))
            LIMIT 1;
        END IF;

        -- Fallback 2: public.menu table (if legacy table exists)
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

-- Grant permissions on both function signatures
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 15. SECURITY: Only verified webhook (service_role) may set payment_status to 'paid'
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
