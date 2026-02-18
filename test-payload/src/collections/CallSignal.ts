import type { CollectionConfig } from 'payload'

export const CallSignals: CollectionConfig = {
  slug: 'call-signals',
  admin: {
    useAsTitle: 'callId',
  },
  access: {
    // NOTE: Auth for all operations should be added when user auth is implemented
    create: () => true,
    read: () => true,
    update: () => true,
    // SEC-C2: Restrict delete to authenticated users
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'callId',
      type: 'text',
      required: true,
      index: true,
      maxLength: 100,
    },
    {
      name: 'from',
      type: 'text',
      required: true,
      maxLength: 50,
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      maxLength: 50,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Offer', value: 'offer' },
        { label: 'Answer', value: 'answer' },
        { label: 'ICE Candidate', value: 'ice-candidate' },
        { label: 'Hangup', value: 'hangup' },
      ],
    },
    {
      name: 'data',
      type: 'json',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Ended', value: 'ended' },
      ],
    },
  ],
}
