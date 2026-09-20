export interface MenuItem {
  id: string;
  category: string;
  name: string;
  diet: string;
  price: number;
  description: string;
  image?: string;
  tag?: string | null;
}

export const menuData: MenuItem[] = [
  {
    "id": "special-chicken-on-a-bun",
    "category": "burgers-pizzas",
    "name": "Special Chicken On A Bun",
    "diet": "nv",
    "price": 250,
    "description": "Flame-grilled thick\n                    chicken patty with melted mature cheddar, caramelized onions, crispy bacon & house smoked\n                    relish.",
    "image": "/images/menu/menu_img_2.webp",
    "tag": "Crowd Favoriteadd_shopping_cart\n                    Add"
  },
  {
    "id": "chicken-pahadi-momos",
    "category": "starters-momos",
    "name": "Chicken Pahadi Momos",
    "diet": "nv",
    "price": 200,
    "description": "Infused with Himalayan\n                    mountain herbs, cilantro broth, steamed or pan-crisped, paired with house fire-charred dip.",
    "image": "/images/menu/menu_img_0.webp",
    "tag": "Cafe Legend"
  },
  {
    "id": "blue-curacao-lemonade",
    "category": "sips-desserts",
    "name": "Blue Curacao Lemonade",
    "diet": "veg",
    "price": 150,
    "description": "Vibrant electric blue\n                    citrus liqueur, fizzy mineral soda, crushed mint sprigs and sun-dried dehydrated lime wheel.",
    "image": "/images/menu/menu_img_3.webp",
    "tag": "Signature Sip"
  },
  {
    "id": "chicken-steamed-momos",
    "category": "starters-momos",
    "name": "Chicken Steamed Momos",
    "diet": "nv",
    "price": 280,
    "description": "Delicate dumpling wraps,\n                      seasoned chicken broth & spicy mountain relish.",
    "image": "/images/menu/menu_img_0.webp",
    "tag": null
  },
  {
    "id": "veggie-steamed-momos",
    "category": "starters-momos",
    "name": "Veggie Steamed Momos",
    "diet": "veg",
    "price": 150,
    "description": "Minced cabbage, carrot,\n                      ginger and scallions steamed in bamboo baskets.",
    "tag": "Pure\n                    Veg"
  },
  {
    "id": "golden-fried-prawns",
    "category": "starters-momos",
    "name": "Golden Fried Prawns",
    "diet": "nv",
    "price": 350,
    "description": "Crisp Japanese panko\n                      crumb crusted tiger prawns with sweet plum chilli dip.",
    "tag": null
  },
  {
    "id": "calcutta-fish-&-chips",
    "category": "starters-momos",
    "name": "Calcutta Fish & Chips",
    "diet": "nv",
    "price": 250,
    "description": "Fresh Bhetki fillet in\n                      airy golden batter, hand-cut fries, caper tartar sauce.",
    "tag": null
  },
  {
    "id": "drums-of-heaven",
    "category": "starters-momos",
    "name": "Drums Of Heaven",
    "diet": "nv",
    "price": 300,
    "description": "Crispy wing lollipops\n                      smothered in sticky caramelized garlic-chilli glaze.",
    "tag": null
  },
  {
    "id": "crispy-chilli-babycorn",
    "category": "starters-momos",
    "name": "Crispy Chilli Babycorn",
    "diet": "veg",
    "price": 190,
    "description": "Golden batter baby corn\n                      wok-tossed with sweet peppers, scallions and soy.",
    "tag": "Spicy"
  },
  {
    "id": "chicken-cheese-pizza",
    "category": "burgers-pizzas",
    "name": "Chicken Cheese Pizza",
    "diet": "nv",
    "price": 250,
    "description": "Hand-stretched dough,\n                      spicy herb marinara, roasted chicken & mozzarella.",
    "image": "/images/menu/menu_img_1.webp",
    "tag": null
  },
  {
    "id": "classic-margherita-pizza",
    "category": "burgers-pizzas",
    "name": "Classic Margherita Pizza",
    "diet": "veg",
    "price": 180,
    "description": "San Marzano plum tomato\n                      sauce, bocconcini cheese & sweet garden basil.",
    "tag": "Italian"
  },
  {
    "id": "veggie-medley-burger",
    "category": "burgers-pizzas",
    "name": "Veggie Medley Burger",
    "diet": "veg",
    "price": 180,
    "description": "Spiced potato-corn\n                      crunch patty, caramelized onions and melted cheddar.",
    "tag": null
  },
  {
    "id": "chipotle-chicken-sandwich",
    "category": "burgers-pizzas",
    "name": "Chipotle Chicken Sandwich",
    "diet": "nv",
    "price": 300,
    "description": "Hickory smoked chicken\n                      in spicy chipotle reduction with mozzarella.",
    "tag": null
  },
  {
    "id": "white-sauce-pasta",
    "category": "burgers-pizzas",
    "name": "White Sauce Pasta",
    "diet": "all",
    "price": 180,
    "description": "Velvety butter, garlic\n                      parmesan cream with mushrooms or chicken.",
    "tag": null
  },
  {
    "id": "hot-and-sour-soup",
    "category": "soups-salads",
    "name": "Hot And Sour Soup",
    "diet": "nv",
    "price": 130,
    "description": "Peppery broth with wild\n                      mushrooms, bamboo shoots and cilantro.",
    "tag": null
  },
  {
    "id": "kung-pao-chicken",
    "category": "mains-platters",
    "name": "Kung Pao Chicken",
    "diet": "nv",
    "price": 250,
    "description": "Diced tender chicken,\n                      roasted peanuts, dry red chillies in dark sweet glaze.",
    "tag": null
  },
  {
    "id": "classic-chilli-chicken",
    "category": "mains-platters",
    "name": "Classic Chilli Chicken",
    "diet": "nv",
    "price": 180,
    "description": "Battered boneless\n                      chicken pieces in rich garlic soy gravy with peppers.",
    "tag": null
  },
  {
    "id": "artisanal-cappuccino",
    "category": "sips-desserts",
    "name": "Artisanal Cappuccino",
    "diet": "veg",
    "price": 140,
    "description": "Single origin Arabica\n                      espresso pulled over velvety textured microfoam.",
    "tag": null
  },
  {
    "id": "sunset-paradise-mocktail",
    "category": "sips-desserts",
    "name": "Sunset Paradise Mocktail",
    "diet": "veg",
    "price": 200,
    "description": "Passion fruit purée,\n                      fresh orange juice, ruby grenadine and fizz.",
    "tag": null
  }
];
