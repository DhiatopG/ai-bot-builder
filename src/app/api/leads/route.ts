// src/app/api/leads/route.ts

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Define runtime **here** (don’t re-export it)
export const runtime = 'nodejs'          // or 'edge' if you really need Edge
// export const dynamic = 'force-dynamic' // optional, only if you need it

// Re-export the POST handler is fine
export { POST } from '@/app/api/lead/route'

// Optional: friendly 405 for GET so the route won’t look “missing” in dev tools
export function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: 'method_not_allowed', expected: 'POST' },
    { status: 405 }
  )
}
