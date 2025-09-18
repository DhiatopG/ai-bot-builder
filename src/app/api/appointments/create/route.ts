// src/app/api/appointments/create/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Needed so googleapis can refresh with your OAuth client
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      bot_id,
      invitee_name,
      invitee_email,
      invitee_phone,
      startISO,
      endISO,
      timezone = 'UTC',
      conversation_id,
      event_type = 'Website booking',
      source = 'in60_form'
    } = body || {}

    if (!bot_id || !startISO || !endISO) {
      return Response.json({ error: 'Missing bot_id/startISO/endISO' }, { status: 400 })
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE)

    // 1) Find bot owner (whose calendar we’ll write to)
    const { data: bot, error: botErr } = await supa
      .from('bots')
      .select('id,user_id')
      .eq('id', bot_id)
      .maybeSingle()
    if (botErr) throw botErr
    if (!bot) return Response.json({ error: 'Bot not found' }, { status: 404 })

    // Normalize ISO strings (ensure Z + milliseconds removed)
    const startIso = new Date(startISO).toISOString()
    const endIso   = new Date(endISO).toISOString()

    // 2) Create local appointment row first (WRITE REAL COLUMNS)
    const baseInsert = {
      bot_id,
      conversation_id: conversation_id ?? null,
      provider: 'in60', // may change to 'google_calendar' below
      event_type,
      invitee_name:  invitee_name  ?? null,
      invitee_email: invitee_email ?? null,
      invitee_phone: invitee_phone ?? null,

      // ✅ real columns
      starts_at: startIso,
      ends_at:   endIso,
      // also persist the range (server will cast string -> tstzrange)
      time_range: `[${startIso},${endIso})`,

      timezone,
      status: 'confirmed',
      external_event_id: null as string | null,
      source,
      metadata: {} as Record<string, any>,
    }

    const { data: appt, error: insErr } = await supa
      .from('appointments')
      .insert(baseInsert)
      .select('*')
      .single()
    if (insErr) throw insErr

    // 3) If owner connected Google, create Google Calendar event
    const { data: integ, error: intErr } = await supa
      .from('integrations_calendar')
      .select('access_token, refresh_token, expires_at, calendar_id')
      .eq('user_id', bot.user_id)
      .maybeSingle()
    if (intErr) throw intErr

    let external_event_id: string | null = null
    let provider_used = 'in60'
    let htmlLink: string | undefined

    if (integ?.access_token && integ?.refresh_token && integ?.calendar_id) {
      const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
      oauth2.setCredentials({
        access_token:  integ.access_token,
        refresh_token: integ.refresh_token,
        expiry_date:   integ.expires_at ? Number(integ.expires_at) * 1000 : undefined,
      })

      // Optional: keep tokens fresh in DB if google refreshes them
      oauth2.on('tokens', async (t) => {
        const patch: any = {}
        if (t.access_token) patch.access_token = t.access_token
        if (t.expiry_date)  patch.expires_at   = Math.floor(t.expiry_date / 1000)
        if (Object.keys(patch).length) {
          await supa.from('integrations_calendar')
            .update(patch)
            .eq('user_id', bot.user_id)
        }
      })

      const calendar = google.calendar({ version: 'v3', auth: oauth2 })
      const resp = await calendar.events.insert({
        calendarId: integ.calendar_id,
        requestBody: {
          summary: event_type || 'Website booking',
          description:
            `Booked via In60 bot\nBot: ${bot_id}\nConversation: ${conversation_id ?? '-'}\nSource: ${source}`,
          start: { dateTime: startIso, timeZone: timezone },
          end:   { dateTime: endIso,   timeZone: timezone },
          attendees: [
            invitee_email ? { email: invitee_email, displayName: invitee_name || undefined } : undefined,
          ].filter(Boolean) as any[],
        },
      })

      external_event_id = resp.data.id || null
      htmlLink = resp.data.htmlLink || undefined
      provider_used = 'google_calendar'
    }

    // 4) Update local row with provider + external ID (if any)
    await supa
      .from('appointments')
      .update({
        external_event_id,
        provider: provider_used,
        metadata: {
          ...(appt.metadata ?? {}),
          htmlLink,
          created_via: 'bot',
        },
      })
      .eq('id', appt.id)

    return Response.json({ ok: true, id: appt.id, provider: provider_used, external_event_id })
  } catch (e: any) {
    console.error('create appointment error:', e)
    return Response.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
