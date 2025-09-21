// src/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { randomUUID, createHmac } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PEPPER = process.env.API_TOKEN_PEPPER || process.env.API_KEY_SIGNING_SECRET || ''

export const dynamic = 'force-dynamic'

// ---------- helpers ----------
function isoZ(d: Date) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z') }
function rndId() { return Math.random().toString(36).slice(2, 8) }
function truthy(v?: string | null) {
  const s = (v || '').toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}
function isUuid(s?: string | null) {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}
function deriveWindow(range: string | undefined, leadMinutes = 0) {
  const now = new Date()
  const leadFrom = new Date(now.getTime() + Math.max(0, leadMinutes) * 60_000)
  const z = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
  switch ((range || '').toLowerCase()) {
    case 'next24h': {
      const to = new Date(leadFrom.getTime() + 24 * 3600 * 1000)
      return { from: z(leadFrom), to: z(to) }
    }
    case 'through_tomorrow': {
      const endTomorrowUTC = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0
      ))
      const from = leadFrom > endTomorrowUTC ? endTomorrowUTC : leadFrom
      return { from: z(from), to: z(endTomorrowUTC) }
    }
    default: {
      // ✅ Default = upcoming 30 days (not only until end of today)
      const to = new Date(leadFrom.getTime() + 30 * 24 * 3600 * 1000)
      return { from: z(leadFrom), to: z(to) }
    }
  }
}
const admin = () => createClient(url, serviceRole, { auth: { persistSession: false } })
const bearerClient = (token: string) =>
  createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
const sha256 = (raw: string) =>
  createHmac('sha256', PEPPER || 'unset-pepper').update(raw).digest('hex')

// Auth resolution
type AuthCtx = {
  mode: 'dev' | 'apiKey' | 'bearer' | 'cookie'
  supabase: SupabaseClient<any, 'public', any>
  userId?: string | null
  workspaceId?: string | null
}

async function resolveAuth(req: NextRequest): Promise<AuthCtx | { error: NextResponse }> {
  const devHeader = req.headers.get('x-dev-secret') ?? req.headers.get('X-DEV-SECRET')
  const isLocal = process.env.NODE_ENV !== 'production'
  const allowDevBypass = isLocal && !!process.env.DEV_TEST_SECRET && devHeader === process.env.DEV_TEST_SECRET
  if (allowDevBypass) {
    return { mode: 'dev', supabase: admin() }
  }

  // X-API-Key → verify hash and get workspace_id
  const apiKey = req.headers.get('x-api-key') ?? req.headers.get('X-API-Key')
  if (apiKey) {
    if (!PEPPER) {
      return { error: NextResponse.json({ ok: false, error: 'Server misconfigured (API_TOKEN_PEPPER missing)' }, { status: 500 }) }
    }
    const supa = admin()
    const tokenHash = sha256(apiKey)
    const { data: tok, error } = await supa
      .from('workspace_api_tokens')
      .select('workspace_id, active')
      .eq('token_hash', tokenHash)
      .single()
    if (error || !tok || tok.active === false) {
      return { error: NextResponse.json({ ok: false, error: 'Invalid API key' }, { status: 401 }) }
    }
    // optional: update last_used_at
    await supa.from('workspace_api_tokens').update({ last_used_at: new Date().toISOString() }).eq('token_hash', tokenHash)
    return { mode: 'apiKey', supabase: admin(), workspaceId: tok.workspace_id }
  }

  // Bearer token
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  const bearer = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.split(' ')[1] : null
  if (bearer) {
    const supa = bearerClient(bearer)
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
    return { mode: 'bearer', supabase: supa, userId: user.id }
  }

  // SSR cookie (browser)
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
  return { mode: 'cookie', supabase: supa, userId: user.id }
}

