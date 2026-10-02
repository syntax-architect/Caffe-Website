import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MenuItem, MenuCategory, EditableMenuItemInput } from '../types/menu';

export const MENU_CATEGORIES_FALLBACK: MenuCategory[] = [
  {
    "id": "burgers-pizzas",
    "name": "Burgers & Pizzas",
    "sort_order": 1
  },
  {
    "id": "starters-momos",
    "name": "Starters & Momos",
    "sort_order": 2
  },
  {
    "id": "mains-platters",
    "name": "Mains & Platters",
    "sort_order": 3
  },
  {
    "id": "sips-desserts",
    "name": "Sips & Desserts",
    "sort_order": 4
  },
  {
    "id": "soups-salads",
    "name": "Soups & Salads",
    "sort_order": 5
  }
];

export const MENU_ITEMS_FALLBACK: MenuItem[] = [
  {
    "id": "hot-and-sour-soup",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Hot And Sour Soup",
    "description": "Peppery broth with wild mushrooms, bamboo shoots and cilantro. Available in veg or chicken.",
    "price": 130,
    "diet": "all",
    "popular": false,
    "available": true,
    "sort_order": 1,
    "tag": null
  },
  {
    "id": "lemon-coriander-soup",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Lemon Coriander Soup",
    "description": "A refreshing and tangy clear soup flavored with lemon juice and fresh coriander.",
    "price": 150,
    "diet": "veg",
    "popular": true,
    "available": true,
    "sort_order": 2,
    "tag": "Healthy"
  },
  {
    "id": "chicken-clear-soup",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Chicken Clear Soup",
    "description": "A light and soothing clear broth served with tender chicken chunks and veggies.",
    "price": 150,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 3,
    "tag": null
  },
  {
    "id": "fish-bowl-soup",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Fish Bowl Soup",
    "description": "Hearty and aromatic seafood broth featuring fresh fish fillets.",
    "price": 200,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 4,
    "tag": null
  },
  {
    "id": "chicken-manchow-soup",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Chicken Manchow Soup",
    "description": "Spicy dark soy-based soup topped with crunchy fried noodles.",
    "price": 200,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 5,
    "tag": "Spicy"
  },
  {
    "id": "american-chopsuey",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "American Chopsuey",
    "description": "Crispy fried noodles topped with a sweet and tangy tomato-based chicken gravy.",
    "price": 300,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 6,
    "tag": null
  },
  {
    "id": "green-salad",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Green Salad",
    "description": "Farm-fresh cucumber, tomatoes, onions, and carrots served with a wedge of lemon.",
    "price": 90,
    "diet": "veg",
    "popular": true,
    "available": true,
    "sort_order": 7,
    "tag": "Vegan"
  },
  {
    "id": "chicken-salad",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Chicken Salad",
    "description": "Grilled chicken tossed with crisp greens, cherry tomatoes, and house dressing.",
    "price": 200,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 8,
    "tag": "High Protein"
  },
  {
    "id": "pasta-salad",
    "category_id": "soups-salads",
    "category": "soups-salads",
    "name": "Pasta Salad",
    "description": "Chilled pasta tossed with colorful veggies in a zesty vinaigrette. Add-ons available.",
    "price": 250,
    "diet": "all",
    "popular": false,
    "available": true,
    "sort_order": 9,
    "tag": null
  },
  {
    "id": "veggie-medley-burger",
    "category_id": "burgers-pizzas",
    "category": "burgers-pizzas",
    "name": "Veggie Medley Burger",
    "description": "Spiced potato-corn crunch patty, caramelized onions and melted cheddar in a toasted bun.",
    "price": 180,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 10,
    "tag": null
  },
  {
    "id": "paneer-burger-1patty",
    "category_id": "burgers-pizzas",
    "category": "burgers-pizzas",
    "name": "Paneer Burger (Single Patty)",
    "description": "Crispy spiced paneer patty with crisp lettuce and creamy mayo.",
    "price": 200,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 11,
    "tag": null
  },
  {
    "id": "paneer-burger-2patty",
    "category_id": "burgers-pizzas",
    "category": "burgers-pizzas",
    "name": "Paneer Burger (Double Patty)",
    "description": "Double the paneer goodness! Two crispy spiced paneer patties with crisp lettuce.",
    "price": 220,
    "diet": "veg",
    "popular": true,
    "available": true,
    "sort_order": 12,
    "tag": "Hungry"
  },
  {
    "id": "special-chicken-on-a-bun",
    "category_id": "burgers-pizzas",
    "category": "burgers-pizzas",
    "name": "Special Chicken On A Bun",
    "description": "Flame-grilled thick chicken patty with melted mature cheddar, caramelized onions, crispy bacon & house smoked relish.",
    "price": 250,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 13,
    "tag": "Crowd Favorite"
  },
  {
    "id": "margherita-pizza",
    "category_id": "burgers-pizzas",
    "category": "burgers-pizzas",
    "name": "Margherita Pizza",
    "description": "San Marzano plum tomato sauce, bocconcini cheese & sweet garden basil.",
    "price": 180,
    "diet": "veg",
    "popular": true,
    "available": true,
    "sort_order": 14,
    "tag": "Classic"
  },
  {
    "id": "chicken-cheese-pizza",
    "category_id": "burgers-pizzas",
    "category": "burgers-pizzas",
    "name": "Chicken Cheese Pizza",
    "description": "Hand-stretched dough, spicy herb marinara, roasted chicken & molten mozzarella.",
    "price": 250,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 15,
    "tag": null
  },
  {
    "id": "veg-steam-momo",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Veg Steam Momo",
    "description": "Delicate dumplings stuffed with seasoned minced vegetables. Steamed to perfection.",
    "price": 150,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 16,
    "tag": null
  },
  {
    "id": "chicken-steam-momo",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chicken Steam Momo",
    "description": "Delicate dumpling wraps stuffed with seasoned minced chicken.",
    "price": 280,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 17,
    "tag": null
  },
  {
    "id": "chicken-pahadi-momo-steam",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chicken Pahadi Momo (Steam)",
    "description": "Infused with Himalayan mountain herbs and cilantro broth, steamed soft.",
    "price": 200,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 18,
    "tag": "Special"
  },
  {
    "id": "chicken-pahadi-momo-fried",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chicken Pahadi Momo (Fried)",
    "description": "Infused with Himalayan mountain herbs, deep fried for a golden crunch.",
    "price": 220,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 19,
    "tag": null
  },
  {
    "id": "chicken-pahadi-momo-pan-fried",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chicken Pahadi Momo (Pan Fried)",
    "description": "Mountain herb infused momos, pan crisped and tossed in a spicy garlic sauce.",
    "price": 250,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 20,
    "tag": null
  },
  {
    "id": "fish-spring-roll",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Fish Spring Roll (Pure Vetki)",
    "description": "Crispy rolls stuffed with fresh Vetki fish and oriental spices.",
    "price": 200,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 21,
    "tag": null
  },
  {
    "id": "fish-and-chips",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Fish And Chips (Pure Vetki)",
    "description": "Fresh Bhetki fillet in airy golden batter, hand-cut fries, caper tartar sauce.",
    "price": 250,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 22,
    "tag": "Bestseller"
  },
  {
    "id": "fish-goujons",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Fish Goujons",
    "description": "Crispy breaded fish fingers served with tangy tartar dip.",
    "price": 240,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 23,
    "tag": null
  },
  {
    "id": "golden-fried-prawn",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Golden Fried Prawn",
    "description": "Crisp Japanese panko crumb crusted tiger prawns with sweet plum chilli dip.",
    "price": 350,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 24,
    "tag": null
  },
  {
    "id": "prawn-tempura",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Prawn Tempura",
    "description": "Light and airy battered prawns, deep-fried to a delicate crisp.",
    "price": 380,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 25,
    "tag": null
  },
  {
    "id": "thai-lemon-fish",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Thai Lemon Fish",
    "description": "Steamed or fried fish tossed in a zesty, aromatic Thai lemon and herb sauce.",
    "price": 280,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 26,
    "tag": null
  },
  {
    "id": "thai-lemon-chicken",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Thai Lemon Chicken",
    "description": "Tender chicken chunks tossed in a zesty, aromatic Thai lemon sauce.",
    "price": 250,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 27,
    "tag": null
  },
  {
    "id": "chicken-spring-roll",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chicken Spring Roll",
    "description": "Crispy golden wrappers filled with savory minced chicken and veggies.",
    "price": 180,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 28,
    "tag": null
  },
  {
    "id": "crispy-chicken-wings",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Crispy Chicken Wings",
    "description": "Perfectly seasoned, ultra-crispy fried chicken wings.",
    "price": 300,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 29,
    "tag": null
  },
  {
    "id": "drums-of-heaven",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Drums Of Heaven",
    "description": "Crispy wing lollipops smothered in sticky caramelized garlic-chilli glaze.",
    "price": 300,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 30,
    "tag": "Spicy"
  },
  {
    "id": "chicken-strips",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chicken Strips",
    "description": "Juicy chicken breast strips, breaded and fried till golden brown.",
    "price": 250,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 31,
    "tag": null
  },
  {
    "id": "cheese-blast-sandwich",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Cheese Blast Sandwich",
    "description": "An explosion of molten cheese grilled between buttered bread slices.",
    "price": 150,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 32,
    "tag": null
  },
  {
    "id": "veg-sweet-corn-sandwich",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Veg Sweet Corn Sandwich",
    "description": "Creamy sweet corn and veggie filling grilled to perfection. Add paneer optional.",
    "price": 180,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 33,
    "tag": null
  },
  {
    "id": "chicken-cheese-toastie",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chicken Cheese Toastie",
    "description": "Toasted sandwich loaded with spiced chicken and melted cheese.",
    "price": 220,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 34,
    "tag": null
  },
  {
    "id": "chipotle-chicken-sandwich",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Chipotle & Buffalo Chicken Sandwich",
    "description": "Hickory smoked chicken in spicy chipotle reduction with mozzarella.",
    "price": 300,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 35,
    "tag": "Spicy"
  },
  {
    "id": "club-house-sandwich",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Club House Sandwich",
    "description": "Multi-layered classic club sandwich. Available in veg or chicken.",
    "price": 250,
    "diet": "all",
    "popular": false,
    "available": true,
    "sort_order": 36,
    "tag": null
  },
  {
    "id": "french-fries",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "French Fries",
    "description": "Classic salted crispy potato fries.",
    "price": 150,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 37,
    "tag": null
  },
  {
    "id": "cheesy-french-fries",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Cheesy French Fries",
    "description": "Crispy fries smothered in warm, liquid cheddar cheese.",
    "price": 180,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 38,
    "tag": null
  },
  {
    "id": "crispy-chilli-babycorn",
    "category_id": "starters-momos",
    "category": "starters-momos",
    "name": "Crispy Chilli Babycorn",
    "description": "Golden batter baby corn wok-tossed with sweet peppers, scallions and soy.",
    "price": 190,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 39,
    "tag": null
  },
  {
    "id": "white-sauce-pasta-veg",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "White Sauce Pasta (Veg)",
    "description": "Velvety butter, garlic parmesan cream with assorted vegetables.",
    "price": 180,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 40,
    "tag": null
  },
  {
    "id": "white-sauce-pasta-chicken",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "White Sauce Pasta (Chicken)",
    "description": "Velvety butter, garlic parmesan cream with grilled chicken chunks.",
    "price": 200,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 41,
    "tag": null
  },
  {
    "id": "red-sauce-pasta-veg",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Red Sauce Pasta (Veg)",
    "description": "Spicy Arrabbiata tomato sauce tossed with fresh veggies.",
    "price": 200,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 42,
    "tag": null
  },
  {
    "id": "red-sauce-pasta-chicken",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Red Sauce Pasta (Chicken)",
    "description": "Spicy Arrabbiata tomato sauce tossed with tender chicken chunks.",
    "price": 220,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 43,
    "tag": null
  },
  {
    "id": "fried-rice",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Fried Rice",
    "description": "Classic wok-tossed fried rice. Available in veg, egg, chicken, or mixed.",
    "price": 160,
    "diet": "all",
    "popular": false,
    "available": true,
    "sort_order": 44,
    "tag": null
  },
  {
    "id": "hakka-noodles",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Hakka Noodles",
    "description": "Street-style wok-tossed noodles. Available in veg, egg, chicken, or mixed.",
    "price": 150,
    "diet": "all",
    "popular": false,
    "available": true,
    "sort_order": 45,
    "tag": null
  },
  {
    "id": "veg-manchurian",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Veg Manchurian",
    "description": "Mixed vegetable dumplings tossed in a dark soy and garlic sauce. Dry or gravy.",
    "price": 150,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 46,
    "tag": null
  },
  {
    "id": "chilli-chicken",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Chilli Chicken",
    "description": "Battered boneless chicken pieces in rich garlic soy gravy with peppers. Dry or gravy.",
    "price": 180,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 47,
    "tag": null
  },
  {
    "id": "hunan-chicken",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Hunan Chicken",
    "description": "Spicy and tangy Hunan style chicken tossed with veggies.",
    "price": 200,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 48,
    "tag": null
  },
  {
    "id": "kung-pao-chicken",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Kung Pao Chicken",
    "description": "Diced tender chicken, roasted peanuts, dry red chillies in dark sweet glaze.",
    "price": 250,
    "diet": "nv",
    "popular": false,
    "available": true,
    "sort_order": 49,
    "tag": null
  },
  {
    "id": "chinese-platter",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Chinese Platter",
    "description": "A grand platter featuring 1pc Spring Roll, 2pcs Chicken Wings, 2pcs Chicken Lollipop, and 2pcs Chicken Cheese Balls.",
    "price": 450,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 50,
    "tag": "Platter"
  },
  {
    "id": "tandoori-platter",
    "category_id": "mains-platters",
    "category": "mains-platters",
    "name": "Tandoori Platter",
    "description": "Assortment of kebabs: 2pcs Reshmi, 2pcs Tikka, 2pcs Hara, and 1pc Sheek Kebab.",
    "price": 550,
    "diet": "nv",
    "popular": true,
    "available": true,
    "sort_order": 51,
    "tag": "Platter"
  },
  {
    "id": "masala-cold-drinks",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Masala Cold Drinks",
    "description": "Your favorite fizzy drink spiced up with a punchy chaat masala twist.",
    "price": 100,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 52,
    "tag": null
  },
  {
    "id": "lime-corial",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Lime Cordial",
    "description": "Sweet and tangy refreshing lime cooler.",
    "price": 120,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 53,
    "tag": null
  },
  {
    "id": "basil-lemon-mojito",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Basil Lemon Mojito",
    "description": "A refreshing twist on the classic mojito, muddled with fresh basil and lemon.",
    "price": 150,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 54,
    "tag": null
  },
  {
    "id": "blue-curacao-lemonade",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Blue Curacao Lemonade",
    "description": "Vibrant electric blue citrus liqueur, fizzy mineral soda, crushed mint sprigs.",
    "price": 150,
    "diet": "veg",
    "popular": true,
    "available": true,
    "sort_order": 55,
    "tag": "Signature"
  },
  {
    "id": "sunset-paradise",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Sunset Paradise",
    "description": "Passion fruit purée, fresh orange juice, ruby grenadine and fizz.",
    "price": 200,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 56,
    "tag": null
  },
  {
    "id": "summer-in-the-glass",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "The Summer In The Glass",
    "description": "A tropical, fruity, and refreshing signature mocktail.",
    "price": 200,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 57,
    "tag": null
  },
  {
    "id": "masala-tea",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Masala Tea",
    "description": "Hot, spiced Indian milk tea brewed with aromatic cardamom and ginger.",
    "price": 120,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 58,
    "tag": null
  },
  {
    "id": "cappuccino",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Cappuccino",
    "description": "Single origin Arabica espresso pulled over velvety textured microfoam.",
    "price": 120,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 59,
    "tag": null
  },
  {
    "id": "oreo-shake",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Oreo Shake",
    "description": "Thick, creamy milkshake blended with crushed Oreo cookies.",
    "price": 150,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 60,
    "tag": null
  },
  {
    "id": "kitkat-shake",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Kitkat Shake",
    "description": "Rich chocolate milkshake blended with crispy KitKat wafers.",
    "price": 150,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 61,
    "tag": null
  },
  {
    "id": "butterscotch-shake",
    "category_id": "sips-desserts",
    "category": "sips-desserts",
    "name": "Butterscotch Shake",
    "description": "Sweet and buttery caramel milkshake with crunchy praline bits.",
    "price": 180,
    "diet": "veg",
    "popular": false,
    "available": true,
    "sort_order": 62,
    "tag": null
  }
];

