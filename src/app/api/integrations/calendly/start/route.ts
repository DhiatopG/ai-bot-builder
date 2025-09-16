import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

function b64url(obj: any) { return Buffer.from(JSON.stringify(obj)).toString('base64url') }
function sign(data: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url')
}

/** Start Calendly OAuth (multi-tenant) */
export async function GET(req: Request) {
  const clientId = process.env.CALENDLY_CLIENT_ID
  const redirectUri = process.env.CALENDLY_REDIRECT_URI
  const stateSecret = process.env.OAUTH_STATE_SECRET
  if (!clientId || !redirectUri || !stateSecret) {
    return NextResponse.json({ error: 'Missing CALENDLY_* or OAUTH_STATE_SECRET' }, { status: 500 })
  }

  // user is on localhost:3000, so cookies are present here ✅
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // send them to your sign-in if needed
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/login`)
  }

  const incoming = new URL(req.url)
  const botId = (incoming.searchParams.get('botId') || '').replace(/[<>]/g, '')

  // Put userId + botId into a signed state
  const payload = { userId: user.id, botId, t: Date.now(), n: crypto.randomBytes(8).toString('hex') }
  const data = b64url(payload)
  const mac = sign(data, stateSecret)
  const state = `${data}.${mac}`

  const url = new URL('https://auth.calendly.com/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}