async function ensureBotAllowed(auth: AuthCtx, botId: string) {
  if (!isUuid(botId)) return { error: NextResponse.json({ ok: false, error: 'Invalid bot_id' }, { status: 400 }) }

  if (auth.mode === 'apiKey') {
    // service-role check that this bot belongs to the API key's workspace
    const { data: bot, error } = await admin()
      .from('bots')
      .select('id, workspace_id')
      .eq('id', botId)
      .single()
    if (error || !bot) return { error: NextResponse.json({ ok: false, error: 'Bot not found' }, { status: 404 }) }
    if (bot.workspace_id !== auth.workspaceId) {
      return { error: NextResponse.json({ ok: false, error: 'Forbidden for this workspace' }, { status: 403 }) }
    }
    return {}
  } else {
    // rely on RLS: the caller must have read access to the bot row
    const { data: bot, error } = await auth.supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .single()
    if (error || !bot) return { error: NextResponse.json({ ok: false, error: 'Bot not found or not accessible' }, { status: 404 }) }
    return {}
  }
}

// ---------- GET ----------
export async function GET(req: NextRequest) {
  const reqId = rndId()
  const { searchParams } = new URL(req.url)
  const botId = searchParams.get('botId')
  const status = searchParams.get('status') ?? null
  const conversationId = searchParams.get('conversationId')
  let from = searchParams.get('from')
  let to   = searchParams.get('to')
  const range  = (searchParams.get('range')  || '').toLowerCase()
  const format = (searchParams.get('format') || 'rows').toLowerCase()
  const debug  = truthy(searchParams.get('debug'))
  const leadStr = searchParams.get('lead') ?? searchParams.get('offset') ?? '0'
  const lead = Number.isFinite(Number(leadStr)) ? Math.max(0, parseInt(leadStr!, 10)) : 0

  const auth = await resolveAuth(req)
  if ('error' in auth) return auth.error
  if (!botId) return NextResponse.json({ ok: false, error: 'botId required' }, { status: 400 })
  const allowed = await ensureBotAllowed(auth, botId)
  if ('error' in allowed) return allowed.error

  if (!from || !to) {
    const win = deriveWindow(range, lead)
    from = from ?? win.from
    to   = to   ?? win.to
  }

  if (debug) console.log(`[appointments][${reqId}] GET`, { mode: auth.mode, botId, range, lead, format, from, to, status, conversationId })

  // Use the resolved client (admin for apiKey/dev, RLS for cookie/bearer)
  const supabase = auth.supabase

  // Helper to apply time window across start_time OR starts_at
  const applyTimeRange = (q: any) => {
    const ors: string[] = []
    if (from && to) {
      ors.push(`and(start_time.gte.${from},start_time.lt.${to})`)
      ors.push(`and(starts_at.gte.${from},starts_at.lt.${to})`)
    } else if (from && !to) {
      ors.push(`start_time.gte.${from}`, `starts_at.gte.${from}`)
    } else if (!from && to) {
      ors.push(`start_time.lt.${to}`, `starts_at.lt.${to}`)
    }
    if (ors.length) q = q.or(ors.join(','))
    return q
  }

  if (format === 'counts') {
    const base = () => {
      let q = supabase.from('appointments').select('id', { head: true, count: 'exact' }).eq('bot_id', botId)
      if (conversationId) q = q.eq('conversation_id', conversationId)
      q = applyTimeRange(q)
      return q
    }
    const [qTotal, qConfirmed, qRescheduled, qCanceled] = await Promise.all([
      base(),
      base().eq('status', 'confirmed'),
      base().eq('status', 'rescheduled'),
      base().eq('status', 'canceled'),
    ])

    const total = qTotal.count ?? 0
    const confirmed = qConfirmed.count ?? 0
    const rescheduled = qRescheduled.count ?? 0
    const canceled = qCanceled.count ?? 0
    const bookings = confirmed + rescheduled // ✅ more accurate

    return NextResponse.json({
      ok: true,
      counts: { total, confirmed, rescheduled, canceled, bookings },
      filters: { botId, status, conversationId, from, to, range: range || null, lead }
    })
  }

  // ROWS for table: order by both, show up to 500
  let q = supabase.from('appointments').select('*').eq('bot_id', botId).limit(500)
  if (status) q = q.eq('status', status)
  if (conversationId) q = q.eq('conversation_id', conversationId)
  q = applyTimeRange(q)
  q = q.order('start_time', { ascending: false, nullsFirst: false })
       .order('starts_at',  { ascending: false, nullsFirst: false })

  const { data, error } = await q
  if (error) {
    if (debug) console.error(`[appointments][${reqId}] ROWS_ERROR`, error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (debug) console.log(`[appointments][${reqId}] ROWS_COUNT`, { count: data?.length ?? 0 })
  return NextResponse.json({ ok: true, data: data ?? [], filters: { botId, status, conversationId, from, to, range: range || null, lead } })
}

// ---------- POST ----------
type InsertBody = {
  bot_id: string
  conversation_id?: string | null
  provider?: string | null
  invitee_name?: string | null
  invitee_email?: string | null
  invitee_phone?: string | null
  starts_at?: string
  ends_at?: string
  start_time?: string
  end_time?: string
  timezone: string
  status: 'confirmed' | 'pending' | 'rescheduled' | 'canceled' | string
  provider_event_id?: string | null
  event_id?: string | null
  external_event_id?: string | null
  metadata?: Record<string, any> | null
}

export async function POST(req: NextRequest) {
  const reqId = rndId()
  try {
    const debug = truthy(req.headers.get('x-debug')) || truthy(new URL(req.url).searchParams.get('debug'))
    const auth = await resolveAuth(req)
    if ('error' in auth) return auth.error

    const body = (await req.json()) as InsertBody
    if (!body?.bot_id) return NextResponse.json({ ok: false, error: 'bot_id is required' }, { status: 400 })
    const startISO = body.starts_at || body.start_time
    const endISO   = body.ends_at   || body.end_time
    if (!startISO) return NextResponse.json({ ok: false, error: 'start time is required' }, { status: 400 })
    if (!endISO)   return NextResponse.json({ ok: false, error: 'end time is required' }, { status: 400 })
    if (!body?.timezone) return NextResponse.json({ ok: false, error: 'timezone is required' }, { status: 400 })
    if (!body?.status)   return NextResponse.json({ ok: false, error: 'status is required' }, { status: 400 })

    const allowed = await ensureBotAllowed(auth, body.bot_id)
    if ('error' in allowed) return allowed.error

    // event id: prefer provided; otherwise generate
    const providerEventId = body.provider_event_id ?? body.external_event_id ?? body.event_id ?? randomUUID()
    const convId = isUuid(body.conversation_id ?? undefined) ? body.conversation_id : null

    const row = {
      bot_id: body.bot_id,
      conversation_id: convId,
      provider: body.provider ?? 'custom',
      starts_at: startISO,
      ends_at: endISO,
      timezone: body.timezone,
      status: body.status,
      provider_event_id: providerEventId,
      event_id: providerEventId,
      metadata: body.metadata ?? null,
      created_at: isoZ(new Date()),
    }

    if (debug) {
      const { metadata, ...preview } = row as any
      console.log(`[appointments][${reqId}] INSERT`, { mode: (auth as any).mode, ...preview, metadata: metadata ? '[provided]' : null })
    }

    // Write using the resolved client (RLS for cookie/bearer; admin for apiKey/dev)
    const supabase = auth.supabase
    const { data, error } = await (supabase as any).from('appointments').insert(row).select().single()

    if (error) {
      if (debug) console.error(`[appointments][${reqId}] INSERT_ERROR`, error)
      // Clean errors
      if (error.code === '23P01') {
        return NextResponse.json({ ok: false, error: 'Time slot already booked' }, { status: 409 })
      }
      if (error.code === '22P02') {
        return NextResponse.json({ ok: false, error: 'Invalid UUID or bad input' }, { status: 400 })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (debug) console.log(`[appointments][${reqId}] INSERT_OK`, { id: (data as any)?.id })
    return NextResponse.json({ ok: true, appointment: data }, { status: 201 })
  } catch (err: any) {
    console.error(`[appointments][${rndId()}] POST_EXCEPTION`, err)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
