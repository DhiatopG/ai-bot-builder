// src/app/api/appointments/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Normalized = {
  provider: string
  event_id: string
  bot_id: string
  status: 'confirmed' | 'rescheduled' | 'canceled'
  starts_at: string
  timezone?: string
  rescheduled_from_event_id?: string
  lead_id?: string
  user_session_id?: string
  metadata?: any
}

function first<T = any>(...vals: any[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v
}

function getProvider(req: NextRequest, body: any) {
  return (req.headers.get('x-provider') || body?.provider || body?.source || 'unknown')
    .toString()
    .toLowerCase()
}

function normalizeWebhook(provider: string, body: any): Normalized {
  const p = provider.toLowerCase()

  const statusRaw = (first(
    body?.status,
    body?.event?.status,
    body?.payload?.status,
    body?.action
  ) || 'confirmed').toString().toLowerCase()

  const status =
    /cancel/.test(statusRaw) ? 'canceled' :
    /resched/.test(statusRaw) ? 'rescheduled' :
    'confirmed'

  const event_id = first(
    body?.event_id,
    body?.id,
    body?.event?.uuid,
    body?.payload?.event?.uuid,
    body?.payload?.event_uuid,
    body?.payload?.id,
    body?.uuid
  ) as string

  const starts_at = (first(
    body?.starts_at,
    body?.start_time,
    body?.start_time_utc,
    body?.event?.start_time,
    body?.payload?.event?.start_time,
    body?.payload?.start_time,
    body?.start?.time
  ) || new Date().toISOString()) as string

  const timezone = first(
    body?.timezone,
    body?.event?.timezone,
    body?.payload?.event?.timezone,
    body?.start_time_zone,
    body?.time_zone
  ) as string | undefined

  const bot_id = first(
    body?.bot_id,
    body?.metadata?.bot_id,
    body?.payload?.metadata?.bot_id,
    body?.payload?.tracking?.utm_campaign,
    body?.payload?.questions_and_answers?.find?.((q: any)=>/bot[_\s-]?id/i.test(q?.question))?.answer
  ) as string

  const rescheduled_from_event_id = first(
    body?.rescheduled_from_event_id,
    body?.payload?.rescheduled_from?.event_id,
    body?.old_event_id
  ) as string | undefined

  const lead_id = first(
    body?.lead_id,
    body?.metadata?.lead_id,
    body?.payload?.metadata?.lead_id,
    body?.payload?.tracking?.utm_content
  ) as string | undefined

  const user_session_id = first(
    body?.user_session_id,
    body?.metadata?.user_session_id
  ) as string | undefined

  if (!event_id) throw new Error('missing_event_id')

  return {
    provider: p,
    event_id,
    bot_id: (bot_id as string) || '',
    status,
    starts_at: new Date(starts_at).toISOString(),
    timezone,
    rescheduled_from_event_id,
    lead_id,
    user_session_id,
    metadata: body
  }
}

// ---------- NEW: pick a UUID for conversation_id if provided ----------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function pickConversationId(n: Normalized): string | null {
  const v = n.user_session_id || n.lead_id
  if (!v) return null
  return UUID_RE.test(v) ? v : null
}
// ---------------------------------------------------------------------

async function getWebhookSecret(provider: string, botId: string) {
  const { data, error } = await supabase
    .from('integrations_calendar')
    .select('webhook_secret')
    .eq('bot_id', botId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) return null
  return data?.webhook_secret as string | null
}

function getIncomingSecret(req: NextRequest, body: any) {
  return (
    req.headers.get('x-webhook-secret') ||
    body?.secret ||
    body?.webhook_secret ||
    body?.payload?.secret ||
    ''
  ).toString().trim()
}

async function getIntegrationBySecret(provider: string, secret: string) {
  if (!secret) return null
  const { data, error } = await supabase
    .from('integrations_calendar')
    .select('bot_id, webhook_secret')
    .eq('provider', provider)
    .eq('webhook_secret', secret)
    .maybeSingle()
  if (error) return null
  return data
}

function fail(reason: string, extra?: any) {
  return NextResponse.json({ ok: false, error: reason, ...extra }, { status: 400 })
}

