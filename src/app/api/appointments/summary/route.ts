// src/app/api/appointments/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

// utils
const isoZ = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
const truthy = (v?: string | null) => {
  const s = (v || '').toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}
function deriveWindow(range?: string, leadMinutes = 0) {
  const now = new Date()
  const leadFrom = new Date(now.getTime() + Math.max(0, leadMinutes) * 60_000)
  switch ((range || '').toLowerCase()) {
    case 'next24h': {
      const to = new Date(leadFrom.getTime() + 24 * 3600 * 1000)
      return { from: isoZ(leadFrom), to: isoZ(to) }
    }
    case 'through_tomorrow': {
      const endTomorrowUTC = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0
      ))
      const from = leadFrom > endTomorrowUTC ? endTomorrowUTC : leadFrom
      return { from: isoZ(from), to: isoZ(endTomorrowUTC) }
    }
    default: {
      const endTodayUTC = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0
      ))
      return { from: isoZ(leadFrom), to: isoZ(endTodayUTC) }
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // NEW: prefer userId; fallback to explicit botIds
  const userId = searchParams.get('userId') || null
  let ids = (searchParams.get('botIds') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const range = searchParams.get('range') || ''
  const leadStr = searchParams.get('lead') || '0'
  const fromParam = searchParams.get('from') || ''
  const toParam   = searchParams.get('to')   || ''
  const debug = truthy(searchParams.get('debug'))

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } })

  // If userId is present, fetch ALL that user's bot IDs
  if (userId) {
    const { data: botRows, error: botErr } = await supabase
      .from('bots')
      .select('id')
      .eq('user_id', userId)

    if (botErr) {
      return NextResponse.json({ ok: false, error: 'Failed to load bots', details: botErr.message }, { status: 500 })
    }

    ids = (botRows ?? []).map(b => b.id)
  }

  if (!ids.length) {
    // no bots for this user (or none provided)
    return NextResponse.json({
      ok: true,
      counts: { total: 0, confirmed: 0, rescheduled: 0, canceled: 0, bookings: 0 },
      filters: { ids: [], userId, range: range || null, lead: leadStr || null, from: fromParam || null, to: toParam || null },
    })
  }

  // resolve window
  const lead = Number.isFinite(Number(leadStr)) ? Math.max(0, parseInt(leadStr, 10)) : 0
  let from = fromParam
  let to   = toParam
  if (!from || !to) {
    const win = deriveWindow(range, lead)
    from = from || win.from
    to   = to   || win.to
  }

  const base = () =>
    supabase
      .from('appointments')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', ids)
      .gte('starts_at', from)
      .lt('starts_at', to)

  const [qTotal, qConfirmed, qRescheduled, qCanceled] = await Promise.all([
    base(),
    base().eq('status', 'confirmed'),
    base().eq('status', 'rescheduled'),
    base().eq('status', 'canceled'),
  ])

  const total       = qTotal.count ?? 0
  const confirmed   = qConfirmed.count ?? 0
  const rescheduled = qRescheduled.count ?? 0
  const canceled    = qCanceled.count ?? 0
  const bookings    = total - canceled

  const out = {
    ok: true,
    counts: { total, confirmed, rescheduled, canceled, bookings },
    filters: { ids, userId, range: range || null, lead, from, to },
  }

  if (debug) console.log('[summary HIT]', out.filters, out.counts)

  return NextResponse.json(out)
}
