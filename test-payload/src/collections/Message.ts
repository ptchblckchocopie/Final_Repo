import type { CollectionConfig } from 'payload'

export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    useAsTitle: 'content',
  },
  access: {
    create: () => true,
    read: () => true,
    // SEC-C2: Restrict update/delete to authenticated users
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'sender',
      type: 'text',
      required: true,
      maxLength: 50,
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      maxLength: 1000,
    },
  ],
}
