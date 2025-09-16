// src/app/api/integrations/google/callback/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type TokenResp = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
  [k: string]: any
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const origin = url.origin
  const redirectUri = `${origin}/api/integrations/google/callback`

  // Debug
  if (url.searchParams.get('debug') === '1') {
    return NextResponse.json({
      has_code: Boolean(code),
      redirect_uri: redirectUri,
      client_id_set: Boolean(process.env.GOOGLE_CLIENT_ID),
      client_secret_set: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    })
  }

  if (!code) {
    return NextResponse.json({ error: 'missing_code', redirect_uri: redirectUri }, { status: 400 })
  }

  // User session (cookies)
  const supabase = await createServerClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', detail: userErr?.message || 'no user session in callback' }, { status: 401 })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'missing_env', client_id_set: Boolean(clientId), client_secret_set: Boolean(clientSecret) },
      { status: 500 }
    )
  }

  // Exchange code -> tokens
  const form = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })

  const tok: TokenResp = await resp.json()
  if (!resp.ok || !tok.access_token) {
    return NextResponse.json({ error: 'token_exchange_failed', status: resp.status, token_resp: tok }, { status: 400 })
  }

  // Keep existing refresh_token if Google didn’t return one
  const CAL_ID = 'primary'
  let refreshToken = tok.refresh_token ?? null
  if (!refreshToken) {
    const { data: existing } = await supabase
      .from('integrations_calendar')
      .select('refresh_token')
      .eq('user_id', user.id)
      .eq('calendar_id', CAL_ID)
      .maybeSingle()
    refreshToken = existing?.refresh_token ?? null
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (tok.expires_in ?? 3600)

  // Save using the composite unique key (user_id, calendar_id)
  const { error: upsertErr } = await supabase
    .from('integrations_calendar')
    .upsert(
      {
        user_id: user.id,
        calendar_id: CAL_ID,
        access_token: tok.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,calendar_id' }
    )

  if (upsertErr) {
    return NextResponse.json({ error: 'save_failed', detail: upsertErr.message }, { status: 500 })
  }

  // Send back to where you started (must be an absolute URL for NextResponse.redirect)
  let nextPath = '/dashboard'
  try {
    if (state) {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
      if (typeof parsed?.next === 'string' && parsed.next.startsWith('/')) {
        nextPath = parsed.next
      }
    }
  } catch { /* ignore */ }

  // Build absolute URL from the request origin
  const redirectTo = new URL(nextPath, origin).toString()
  return NextResponse.redirect(redirectTo, { status: 302 })
}
