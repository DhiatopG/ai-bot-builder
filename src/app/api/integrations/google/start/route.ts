// /api/integrations/google/start/route.ts
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const next = url.searchParams.get('next') || '/dashboard'
  const redirectUri = `${origin}/api/integrations/google/callback`

  if (url.searchParams.get('debug') === '1') {
    return NextResponse.json({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
    })
  }

  const state = Buffer.from(JSON.stringify({ next })).toString('base64url')
  const scopes = [
    'openid','email','profile',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.freebusy',
  ].join(' ')

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  auth.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString()

  return NextResponse.redirect(auth.toString(), { status: 302 })
}
