import { getCliClient } from 'sanity/cli'
import { createReadStream } from 'fs'
import { basename } from 'path'

const client = getCliClient()

async function uploadLogo() {
  const filePath = 'c:\\Users\\Pc\\OneDrive\\Desktop\\Caffe BKP\\WhatsApp Image 2026-09-22 at 9.30.31 PM.jpeg';
  
  console.log(`Uploading logo...`);
  const asset = await client.assets.upload('image', createReadStream(filePath), {
    filename: basename(filePath)
  });
  
  console.log('Image uploaded to Sanity! Asset ID:', asset._id);

  let siteConfig = await client.fetch(`*[_type == "siteConfig"][0]`);
  
  if (!siteConfig) {
    console.log('No siteConfig document found. Creating one...');
    siteConfig = await client.create({
      _type: 'siteConfig',
      title: 'The Cafe Barrackpore'
    });
  }

  console.log(`Attaching logo to Site Configuration...`);
  
  await client.patch(siteConfig._id)
    .set({
      logo: {
        _type: 'image',
        asset: {
          _type: "reference",
          _ref: asset._id
        }
      }
    })
    .commit();
    
  console.log('Success! Logo is now live on the website.');
}

uploadLogo().catch(console.error)