let inMemoryMenuCache: MenuItem[] = [...MENU_ITEMS_FALLBACK];

/**
 * Fetches all menu categories ordered by sort_order.
 */
export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MENU_CATEGORIES_FALLBACK;
  }

  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return MENU_CATEGORIES_FALLBACK;
    }

    return data as MenuCategory[];
  } catch (err) {
    console.warn('[menuService] Error fetching menu categories, using fallback:', err);
    return MENU_CATEGORIES_FALLBACK;
  }
}

/**
 * Fetches all menu items ordered by sort_order and name.
 * Populates in-memory cache and returns canonical catalog.
 */
export async function fetchMenuItems(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return inMemoryMenuCache;
  }

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('[menuService] Error loading menu_items from database, using cached fallback:', error.message);
      return inMemoryMenuCache;
    }

    if (Array.isArray(data) && data.length > 0) {
      inMemoryMenuCache = data.map((row: any) => ({
        ...row,
        category: row.category_id,
        image: row.image_url,
        tag: row.popular ? 'Bestseller' : null,
      }));
    }

    return inMemoryMenuCache;
  } catch (err) {
    console.error('[menuService] Exception loading menu_items:', err);
    return inMemoryMenuCache;
  }
}

/**
 * Looks up a canonical menu item by id or name authoritatively.
 */
