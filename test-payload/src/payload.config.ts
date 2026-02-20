import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Posts } from './collections/Post'
import { Events } from './collections/Event'
import { Messages } from './collections/Message'
import { TicketTemplates } from './collections/TicketTemplate'
import { CallSignals } from './collections/CallSignal'
import { CalendarEvents } from './collections/CalendarEvent'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// SEC-C3: Fail on missing or weak PAYLOAD_SECRET
const secret = process.env.PAYLOAD_SECRET
if (!secret || secret.length < 32) {
  throw new Error(
    'PAYLOAD_SECRET must be set and at least 32 characters long. Generate one with: openssl rand -hex 32',
  )
}

// SEC-H2: Environment-based CORS origins
// Exact origins passed to Payload; wildcard patterns handled via Next.js middleware
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter((o) => !o.includes('*'))
  : ['http://localhost:5173', 'http://localhost:4173']

// Export wildcard patterns for use in middleware.ts
export const corsWildcardPatterns = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.includes('*'))
  .map((pattern) => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')
    return new RegExp(`^${escaped}$`)
  })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  cors: corsOrigins,
  collections: [Users, Media, Posts, Events, Messages, TicketTemplates, CallSignals, CalendarEvents],
  editor: lexicalEditor(),
  secret,
  // SEC-C4: Disable GraphQL playground in production
  graphQL: {
    disablePlaygroundInProduction: true,
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    ...(process.env.S3_BUCKET
      ? [
          s3Storage({
            collections: { media: { prefix: 'media' } },
            bucket: process.env.S3_BUCKET,
            config: {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
              },
              region: 'auto',
              endpoint: process.env.S3_ENDPOINT || '',
              forcePathStyle: true,
            },
          }),
        ]
      : []),
  ],
})
