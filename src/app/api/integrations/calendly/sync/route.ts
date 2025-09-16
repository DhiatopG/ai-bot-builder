// src/app/api/integrations/calendly/sync/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CalendlyPaged<T> = {
  collection: T[]
  pagination?: { next_page_token?: string | null }
}

type CalendlyEvent = {
  uri: string
  start_time?: string
  end_time?: string
  state?: 'active' | 'canceled'
  name?: string
  event_type?: string
}

type CalendlyInvitee = {
  uri: string
  email?: string
  name?: string
  timezone?: string
  status?: string
}

const CAL_BASE = 'https://api.calendly.com'

async function calGet<T>(
  path: string,
  token: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(CAL_BASE + path)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Calendly ${path} ${r.status} ${body?.slice(0, 200)}`)
  }
  return r.json()
}

function mapStatus(state?: string): 'confirmed' | 'canceled' {
  return state === 'canceled' ? 'canceled' : 'confirmed'
}

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const botId = (searchParams.get('botId') || '').trim()

  if (!botId) {
    return NextResponse.json({ ok: false, error: 'botId required' }, { status: 400 })
  }

  // 1) Load Calendly connection for this bot
  const { data: conn, error: connErr } = await admin
    .from('integrations_calendar')
    .select('bot_id, provider, access_token, provider_user_uri')
    .eq('bot_id', botId)
    .eq('provider', 'calendly')
    .maybeSingle()

  if (connErr) {
    return NextResponse.json({ ok: false, error: connErr.message }, { status: 500 })
  }
  if (!conn?.access_token) {
    return NextResponse.json({ ok: false, error: 'No Calendly token for this bot' }, { status: 404 })
  }

  let ownerUri = conn.provider_user_uri as string | null

  // 2) Ensure we know the Calendly user URI (once)
  if (!ownerUri) {
    try {
      const me: any = await calGet('/users/me', conn.access_token)
      ownerUri = me?.resource?.uri || null
      if (!ownerUri) throw new Error('No users/me.resource.uri')
      await admin
        .from('integrations_calendar')
        .update({ provider_user_uri: ownerUri })
        .eq('bot_id', botId)
        .eq('provider', 'calendly')
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: `users/me failed: ${e?.message || e}` }, { status: 500 })
    }
  }

  // 3) Probe once whether appointments.event_id exists (avoid per-row checks)
  let hasEventIdColumn = false
  {
    const { error: probeErr } = await admin
      .from('appointments')
      .select('event_id')
      .limit(1)
    if (!probeErr) hasEventIdColumn = true
  }

  // 4) Page through scheduled events for that user
  let nextPage: string | null = null
  let inserted = 0
  let updated = 0
  let canceled = 0

  try {
    do {
      const params: Record<string, string> = { user: ownerUri!, count: '50' }
      if (nextPage) params.page_token = nextPage

      const ev = await calGet<CalendlyPaged<CalendlyEvent>>('/scheduled_events', conn.access_token, params)

      for (const e of ev.collection || []) {
        const eventUri = e.uri
        const eventUuid = (eventUri || '').split('/').pop() || undefined
        const status = mapStatus(e.state)
        const starts_at = e.start_time || null
        const ends_at = e.end_time || null

        // For each event, fetch invitees to get name/email
        let invNext: string | null = null
        do {
          const invParams: Record<string, string> = { count: '50', event: eventUri }
          if (invNext) invParams.page_token = invNext

          const inv = await calGet<CalendlyPaged<CalendlyInvitee>>('/event_invitees', conn.access_token, invParams)

          for (const iv of inv.collection || []) {
            const invitee_email = iv.email || null
            const invitee_name = iv.name || null
            const provider_invitee_uri = iv.uri || null

            const payload: any = {
              bot_id: botId,
              provider: 'calendly',
              provider_event_id: eventUuid,
              status,
              starts_at,
              ends_at,
              invitee_email,
              invitee_name,
              provider_invitee_uri,
              metadata: {
                event: { uri: eventUri, state: e.state, start_time: starts_at, end_time: ends_at },
                invitee: { uri: provider_invitee_uri, email: invitee_email, name: invitee_name },
              },
              updated_at: new Date().toISOString(),
            }

            if (hasEventIdColumn) {
              payload.event_id = eventUuid
            }

            const { data: upData, error: upErr } = await admin
              .from('appointments')
              .upsert(payload, { onConflict: 'provider,provider_event_id,invitee_email' })
              .select('status')

            if (upErr) {
              console.error('[appointments upsert]', upErr.message)
              continue
            }

            if (Array.isArray(upData) && upData.length > 0) {
              if (status === 'canceled') canceled++
              else updated++
            } else {
              if (status === 'canceled') canceled++
              else inserted++
            }
          }

          invNext = inv.pagination?.next_page_token || null
        } while (invNext)
      }

      nextPage = ev.pagination?.next_page_token || null
    } while (nextPage)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    botId,
    summary: { inserted, updated, canceled },
  })
}
