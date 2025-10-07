// src/app/book/page.tsx
'use client'

import { Suspense, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import BookingFormUI, { BookingPayload } from '@/components/BookingFormUI'

const API_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '')

/** Duration parser: default 30, clamp [30..180] */
function parseDuration(s: string | null): number {
  const n = Number(s)
  if (!Number.isFinite(n)) return 30
  return Math.min(180, Math.max(30, Math.round(n)))
}

/** Build "YYYY-MM-DDTHH:mm:00" (local) from date ("YYYY-MM-DD") & time ("HH:mm") */
function toLocalISO(date: string, time: string) {
  return `${date}T${time}:00`
}

/** Add minutes to "HH:mm" safely across midnight */
function addMinutesHHMM(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10))
  const total = h * 60 + m + minutes
  const mod = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = Math.floor(mod / 60)
  const mm = mod % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Local YYYY-MM-DD (avoid UTC shifting) */
function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function BookPageInner() {
  const sp = useSearchParams()

  // Debug console when ?debug=1
  useEffect(() => {
    if (typeof window === 'undefined') return
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('debug') !== '1') return
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/eruda'
    s.onload = () => (window as any).eruda?.init()
    document.body.appendChild(s)
  }, [])

  // Page-level params
  const pageBotId = sp.get('botId') || undefined
  const conversationId = sp.get('conversationId') || undefined
  const defaultDuration = parseDuration(sp.get('duration'))
  const isEmbedded = ['1', 'true', 'yes'].includes((sp.get('embed') || '').toLowerCase())
  const tzBrowser = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  // --- Reschedule params from redirect ---
  const mode = sp.get('mode')
  const eventId = sp.get('eventId') || sp.get('external_event_id') || undefined
  const qDate = sp.get('date') || undefined        // YYYY-MM-DD
  const qTime = sp.get('time') || undefined        // HH:mm
  const qTz   = sp.get('tz')   || tzBrowser

  // Perform backend reschedule once when opened with the params
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (mode !== 'reschedule') return
    if (!pageBotId || !eventId || !qDate || !qTime) return

    const run = async () => {
      try {
        const startISO = toLocalISO(qDate, qTime)
        const endISO   = toLocalISO(qDate, addMinutesHHMM(qTime, defaultDuration))

        const res = await fetch(`${API_BASE}/api/reschedule-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId: pageBotId,
            eventId,
            startISO,
            endISO,
            timezone: qTz,
          }),
        })

        // Do not block UI; BookingFormUI will show success via ?flash=rescheduled
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          console.error('[book] reschedule failed', res.status, err)
        }
      } catch (e) {
        console.error('[book] reschedule error', e)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pageBotId, eventId, qDate, qTime, qTz, defaultDuration])

  // Availability loader
  const loadTimeSlots = useMemo(() => {
    return async ({
      date,
      timezone,
      botId,
    }: {
      date: Date
      timezone: string
      botId?: string
      conversationId?: string
    }): Promise<string[]> => {
      const d = ymdLocal(date)
      const effectiveBotId = botId || pageBotId
      if (!effectiveBotId) {
        console.warn('[book] missing botId for availability')
        return []
      }

      const url =
        `${API_BASE}/api/availability` +
        `?botId=${encodeURIComponent(effectiveBotId)}` +
        `&date=${encodeURIComponent(d)}` +
        `&tz=${encodeURIComponent(timezone || tzBrowser)}` +
        `&duration=${defaultDuration}`

      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return []
      const json = await res.json().catch(() => ({}))
      return Array.isArray(json?.slots) ? json.slots : []
    }
  }, [defaultDuration, tzBrowser, pageBotId])

  // New bookings (reschedule handled in the effect above)
  const onSubmit = useMemo(() => {
    return async (payload: BookingPayload) => {
      const startISO = toLocalISO(payload.date, payload.time)
      const endISO   = toLocalISO(payload.date, addMinutesHHMM(payload.time, payload.duration))

      const body = {
        bot_id: pageBotId || payload.bot_id,
        summary: 'Booking',
        description: payload.notes ?? '',
        startISO,
        endISO,
        timezone: payload.timezone || tzBrowser,
        invitee_name: payload.name,
        invitee_email: payload.email,
        invitee_phone: payload.phone ?? undefined,
        conversation_id: payload.conversation_id || undefined,
      }

      const res = await fetch(`${API_BASE}/api/appointments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { ok: false as const, error: err?.error || 'Failed to create event' }
      }
      return { ok: true as const }
    }
  }, [pageBotId, tzBrowser])

  return (
    <>
      <BookingFormUI
        botId={pageBotId}
        conversationId={conversationId}
        defaultDuration={defaultDuration}
        isEmbedded={isEmbedded}
        loadTimeSlots={loadTimeSlots}
        onSubmit={onSubmit}
      />

      {pageBotId && (
        <div className="mt-4 text-xs text-gray-500">
          Need to cancel?{' '}
          <a className="underline" href={`/book/cancel?botId=${encodeURIComponent(pageBotId)}`}>
            Cancel with your email
          </a>.
        </div>
      )}
    </>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <BookPageInner />
    </Suspense>
  )
}
