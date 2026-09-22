import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'menuItem',
  title: 'Menu Item',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'price',
      title: 'Price (₹)',
      type: 'number',
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'category' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'dietType',
      title: 'Diet Type',
      type: 'string',
      options: {
        list: [
          { title: 'Vegetarian', value: 'veg' },
          { title: 'Non-Vegetarian', value: 'non-veg' },
          { title: 'Vegan', value: 'vegan' },
          { title: 'None', value: 'none' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
      initialValue: 'none',
    }),
    defineField({
      name: 'popular',
      title: 'Is Popular?',
      type: 'boolean',
      description: 'Highlight this item as popular',
      initialValue: false,
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'price',
      media: 'image',
    },
    prepare(selection) {
      const { title, subtitle, media } = selection
      return {
        title: title,
        subtitle: `₹${subtitle}`,
        media: media,
      }
    },
  },
})
