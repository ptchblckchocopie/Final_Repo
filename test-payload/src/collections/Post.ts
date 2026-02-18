import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title', // Shows the title in the Admin list view
  },
  access: {
    // SEC-C2: Restrict create/update/delete to authenticated users
    create: ({ req }) => !!req.user,
    read: () => true, // Allows public access so SvelteKit can fetch it
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'textarea', // Use 'richText' if you want a full editor
      required: true,
    },
  ],
}