async function verifySharedSecret(req: NextRequest, provider: string, botId: string) {
  const incoming = (req.headers.get('x-webhook-secret') || '').trim()
  const expectedFromDB = await getWebhookSecret(provider, botId)
  const expectedFromEnv = ({
    calendly: process.env.WEBHOOK_SECRET_CALENDLY,
    tidycal: process.env.WEBHOOK_SECRET_TIDYCAL,
    savvycal: process.env.WEBHOOK_SECRET_SAVVYCAL,
    setmore: process.env.WEBHOOK_SECRET_SETMORE,
    oncehub: process.env.WEBHOOK_SECRET_ONCEHUB,
    acuity: process.env.WEBHOOK_SECRET_ACUITY,
    google_calendar: process.env.WEBHOOK_SECRET_GOOGLE,
    outlook: process.env.WEBHOOK_SECRET_OUTLOOK,
    unknown: process.env.WEBHOOK_SECRET_DEFAULT
  } as Record<string, string | undefined>)[provider]
  const expected = (expectedFromDB ?? expectedFromEnv ?? '').trim()
  if (!expected) throw new Error('no_expected_secret_configured')
  if (!incoming) throw new Error('missing_x_webhook_secret_header')
  if (incoming !== expected) throw new Error('secret_mismatch')
}

async function upsertAppointment(n: Normalized) {
  if (n.rescheduled_from_event_id) {
    await supabase
      .from('appointments')
      .update({ status: 'canceled' })
      .eq('provider', n.provider)
      .eq('provider_event_id', n.rescheduled_from_event_id)
  }

  const { data, error } = await supabase
    .from('appointments')
    .upsert(
      {
        provider: n.provider,
        event_id: n.event_id,
        provider_event_id: n.event_id,   // keep provider+provider_event_id unique
        bot_id: n.bot_id as any,
        status: n.status,
        starts_at: n.starts_at,
        timezone: n.timezone ?? null,

        // ✅ write conversation_id if the session/lead looks like a UUID
        conversation_id: pickConversationId(n),

        metadata: {
          ...(n.metadata ?? {}),
          rescheduled_from_event_id: n.rescheduled_from_event_id ?? null,
          lead_id: n.lead_id ?? null,
          user_session_id: n.user_session_id ?? null,
        },
      },
      { onConflict: 'provider,provider_event_id' }
    )
    .select()
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data[0] : data
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const provider = getProvider(req, body)
    if (!provider || provider === 'unknown') {
      return fail('provider_unknown', { got: provider })
    }

    const incomingSecret = getIncomingSecret(req, body)
    const integration = await getIntegrationBySecret(provider, incomingSecret)

    let normalized: Normalized
    try {
      normalized = normalizeWebhook(provider, body)
    } catch (e: any) {
      return fail(e?.message || 'normalize_failed', { body })
    }

    if (!normalized.bot_id && integration?.bot_id) {
      normalized.bot_id = integration.bot_id as any
    }

    try {
      if (integration?.webhook_secret) {
        if (!incomingSecret) return fail('missing_webhook_secret')
        if (incomingSecret !== integration.webhook_secret) return fail('secret_mismatch')
      } else if (normalized.bot_id) {
        await verifySharedSecret(req, provider, normalized.bot_id)
      } else {
        return fail('unauthorized_no_matching_integration')
      }
    } catch (e: any) {
      return fail(e?.message || 'unauthorized', {
        provider,
        bot_id: normalized.bot_id || null,
        note: 'ensure provider sends secret and it matches an integrations_calendar row'
      })
    }

    try {
      const saved = await upsertAppointment(normalized)
      return NextResponse.json({ ok: true, id: saved?.id })
    } catch (e: any) {
      return fail('upsert_failed', { message: e?.message })
    }
  } catch (e: any) {
    return fail('handler_exception', { message: e?.message })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
      'Access-Control-Allow-Headers': 'content-type,x-provider,x-webhook-secret',
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const botId = searchParams.get("bot_id")

  if (!botId) {
    return NextResponse.json({ ok: false, error: "missing_bot_id" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("bot_id", botId)
    .eq("status", "confirmed")
    .order("starts_at", { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    count: data.length,
    appointments: data,
  })
}
