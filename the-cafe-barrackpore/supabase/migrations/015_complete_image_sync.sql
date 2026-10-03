-- ==============================================================================
-- Migration: 015_complete_image_sync.sql
-- Description: Seed complete site_content keys for full image synchronization:
--              hero, story, aboutVibe (atmosphere cards), specials (with platter combos),
--              gallery (ambiance photos), and branding (logo).
-- ==============================================================================

INSERT INTO public.site_content (key, value, restaurant_id)
VALUES
    ('hero', '{
        "headline": "Step Into Barrackpore’s Trendsetting Dining Retreat",
        "subtext": "Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.",
        "src": "/images/hero-cinematic.jpg",
        "alt": "The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge"
    }'::jsonb, 'the-cafe-barrackpore'),
    ('story', '{
        "title": "Crafting Barrackpore’s finest nocturnal escape",
        "description": "We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.",
        "src": "/images/story-pour.webp",
        "alt": "Artisanal Espresso Pour"
    }'::jsonb, 'the-cafe-barrackpore'),
    ('aboutVibe', '{
        "images": [
            { "src": "/images/components/comp_img_0_highres.jpg", "alt": "Midnight Velvet Booth Seating" },
            { "src": "/images/components/comp_img_2.webp", "alt": "Live Acoustic & Reading Nook" },
            { "src": "/images/components/comp_img_3.webp", "alt": "Signature Brew Bar & Mixology" },
            { "src": "/images/components/comp_img_1.webp", "alt": "Artisan Platters and Comfort Food" }
        ]
    }'::jsonb, 'the-cafe-barrackpore'),
    ('specials', '{
        "title": "Special Banquet & Hangout Platters",
        "description": "Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.",
        "image": "/images/hero-bar.webp",
        "combos": [
            {
                "id": "combo-chinese-platter",
                "name": "Chinese Platter",
                "category": "mains-platters",
                "diet": "nv",
                "price": 380,
                "badge": "CHINESE BANQUET",
                "serves": "2–3 Guests",
                "description": "Delicate steamed momos, golden spring rolls & wok-tossed spicy chilli bites.",
                "image": "/images/platters/platter-chinese.webp"
            },
            {
                "id": "combo-tandoori-platter",
                "name": "Tandoori Platter",
                "category": "mains-platters",
                "diet": "nv",
                "price": 450,
                "badge": "TANDOORI ROYALE",
                "serves": "2–3 Guests",
                "description": "Smoky clay oven kebabs, succulent tikka, fresh mint chutney & garlic butter naan.",
                "image": "/images/platters/platter-tandoori.webp"
            },
            {
                "id": "combo-rice-noodles-bowl",
                "name": "Rice & Noodles Bowl",
                "category": "mains-platters",
                "diet": "all",
                "price": 240,
                "badge": "PAN-ASIAN SHARING",
                "serves": "1–2 Guests",
                "description": "Wok-tossed Hakka noodles, fragrant fried rice & crispy Manchurian gravy.",
                "image": "/images/platters/platter-bowl.webp"
            }
        ]
    }'::jsonb, 'the-cafe-barrackpore'),
    ('gallery', '{
        "images": [
            { "src": "/images/gallery-couple.webp", "alt": "Nightlife Couple" },
            { "src": "/images/gallery-pizza.webp", "alt": "Wood-Fired Pizza" },
            { "src": "/images/gallery-beans.webp", "alt": "Artisanal Coffee Beans" },
            { "src": "/images/gallery-guitar.webp", "alt": "Acoustic Weekend Guitar" }
        ]
    }'::jsonb, 'the-cafe-barrackpore'),
    ('branding', '{
        "logoUrl": "/logo.webp",
        "alt": "The Café Barrackpore Crest"
    }'::jsonb, 'the-cafe-barrackpore')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = timezone('utc'::text, now());
