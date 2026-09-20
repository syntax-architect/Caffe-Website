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
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuDgChETPgDQlkXTYSHuvIhM2BJXxWN-3MWvW7rhNQ0p3QKVDNXgcBjq3sjYznE5yjnvZ_UHGsh7HrbagS_jacch8jg_wIhKeixv0fs0qBjaq0eSxuzPGe3NefwG37k3zuo2UBcnhqI7ZD1D43VyTbBItKNcfyzzIP58X2yMUK5iLQiSwuYHzGOQxnaI5He9Ql655QIAy_Kwo9vKoPI1kurtNT8fUxYjjtr0Ng2-wF7oe1q520Nx9Al0bA",
    "tag": "Crowd Favoriteadd_shopping_cart\n                    Add"
  },
  {
    "id": "chicken-pahadi-momos",
    "category": "starters-momos",
    "name": "Chicken Pahadi Momos",
    "diet": "nv",
    "price": 200,
    "description": "Infused with Himalayan\n                    mountain herbs, cilantro broth, steamed or pan-crisped, paired with house fire-charred dip.",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBLOAw2Auk6qI-1rfomWyNMGYFujjyNpQqJAr8cD2adSPFPdMoimrtTQCd5IXaspp7KNVxKUaFzSNmCTdUEVIWbyFfekrOc0BLWBQGW5ymPKY2yL3GTAMKWY9JMxootlCxdZeH10jHgVB7hdQg19jNS2QUxq3Yro1_mwFFpw0N9Wvu4hbsDl_K6O_zdwuRxMcJ42hN4DWfpiSZXiykJE5lodnqXH76c8GuKnqxiPEJeD976TMcHcTlZ4g",
    "tag": "Cafe Legend"
  },
  {
    "id": "blue-curacao-lemonade",
    "category": "sips-desserts",
    "name": "Blue Curacao Lemonade",
    "diet": "veg",
    "price": 150,
    "description": "Vibrant electric blue\n                    citrus liqueur, fizzy mineral soda, crushed mint sprigs and sun-dried dehydrated lime wheel.",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBkjamOdF8Jd7JflGD2k-LVlLv8tN447gco3UWhi87swZ_hmUmFJw07ML6uMhjZ7_y6cAJ4bIu9ki7ZM8luaC46jzD0YKc79dxvc-fn2Mk9dYYqz2-u_smyYMFWJ8slvkMP_OSMXVJb05QUra_xdllIAKOxo3crsr9BZw-QdHeG5kJT5rcHsdnHcLMeiojPxaE1nuJ7VaDa7lW5lq_0tH91hOaYQsskVxMDSFaPeJFbf_xxkBDx-05DBg",
    "tag": "Signature Sip"
  },
  {
    "id": "chicken-steamed-momos",
    "category": "starters-momos",
    "name": "Chicken Steamed Momos",
    "diet": "nv",
    "price": 280,
    "description": "Delicate dumpling wraps,\n                      seasoned chicken broth & spicy mountain relish.",
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBLOAw2Auk6qI-1rfomWyNMGYFujjyNpQqJAr8cD2adSPFPdMoimrtTQCd5IXaspp7KNVxKUaFzSNmCTdUEVIWbyFfekrOc0BLWBQGW5ymPKY2yL3GTAMKWY9JMxootlCxdZeH10jHgVB7hdQg19jNS2QUxq3Yro1_mwFFpw0N9Wvu4hbsDl_K6O_zdwuRxMcJ42hN4DWfpiSZXiykJE5lodnqXH76c8GuKnqxiPEJeD976TMcHcTlZ4g",
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
    "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuDFe_1NsMrgVI8EcQfUhDwfCf468yHxa5KzUsHu6dHfXK1tNfmi4xWWwdEzh50amnTvMX62Ug6vQ8cTG56Sl7pMOYkJTh3YnBcYPJnQQjN1Fh93YIgQUigTfbAcnBJPdYpkaOuCqwEZnobOWOFx7tpFLwOj5u7PR0-A-PFhWUu5QiHmVdXVe5vJ2aZC2UBP_dnrExNczLq6dWZq3iATPyJRrxopAFyQLyiAPGyJb-mlq1L_mNJ4sBE2CA",
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
