import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'event',
  admin: {
    useAsTitle: 'title', // Shows the title in the Admin list view
  },
  access: {
    create: () => true,
    read: () => true,
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'URL-friendly identifier (auto-generated from title)' },
    },
    {
      name: 'content',
      type: 'textarea', // Use 'richText' if you want a full editor
      required: true,
      maxLength: 5000,
    },
     {
      name: 'event_date',
      type: 'date',
      required: true,
    },
    {
      name: 'start_time',
      type: 'text',
      admin: { description: 'Start time in HH:MM format' },
    },
    {
      name: 'end_date',
      type: 'date',
    },
    {
      name: 'end_time',
      type: 'text',
      admin: { description: 'End time in HH:MM format' },
    },
    {
      name: 'location',
      type: 'text',
    },
    {
      name: 'tickets',
      type: 'array',
      label: 'Ticket Types',
      admin: { description: 'Define ticket types for this event' },
      fields: [
        {
          name: 'ticket_name',
          type: 'text',
          required: true,
        },
        {
          name: 'ticket_price',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'ticket_color',
          type: 'text',
          required: true,
          defaultValue: '#6366f1',
          admin: { description: 'Hex color code for this ticket type' },
        },
      ],
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'company_logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'background_image',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}