import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'siteConfig',
  title: 'Site Configuration',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Site Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Background Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'ourStoryImage',
      title: 'Our Story Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'galleryImages',
      title: 'Gallery Images',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      validation: (Rule) => Rule.max(4),
      description: 'Exactly 4 images are recommended for the gallery grid',
    }),
    defineField({
      name: 'aboutVibeImages',
      title: 'About Vibe Images',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'image', type: 'image', options: { hotspot: true } },
            { name: 'alt', type: 'string', title: 'Alt Text (e.g. Velvet Booths)' }
          ]
        }
      ],
      validation: (Rule) => Rule.max(4),
    }),
  ],
})
