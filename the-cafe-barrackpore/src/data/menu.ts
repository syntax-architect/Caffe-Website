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
  // Soups & Salads
  {
    id: "hot-and-sour-soup",
    category: "soups-salads",
    name: "Hot And Sour Soup",
    diet: "all",
    price: 130,
    description: "Peppery broth with wild mushrooms, bamboo shoots and cilantro. Available in veg or chicken.",
    tag: null
  },
  {
    id: "lemon-coriander-soup",
    category: "soups-salads",
    name: "Lemon Coriander Soup",
    diet: "veg",
    price: 150,
    description: "A refreshing and tangy clear soup flavored with lemon juice and fresh coriander.",
    tag: "Healthy"
  },
  {
    id: "chicken-clear-soup",
    category: "soups-salads",
    name: "Chicken Clear Soup",
    diet: "nv",
    price: 150,
    description: "A light and soothing clear broth served with tender chicken chunks and veggies.",
    tag: null
  },
  {
    id: "fish-bowl-soup",
    category: "soups-salads",
    name: "Fish Bowl Soup",
    diet: "nv",
    price: 200,
    description: "Hearty and aromatic seafood broth featuring fresh fish fillets.",
    tag: null
  },
  {
    id: "chicken-manchow-soup",
    category: "soups-salads",
    name: "Chicken Manchow Soup",
    diet: "nv",
    price: 200,
    description: "Spicy dark soy-based soup topped with crunchy fried noodles.",
    tag: "Spicy"
  },
  {
    id: "american-chopsuey",
    category: "soups-salads",
    name: "American Chopsuey",
    diet: "nv",
    price: 300,
    description: "Crispy fried noodles topped with a sweet and tangy tomato-based chicken gravy.",
    tag: null
  },
  {
    id: "green-salad",
    category: "soups-salads",
    name: "Green Salad",
    diet: "veg",
    price: 90,
    description: "Farm-fresh cucumber, tomatoes, onions, and carrots served with a wedge of lemon.",
    tag: "Vegan"
  },
  {
    id: "chicken-salad",
    category: "soups-salads",
    name: "Chicken Salad",
    diet: "nv",
    price: 200,
    description: "Grilled chicken tossed with crisp greens, cherry tomatoes, and house dressing.",
    tag: "High Protein"
  },
  {
    id: "pasta-salad",
    category: "soups-salads",
    name: "Pasta Salad",
    diet: "all",
    price: 250,
    description: "Chilled pasta tossed with colorful veggies in a zesty vinaigrette. Add-ons available.",
    tag: null
  },

  // Burgers & Pizzas
  {
    id: "veggie-medley-burger",
    category: "burgers-pizzas",
    name: "Veggie Medley Burger",
    diet: "veg",
    price: 180,
    description: "Spiced potato-corn crunch patty, caramelized onions and melted cheddar in a toasted bun.",
    tag: null
  },
  {
    id: "paneer-burger-1patty",
    category: "burgers-pizzas",
    name: "Paneer Burger (Single Patty)",
    diet: "veg",
    price: 200,
    description: "Crispy spiced paneer patty with crisp lettuce and creamy mayo.",
    tag: null
  },
  {
    id: "paneer-burger-2patty",
    category: "burgers-pizzas",
    name: "Paneer Burger (Double Patty)",
    diet: "veg",
    price: 220,
    description: "Double the paneer goodness! Two crispy spiced paneer patties with crisp lettuce.",
    tag: "Hungry"
  },
  {
    id: "special-chicken-on-a-bun",
    category: "burgers-pizzas",
    name: "Special Chicken On A Bun",
    diet: "nv",
    price: 250,
    description: "Flame-grilled thick chicken patty with melted mature cheddar, caramelized onions, crispy bacon & house smoked relish.",
    tag: "Crowd Favorite"
  },
  {
    id: "margherita-pizza",
    category: "burgers-pizzas",
    name: "Margherita Pizza",
    diet: "veg",
    price: 180,
    description: "San Marzano plum tomato sauce, bocconcini cheese & sweet garden basil.",
    tag: "Classic"
  },
  {
    id: "chicken-cheese-pizza",
    category: "burgers-pizzas",
    name: "Chicken Cheese Pizza",
    diet: "nv",
    price: 250,
    description: "Hand-stretched dough, spicy herb marinara, roasted chicken & molten mozzarella.",
    tag: null
  },

  // Starters & Momos
  {
    id: "veg-steam-momo",
    category: "starters-momos",
    name: "Veg Steam Momo",
    diet: "veg",
    price: 150,
    description: "Delicate dumplings stuffed with seasoned minced vegetables. Steamed to perfection.",
    tag: null
  },
  {
    id: "chicken-steam-momo",
    category: "starters-momos",
    name: "Chicken Steam Momo",
    diet: "nv",
    price: 280,
    description: "Delicate dumpling wraps stuffed with seasoned minced chicken.",
    tag: null
  },
  {
    id: "chicken-pahadi-momo-steam",
    category: "starters-momos",
    name: "Chicken Pahadi Momo (Steam)",
    diet: "nv",
    price: 200,
    description: "Infused with Himalayan mountain herbs and cilantro broth, steamed soft.",
    tag: "Special"
  },
  {
    id: "chicken-pahadi-momo-fried",
    category: "starters-momos",
    name: "Chicken Pahadi Momo (Fried)",
    diet: "nv",
    price: 220,
    description: "Infused with Himalayan mountain herbs, deep fried for a golden crunch.",
    tag: null
  },
  {
    id: "chicken-pahadi-momo-pan-fried",
    category: "starters-momos",
    name: "Chicken Pahadi Momo (Pan Fried)",
    diet: "nv",
    price: 250,
    description: "Mountain herb infused momos, pan crisped and tossed in a spicy garlic sauce.",
    tag: null
  },
  {
    id: "fish-spring-roll",
    category: "starters-momos",
    name: "Fish Spring Roll (Pure Vetki)",
    diet: "nv",
    price: 200,
    description: "Crispy rolls stuffed with fresh Vetki fish and oriental spices.",
    tag: null
  },
  {
    id: "fish-and-chips",
    category: "starters-momos",
    name: "Fish And Chips (Pure Vetki)",
    diet: "nv",
    price: 250,
    description: "Fresh Bhetki fillet in airy golden batter, hand-cut fries, caper tartar sauce.",
    tag: "Bestseller"
  },
  {
    id: "fish-goujons",
    category: "starters-momos",
    name: "Fish Goujons",
    diet: "nv",
    price: 240,
    description: "Crispy breaded fish fingers served with tangy tartar dip.",
    tag: null
  },
  {
    id: "golden-fried-prawn",
    category: "starters-momos",
    name: "Golden Fried Prawn",
    diet: "nv",
    price: 350,
    description: "Crisp Japanese panko crumb crusted tiger prawns with sweet plum chilli dip.",
    tag: null
  },
  {
    id: "prawn-tempura",
    category: "starters-momos",
    name: "Prawn Tempura",
    diet: "nv",
    price: 380,
    description: "Light and airy battered prawns, deep-fried to a delicate crisp.",
    tag: null
  },
  {
    id: "thai-lemon-fish",
    category: "starters-momos",
    name: "Thai Lemon Fish",
    diet: "nv",
    price: 280,
    description: "Steamed or fried fish tossed in a zesty, aromatic Thai lemon and herb sauce.",
    tag: null
  },
  {
    id: "thai-lemon-chicken",
    category: "starters-momos",
    name: "Thai Lemon Chicken",
    diet: "nv",
    price: 250,
    description: "Tender chicken chunks tossed in a zesty, aromatic Thai lemon sauce.",
    tag: null
  },
  {
    id: "chicken-spring-roll",
    category: "starters-momos",
    name: "Chicken Spring Roll",
    diet: "nv",
    price: 180,
    description: "Crispy golden wrappers filled with savory minced chicken and veggies.",
    tag: null
  },
  {
    id: "crispy-chicken-wings",
    category: "starters-momos",
    name: "Crispy Chicken Wings",
    diet: "nv",
    price: 300,
    description: "Perfectly seasoned, ultra-crispy fried chicken wings.",
    tag: null
  },
  {
    id: "drums-of-heaven",
    category: "starters-momos",
    name: "Drums Of Heaven",
    diet: "nv",
    price: 300,
    description: "Crispy wing lollipops smothered in sticky caramelized garlic-chilli glaze.",
    tag: "Spicy"
  },
  {
    id: "chicken-strips",
    category: "starters-momos",
    name: "Chicken Strips",
    diet: "nv",
    price: 250,
    description: "Juicy chicken breast strips, breaded and fried till golden brown.",
    tag: null
  },
  {
    id: "cheese-blast-sandwich",
    category: "starters-momos",
    name: "Cheese Blast Sandwich",
    diet: "veg",
    price: 150,
    description: "An explosion of molten cheese grilled between buttered bread slices.",
    tag: null
  },
  {
    id: "veg-sweet-corn-sandwich",
    category: "starters-momos",
    name: "Veg Sweet Corn Sandwich",
    diet: "veg",
    price: 180,
    description: "Creamy sweet corn and veggie filling grilled to perfection. Add paneer optional.",
    tag: null
  },
  {
    id: "chicken-cheese-toastie",
    category: "starters-momos",
    name: "Chicken Cheese Toastie",
    diet: "nv",
    price: 220,
    description: "Toasted sandwich loaded with spiced chicken and melted cheese.",
    tag: null
  },
  {
    id: "chipotle-chicken-sandwich",
    category: "starters-momos",
    name: "Chipotle & Buffalo Chicken Sandwich",
    diet: "nv",
    price: 300,
    description: "Hickory smoked chicken in spicy chipotle reduction with mozzarella.",
    tag: "Spicy"
  },
  {
    id: "club-house-sandwich",
    category: "starters-momos",
    name: "Club House Sandwich",
    diet: "all",
    price: 250,
    description: "Multi-layered classic club sandwich. Available in veg or chicken.",
    tag: null
  },
  {
    id: "french-fries",
    category: "starters-momos",
    name: "French Fries",
    diet: "veg",
    price: 150,
    description: "Classic salted crispy potato fries.",
    tag: null
  },
  {
    id: "cheesy-french-fries",
    category: "starters-momos",
    name: "Cheesy French Fries",
    diet: "veg",
    price: 180,
    description: "Crispy fries smothered in warm, liquid cheddar cheese.",
    tag: null
  },
  {
    id: "crispy-chilli-babycorn",
    category: "starters-momos",
    name: "Crispy Chilli Babycorn",
    diet: "veg",
    price: 190,
    description: "Golden batter baby corn wok-tossed with sweet peppers, scallions and soy.",
    tag: null
  },

  // Mains & Platters
  {
    id: "white-sauce-pasta-veg",
    category: "mains-platters",
    name: "White Sauce Pasta (Veg)",
    diet: "veg",
    price: 180,
    description: "Velvety butter, garlic parmesan cream with assorted vegetables.",
    tag: null
  },
  {
    id: "white-sauce-pasta-chicken",
    category: "mains-platters",
    name: "White Sauce Pasta (Chicken)",
    diet: "nv",
    price: 200,
    description: "Velvety butter, garlic parmesan cream with grilled chicken chunks.",
    tag: null
  },
  {
    id: "red-sauce-pasta-veg",
    category: "mains-platters",
    name: "Red Sauce Pasta (Veg)",
    diet: "veg",
    price: 200,
    description: "Spicy Arrabbiata tomato sauce tossed with fresh veggies.",
    tag: null
  },
  {
    id: "red-sauce-pasta-chicken",
    category: "mains-platters",
    name: "Red Sauce Pasta (Chicken)",
    diet: "nv",
    price: 220,
    description: "Spicy Arrabbiata tomato sauce tossed with tender chicken chunks.",
    tag: null
  },
  {
    id: "fried-rice",
    category: "mains-platters",
    name: "Fried Rice",
    diet: "all",
    price: 160,
    description: "Classic wok-tossed fried rice. Available in veg, egg, chicken, or mixed.",
    tag: null
  },
  {
    id: "hakka-noodles",
    category: "mains-platters",
    name: "Hakka Noodles",
    diet: "all",
    price: 150,
    description: "Street-style wok-tossed noodles. Available in veg, egg, chicken, or mixed.",
    tag: null
  },
  {
    id: "veg-manchurian",
    category: "mains-platters",
    name: "Veg Manchurian",
    diet: "veg",
    price: 150,
    description: "Mixed vegetable dumplings tossed in a dark soy and garlic sauce. Dry or gravy.",
    tag: null
  },
  {
    id: "chilli-chicken",
    category: "mains-platters",
    name: "Chilli Chicken",
    diet: "nv",
    price: 180,
    description: "Battered boneless chicken pieces in rich garlic soy gravy with peppers. Dry or gravy.",
    tag: null
  },
  {
    id: "hunan-chicken",
    category: "mains-platters",
    name: "Hunan Chicken",
    diet: "nv",
    price: 200,
    description: "Spicy and tangy Hunan style chicken tossed with veggies.",
    tag: null
  },
  {
    id: "kung-pao-chicken",
    category: "mains-platters",
    name: "Kung Pao Chicken",
    diet: "nv",
    price: 250,
    description: "Diced tender chicken, roasted peanuts, dry red chillies in dark sweet glaze.",
    tag: null
  },
  {
    id: "chinese-platter",
    category: "mains-platters",
    name: "Chinese Platter",
    diet: "nv",
    price: 450,
    description: "A grand platter featuring 1pc Spring Roll, 2pcs Chicken Wings, 2pcs Chicken Lollipop, and 2pcs Chicken Cheese Balls.",
    tag: "Platter"
  },
  {
    id: "tandoori-platter",
    category: "mains-platters",
    name: "Tandoori Platter",
    diet: "nv",
    price: 550,
    description: "Assortment of kebabs: 2pcs Reshmi, 2pcs Tikka, 2pcs Hara, and 1pc Sheek Kebab.",
    tag: "Platter"
  },

  // Sips & Desserts
  {
    id: "masala-cold-drinks",
    category: "sips-desserts",
    name: "Masala Cold Drinks",
    diet: "veg",
    price: 100,
    description: "Your favorite fizzy drink spiced up with a punchy chaat masala twist.",
    tag: null
  },
  {
    id: "lime-corial",
    category: "sips-desserts",
    name: "Lime Cordial",
    diet: "veg",
    price: 120,
    description: "Sweet and tangy refreshing lime cooler.",
    tag: null
  },
  {
    id: "basil-lemon-mojito",
    category: "sips-desserts",
    name: "Basil Lemon Mojito",
    diet: "veg",
    price: 150,
    description: "A refreshing twist on the classic mojito, muddled with fresh basil and lemon.",
    tag: null
  },
  {
    id: "blue-curacao-lemonade",
    category: "sips-desserts",
    name: "Blue Curacao Lemonade",
    diet: "veg",
    price: 150,
    description: "Vibrant electric blue citrus liqueur, fizzy mineral soda, crushed mint sprigs.",
    tag: "Signature"
  },
  {
    id: "sunset-paradise",
    category: "sips-desserts",
    name: "Sunset Paradise",
    diet: "veg",
    price: 200,
    description: "Passion fruit purée, fresh orange juice, ruby grenadine and fizz.",
    tag: null
  },
  {
    id: "summer-in-the-glass",
    category: "sips-desserts",
    name: "The Summer In The Glass",
    diet: "veg",
    price: 200,
    description: "A tropical, fruity, and refreshing signature mocktail.",
    tag: null
  },
  {
    id: "masala-tea",
    category: "sips-desserts",
    name: "Masala Tea",
    diet: "veg",
    price: 120,
    description: "Hot, spiced Indian milk tea brewed with aromatic cardamom and ginger.",
    tag: null
  },
  {
    id: "cappuccino",
    category: "sips-desserts",
    name: "Cappuccino",
    diet: "veg",
    price: 120,
    description: "Single origin Arabica espresso pulled over velvety textured microfoam.",
    tag: null
  },
  {
    id: "oreo-shake",
    category: "sips-desserts",
    name: "Oreo Shake",
    diet: "veg",
    price: 150,
    description: "Thick, creamy milkshake blended with crushed Oreo cookies.",
    tag: null
  },
  {
    id: "kitkat-shake",
    category: "sips-desserts",
    name: "Kitkat Shake",
    diet: "veg",
    price: 150,
    description: "Rich chocolate milkshake blended with crispy KitKat wafers.",
    tag: null
  },
  {
    id: "butterscotch-shake",
    category: "sips-desserts",
    name: "Butterscotch Shake",
    diet: "veg",
    price: 180,
    description: "Sweet and buttery caramel milkshake with crunchy praline bits.",
    tag: null
  }
];
