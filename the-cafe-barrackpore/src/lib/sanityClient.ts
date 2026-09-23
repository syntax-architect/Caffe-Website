import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const client = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || 'vob0hoxy',
  dataset: 'production',
  useCdn: true, // Use CDN for faster, edge-cached responses
  apiVersion: '2024-01-01', // Use current date for latest API version
})

const builder = imageUrlBuilder(client)

// Helper function to easily generate image URLs from Sanity image objects
export function urlFor(source: any) {
  return builder.image(source)
}