export async function getCanonicalMenuItem(idOrName: string): Promise<MenuItem | null> {
  const clean = String(idOrName || '').trim().toLowerCase();
  if (!clean) return null;

  // Check cache first
  const cached = inMemoryMenuCache.find(
    (m) => m.id.toLowerCase() === clean || m.name.toLowerCase() === clean
  );
  if (cached) return cached;

  // If not in cache and Supabase is configured, query database
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .or(`id.eq.${clean},name.ilike.${clean}`)
        .maybeSingle();

      if (!error && data) {
        const item: MenuItem = {
          ...data,
          category: data.category_id,
          image: data.image_url,
          tag: data.popular ? 'Bestseller' : null,
        };
        // Add to cache
        inMemoryMenuCache.push(item);
        return item;
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Inserts or updates a menu item in table 'menu_items'.
 * Enforces RLS: only active staff with role 'owner' or 'manager' are permitted.
 */
export async function upsertMenuItem(
  item: EditableMenuItemInput
): Promise<{ success: boolean; item?: MenuItem; error?: string }> {
  const targetId = item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const payload = {
    id: targetId,
    category_id: item.category_id,
    name: item.name.trim(),
    description: item.description?.trim() || null,
    price: Number(item.price),
    diet: item.diet || 'veg',
    image_url: item.image_url || null,
    popular: Boolean(item.popular),
    available: item.available !== false,
    sort_order: item.sort_order ?? 0,
    allergens: item.allergens || [],
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase) {
    const formattedItem: MenuItem = {
      ...payload,
      category: payload.category_id,
      image: payload.image_url || undefined,
      description: payload.description || '',
      allergens: payload.allergens,
      tag: payload.popular ? 'Bestseller' : null,
    };
    const existingIdx = inMemoryMenuCache.findIndex((i) => i.id === targetId);
    if (existingIdx !== -1) {
      inMemoryMenuCache[existingIdx] = formattedItem;
    } else {
      inMemoryMenuCache.unshift(formattedItem);
    }
    return { success: true, item: formattedItem };
  }

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[menuService] Error saving menu item:', error.message);
      if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
        return {
          success: false,
          error: 'Access denied: Only active restaurant owners and managers can modify the menu catalog.',
        };
      }
      return { success: false, error: error.message };
    }

    const saved: MenuItem = {
      ...data,
      category: data.category_id,
      image: data.image_url,
      tag: data.popular ? 'Bestseller' : null,
    };

    const existingIdx = inMemoryMenuCache.findIndex((i) => i.id === targetId);
    if (existingIdx !== -1) {
      inMemoryMenuCache[existingIdx] = saved;
    } else {
      inMemoryMenuCache.unshift(saved);
    }

    return { success: true, item: saved };
  } catch (err: any) {
    console.error('[menuService] Exception saving menu item:', err);
    return { success: false, error: err.message || 'Failed to save menu item.' };
  }
}

