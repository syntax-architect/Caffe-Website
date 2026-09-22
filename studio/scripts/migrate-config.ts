import { getCliClient } from 'sanity/cli'
import fs from 'fs'
import path from 'path'
import { siteConfig } from '../../the-cafe-barrackpore/src/data/siteConfig'

const client = getCliClient()

const PUBLIC_DIR = path.join(import.meta.dirname, '../../the-cafe-barrackpore/public')

async function uploadImage(imagePath: string) {
  const fullPath = path.join(PUBLIC_DIR, imagePath)
  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found: ${fullPath}`)
    return null
  }
  
  console.log(`Uploading image: ${imagePath}...`)
  const fileStream = fs.createReadStream(fullPath)
  const asset = await client.assets.upload('image', fileStream, {
    filename: path.basename(imagePath)
  })
  
  return {
    _type: 'image',
    asset: {
      _type: 'reference',
      _ref: asset._id
    }
  }
}

async function migrateConfig() {
  console.log('Starting site config migration...')

  const heroImageObj = await uploadImage(siteConfig.hero.image)
  const ourStoryImageObj = await uploadImage(siteConfig.ourStory.image)
  
  const galleryImageObjs = []
  for (const img of siteConfig.gallery.images) {
    const obj = await uploadImage(img.src)
    if (obj) galleryImageObjs.push(obj)
  }

  const aboutVibeImageObjs = []
  for (const img of siteConfig.aboutVibe.images) {
    const obj = await uploadImage(img.src)
    if (obj) {
      aboutVibeImageObjs.push({
        _key: Math.random().toString(36).substring(7),
        image: obj,
        alt: img.alt
      })
    }
  }

  const doc = {
    _type: 'siteConfig',
    title: 'The Cafe Barrackpore',
    heroImage: heroImageObj,
    ourStoryImage: ourStoryImageObj,
    galleryImages: galleryImageObjs,
    aboutVibeImages: aboutVibeImageObjs
  }

  console.log('Creating site config document...')
  await client.create(doc)

  console.log('Site config migration completed successfully!')
}

migrateConfig().catch(console.error)
