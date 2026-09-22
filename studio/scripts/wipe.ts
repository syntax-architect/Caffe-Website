import { getCliClient } from 'sanity/cli'

const client = getCliClient()

async function wipe() {
  console.log('Starting wipe of menuItem and category types...')
  
  const query = `*[_type in ["menuItem", "category"]][0...100]`
  
  while (true) {
    const docs = await client.fetch(query)
    if (docs.length === 0) {
      break
    }
    
    console.log(`Deleting batch of ${docs.length} documents...`)
    const transaction = client.transaction()
    for (const doc of docs) {
      transaction.delete(doc._id)
    }
    await transaction.commit()
  }

  console.log('Wipe completed successfully!')
}

wipe().catch(console.error)