/**
 * Toggles or updates the operational availability of a menu item in table 'menu_items'.
 */
export async function updateMenuItemAvailability(
  id: string,
  available: boolean
): Promise<{ success: boolean; error?: string }> {
  // Update cache immediately
  const cached = inMemoryMenuCache.find((i) => i.id === id);
  if (cached) {
    cached.available = available;
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('menu_items')
      .update({
        available,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[menuService] Error updating availability:', error.message);
      return { success: false, error: error.message };
    }

    // Also sync legacy availability map for backwards compatibility
    try {
      await supabase
        .from('menu_item_availability')
        .upsert({
          item_id: id,
          is_available: available,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'item_id' });
    } catch {
      // Ignore legacy sync errors
    }

    return { success: true };
  } catch (err: any) {
    console.error('[menuService] Exception updating availability:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Deletes a menu item from table 'menu_items'.
 * Enforces RLS: owner/manager only.
 */
export async function deleteMenuItem(
  id: string
): Promise<{ success: boolean; error?: string }> {
  inMemoryMenuCache = inMemoryMenuCache.filter((i) => i.id !== id);

  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[menuService] Error deleting menu item:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[menuService] Exception deleting menu item:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Subscribes to Supabase Realtime changes on 'menu_items' and 'menu_categories'.
 * Updates are pushed live to customer and staff devices without redeploying.
 */
export function subscribeToMenuRealtime(
  onItemsChange: () => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  try {
    const channelName = `realtime-menu-${Date.now()}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        async () => {
          await fetchMenuItems();
          onItemsChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories' },
        async () => {
          await fetchMenuItems();
          onItemsChange();
        }
      )
      .subscribe();

    const client = supabase;
    return () => {
      if (client) {
        client.removeChannel(channel);
      }
    };
  } catch (err) {
    console.warn('[menuService] Could not establish menu realtime subscription:', err);
    return () => {};
  }
}
