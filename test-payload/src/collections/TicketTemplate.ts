import type { CollectionConfig } from 'payload'

export const TicketTemplates: CollectionConfig = {
  slug: 'ticket-templates',
  access: {
    // NOTE: Auth for all operations should be added when user auth is implemented (see CLAUDE.md)
    create: () => true,
    read: () => true,
    update: () => true,
    // SEC-C2: Restrict delete to authenticated users
    delete: ({ req }) => !!req.user,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      // SEC-M8: Limit template name length
      maxLength: 200,
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'ticketSettings',
      type: 'group',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'ticket',
          options: [
            { label: 'Ticket', value: 'ticket' },
            { label: 'Convention ID', value: 'convention-id' },
            { label: 'Certificate', value: 'certificate' },
            { label: 'Others', value: 'others' },
          ],
        },
        {
          name: 'width',
          type: 'number',
          required: true,
          defaultValue: 226.32258,
        },
        {
          name: 'height',
          type: 'number',
          required: true,
          defaultValue: 80,
        },
        {
          name: 'fitMode',
          type: 'select',
          required: true,
          defaultValue: 'cover',
          options: [
            { label: 'Cover', value: 'cover' },
            { label: 'Contain', value: 'contain' },
            { label: 'Stretch', value: 'stretch' },
            { label: 'Original', value: 'original' },
          ],
        },
      ],
    },
    {
      name: 'elements',
      type: 'json',
      required: true,
      // SEC-M8: Validate elements is an array with bounded size
      validate: (value: unknown) => {
        if (!Array.isArray(value)) return 'Elements must be an array'
        if (value.length > 500) return 'Too many elements (max 500)'
        return true
      },
    },
    {
      name: 'labelConfig',
      type: 'group',
      fields: [
        {
          name: 'labelColumn',
          type: 'text',
          defaultValue: '',
        },
        {
          name: 'labelColors',
          type: 'json',
          defaultValue: {},
          // SEC-M8: Validate labelColors is an object or null
          validate: (value: unknown) => {
            if (value === null || value === undefined) return true
            if (typeof value !== 'object' || Array.isArray(value)) return 'Label colors must be an object'
            return true
          },
        },
        {
          name: 'labelBlockWidth',
          type: 'number',
          defaultValue: 20,
        },
        {
          name: 'rightBlockEnabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'rightBlockWidth',
          type: 'number',
          defaultValue: 20,
        },
      ],
    },
    {
      name: 'csvData',
      type: 'json',
      // SEC-M8: Validate csvData is an array or null
      validate: (value: unknown) => {
        if (value === null || value === undefined) return true
        if (!Array.isArray(value)) return 'CSV data must be an array'
        return true
      },
    },
    {
      name: 'csvHeaders',
      type: 'json',
      // SEC-M8: Validate csvHeaders is an array or null
      validate: (value: unknown) => {
        if (value === null || value === undefined) return true
        if (!Array.isArray(value)) return 'CSV headers must be an array'
        return true
      },
    },
    {
      name: 'printSettings',
      type: 'group',
      fields: [
        {
          name: 'ticketGap',
          type: 'number',
          defaultValue: 2,
        },
      ],
    },
  ],
}
