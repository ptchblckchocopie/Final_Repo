import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Build wildcard CORS patterns from CORS_ORIGINS env var at module load time
const wildcardRegexes: RegExp[] = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.includes('*'))
  .map((pattern) => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')
    return new RegExp(`^${escaped}$`)
  })

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin || wildcardRegexes.length === 0) return NextResponse.next()

  const isWildcardMatch = wildcardRegexes.some((re) => re.test(origin))
  if (!isWildcardMatch) return NextResponse.next()

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'PUT, PATCH, POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding, x-apollo-tracing, X-Payload-HTTP-Method-Override',
      },
    })
  }

  // Add CORS headers to the response
  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export const config = {
  matcher: '/api/:path*',
}
