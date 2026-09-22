import { getCliClient } from 'sanity/cli'
import { menuData } from '../../the-cafe-barrackpore/src/data/menu'

const client = getCliClient()

const categoryMap: Record<string, string> = {
  'burgers-pizzas': 'Burgers & Pizzas',
  'starters-momos': 'Starters & Momos',
  'sips-desserts': 'Sips & Desserts',
  'soups-salads': 'Soups & Salads',
  'mains-platters': 'Mains & Platters'
}

async function migrate() {
  console.log('Starting migration...')

  // 1. Create Categories
  const uniqueCategoryIds = [...new Set(menuData.map(item => item.category))]
  const categoryIdToSanityId: Record<string, string> = {}

  for (const catId of uniqueCategoryIds) {
    const title = categoryMap[catId] || catId
    const doc = {
      _type: 'category',
      title: title,
    }
    console.log(`Creating category: ${title}`)
    const createdCat = await client.create(doc)
    categoryIdToSanityId[catId] = createdCat._id
  }

  console.log('Categories created successfully.')

  // 2. Create Menu Items
  for (const item of menuData) {
    const catSanityId = categoryIdToSanityId[item.category]

    let dietType = 'none'
    if (item.diet === 'veg') dietType = 'veg'
    else if (item.diet === 'nv') dietType = 'non-veg'
    else if (item.diet === 'vegan') dietType = 'vegan'

    const isPopular = !!item.tag

    const doc = {
      _type: 'menuItem',
      name: item.name,
      description: item.description.replace(/\s+/g, ' ').trim(), // Clean up whitespace from the original TS file
      price: item.price,
      dietType: dietType,
      popular: isPopular,
      category: {
        _type: 'reference',
        _ref: catSanityId
      }
    }

    console.log(`Creating menu item: ${item.name}`)
    await client.create(doc)
  }

  console.log('Migration completed successfully!')
}

migrate().catch(console.error)
