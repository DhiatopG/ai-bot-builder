// src/app/api/integrations/calendly/callback/route.ts
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

function verifyState(state: string, secret: string) {
  const [data, mac] = (state || '').split('.')
  if (!data || !mac) return null
  const expect = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null
  } catch {
    return null
  }
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code') || ''
    const state = searchParams.get('state') || ''
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

    // quick debug
    console.log('[Calendly OAuth] redirect_uri =', process.env.CALENDLY_REDIRECT_URI)
    console.log('[Calendly OAuth] client_id   =', (process.env.CALENDLY_CLIENT_ID || '').slice(0, 8) + '…')

    const decoded = verifyState(state, process.env.OAUTH_STATE_SECRET || '')
    if (!decoded) return NextResponse.json({ error: 'Invalid state' }, { status: 400 })

    const userId = (decoded.userId as string | undefined) || null
    const botId = ((decoded.botId as string | undefined) || '').replace(/[<>]/g, '') || null
    if (!botId) return NextResponse.json({ error: 'Missing botId in state' }, { status: 400 })

    // 1) Exchange code -> tokens
    const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.CALENDLY_CLIENT_ID || '',
        client_secret: process.env.CALENDLY_CLIENT_SECRET || '',
        redirect_uri: process.env.CALENDLY_REDIRECT_URI || '',
        code,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('Calendly token error:', tokenData)
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
    }
    const { access_token, refresh_token, expires_in, token_type } = tokenData

    // 2) Identify Calendly user (also gives current_organization)
    const meRes = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const meData = await meRes.json()
    if (!meRes.ok) {
      console.error('Calendly /users/me error:', meData)
      return NextResponse.json({ error: 'Failed to read Calendly user' }, { status: 500 })
    }
    const userUri = meData?.resource?.uri as string | undefined
    const orgUri =
      (meData?.resource?.current_organization as string | undefined) ||
      (meData?.resource?.organization as string | undefined) ||
      null

    if (!userUri) return NextResponse.json({ error: 'No Calendly user uri' }, { status: 500 })

    const admin = createAdminClient()

    // 3) Save tokens keyed by (bot_id, provider) — include webhook_secret (NOT NULL)
    {
      const { error: upErr } = await admin
        .from('integrations_calendar')
        .upsert(
          {
            bot_id: botId,
            provider: 'calendly',
            webhook_secret: process.env.CALENDLY_SIGNING_KEY!, // satisfies NOT NULL
            // user_id: userId, // optional if your table has it
            access_token,
            refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + Number(expires_in || 0),
            provider_user_uri: userUri,
            token_type: token_type || 'Bearer',
            connected_at: new Date().toISOString(),
          },
          { onConflict: 'bot_id,provider' }
        )
      if (upErr) {
        console.error('Supabase save error:', upErr)
        return NextResponse.json({ error: 'Failed to save tokens' }, { status: 500 })
      }
    }

    // 4) Create webhook subscription
    const webhookUrl =
      process.env.CALENDLY_WEBHOOK_URL ||
      `${process.env.NEXT_PUBLIC_EXTERNAL_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/api/appointments/webhook`

    const events = ['invitee.created', 'invitee.canceled']

    // Helper to call Calendly
    const createSub = (body: any) =>
      fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify(body),
      })

    let subId: string | undefined

    // Try USER scope first
    let subRes = await createSub({ url: webhookUrl, events, scope: 'user', user: userUri })
    let subData = await subRes.json()
    if (!subRes.ok) {
      console.error('Calendly webhook user-scope error:', subData)
      // Fallback: if API complains about missing organization, try ORG scope
      const needsOrg =
        Array.isArray(subData?.details) &&
        subData.details.some((d: any) => d?.parameter === 'organization')
      if (needsOrg && orgUri) {
        console.log('[Calendly] Retrying webhook with organization scope:', orgUri)
        const subRes2 = await createSub({
          url: webhookUrl,
          events,
          scope: 'organization',
          organization: orgUri,
        })
        const subData2 = await subRes2.json()
        if (subRes2.ok) {
          subId = subData2?.resource?.id
        } else {
          console.error('Calendly webhook org-scope error:', subData2)
        }
      }
    } else {
      subId = subData?.resource?.id
    }

    // 5) Persist webhook_subscription_id (optional, non-fatal)
    if (subId) {
      await admin
        .from('integrations_calendar')
        .upsert(
          { bot_id: botId, provider: 'calendly', webhook_subscription_id: subId },
          { onConflict: 'bot_id,provider' }
        )
    }

    // 6) Redirect back to your app
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?connected=calendly&botId=${encodeURIComponent(
        botId
      )}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`
    )
  } catch (e: any) {
    console.error('Calendly callback error:', e?.message || e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
