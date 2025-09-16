// src/app/api/appointments/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only

export const dynamic = 'force-dynamic'

// helpers
function isoZ(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
function truthy(v?: string | null) {
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
      // from = now+lead, to = end of tomorrow (UTC midnight of day+2)
      const endTomorrowUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 2,
          0, 0, 0
        )
      )
      const from = leadFrom > endTomorrowUTC ? endTomorrowUTC : leadFrom
      return { from: isoZ(from), to: isoZ(endTomorrowUTC) }
    }
    default: {
      // "today" UTC, starting now+lead through end of today
      const endTodayUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0, 0, 0
        )
      )
      return { from: isoZ(leadFrom), to: isoZ(endTodayUTC) }
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const ids = (searchParams.get('botIds') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const range = searchParams.get('range') || ''
  const leadStr = searchParams.get('lead') || '0'
  const fromParam = searchParams.get('from') || ''
  const toParam   = searchParams.get('to')   || ''
  const debug = truthy(searchParams.get('debug'))

  if (!ids.length) {
    return NextResponse.json({
      ok: true,
      counts: { total: 0, confirmed: 0, rescheduled: 0, canceled: 0, bookings: 0 },
      filters: { ids: [], range: range || null, lead: leadStr || null, from: fromParam || null, to: toParam || null },
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

  if (debug) console.log('[summary] in', { ids, range, lead, from, to })

  // ONE Supabase query group using IN(bot_id)
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } })

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

  // Match the single-endpoint semantics: "bookings = ANY that aren't canceled"
  const bookings = total - canceled

  const out = {
    ok: true,
    counts: { total, confirmed, rescheduled, canceled, bookings },
    filters: { ids, range: range || null, lead, from, to },
  }

  if (debug) console.log('[summary] out', out)

  return NextResponse.json(out)
}
