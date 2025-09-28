// src/app/booking/page.tsx
'use client'

import { Suspense, useMemo } from 'react'
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

/** Build "YYYY-MM-DDTHH:mm:00" (local time) from date ("YYYY-MM-DD") & time ("HH:mm") */
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

/** Local YYYY-MM-DD (avoid UTC shifting from toISOString) */
function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function BookingPageInner() {
  const sp = useSearchParams()

  // Capture once at page-level
  const pageBotId = sp.get('botId') || undefined
  const conversationId = sp.get('conversationId') || undefined
  const defaultDuration = parseDuration(sp.get('duration'))
  const isEmbedded = ['1', 'true', 'yes'].includes((sp.get('embed') || '').toLowerCase())
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  // 1) Slots loader with botId fallback + local date
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
        console.warn('[booking] missing botId for availability')
        return []
      }

      const url =
        `${API_BASE}/api/availability` +
        `?botId=${encodeURIComponent(effectiveBotId)}` +
        `&date=${encodeURIComponent(d)}` +
        `&tz=${encodeURIComponent(timezone || tz)}` +
        `&duration=${defaultDuration}`

      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return []
      const json = await res.json().catch(() => ({}))
      return Array.isArray(json?.slots) ? json.slots : []
    }
  }, [defaultDuration, tz, pageBotId])

  // 2) Safer submit with pageBotId fallback
  const onSubmit = useMemo(() => {
    return async (payload: BookingPayload) => {
      const startISO = toLocalISO(payload.date, payload.time)
      const endISO = toLocalISO(payload.date, addMinutesHHMM(payload.time, payload.duration))

      const body = {
        bot_id: pageBotId || payload.bot_id,
        summary: 'Booking',
        description: payload.notes ?? '',
        startISO,
        endISO,
        timezone: payload.timezone || tz,
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
  }, [pageBotId, tz])

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

      {/* Optional: tiny link to the email-only cancel page */}
      {pageBotId && (
        <div className="mt-4 text-xs text-gray-500">
          Need to cancel?{' '}
          <a
            className="underline"
            href={`/booking/cancel?botId=${encodeURIComponent(pageBotId)}`}
          >
            Cancel with your email
          </a>
          .
        </div>
      )}
    </>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <BookingPageInner />
    </Suspense>
  )
}
