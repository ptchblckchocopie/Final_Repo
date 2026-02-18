import type { CollectionConfig } from 'payload'

export const CalendarEvents: CollectionConfig = {
  slug: 'calendar-events',
  admin: {
    useAsTitle: 'title',
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
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 200,
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 2000,
    },
    {
      name: 'start_date',
      type: 'date',
      required: true,
    },
    {
      name: 'end_date',
      type: 'date',
      required: true,
    },
  ],
}
