// src/app/dashboard/appointments/[botId]/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppointmentsTable, { UIAppointment } from '@/components/AppointmentsTable'
import { ArrowLeft, Loader2 } from 'lucide-react'

type DBAppointment = {
  id: string
  bot_id: string
  status: 'confirmed' | 'rescheduled' | 'canceled'
  starts_at: string | null
  timezone: string | null
  metadata: any
}

type Counts = {
  total: number
  confirmed: number
  rescheduled: number
  canceled: number
  bookings: number // confirmed + rescheduled
}

export default function BotAppointmentsPage() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<UIAppointment[]>([])
  const [botName, setBotName] = useState<string>('')
  const [counts, setCounts] = useState<Counts | null>(null)

  // (Optional) fetch bot name for header; ignores errors/405s
  useEffect(() => {
    if (!botId) return
    ;(async () => {
      try {
        const r = await fetch(`/api/bots/${botId}`, { cache: 'no-store' }).catch(() => null)
        if (r?.ok) {
          const j = await r.json()
          setBotName(j?.bot?.bot_name || '')
        }
      } catch (_e) {
        // intentionally ignored (best-effort header fetch)
        void _e
      }
    })()
  }, [botId])

  // Fetch booking counts for this bot (server-computed)
  useEffect(() => {
    if (!botId) return
    ;(async () => {
      try {
        const r = await fetch(`/api/appointments?botId=${botId}&format=counts`, { cache: 'no-store' })
        const j = await r.json()
        setCounts(j?.counts ?? null)
      } catch (_e) {
        // intentionally ignored (non-critical stats)
        void _e
      }
    })()
  }, [botId])

  // Fetch appointments for this bot (raw rows used by the table)
  useEffect(() => {
    if (!botId) return
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/appointments?botId=${botId}`, { cache: 'no-store' })
        const json = await res.json()
        const rows: DBAppointment[] = json?.data || []

        const ui: UIAppointment[] = rows.map((r) => {
          const m = r?.metadata || {}

          // Try common shapes for invitee/contact details
          const invitee =
            m.invitee ||
            m.payload?.invitee ||
            m.payload?.invitees?.[0] ||
            {}

          const name =
            invitee.name ||
            m.name ||
            m.payload?.name ||
            m.payload?.questions_and_answers?.find?.((q: any) => /name/i.test(q?.question))?.answer ||
            'Unknown'

          const email =
            invitee.email ||
            m.email ||
            m.payload?.email ||
            m.payload?.questions_and_answers?.find?.((q: any) => /email/i.test(q?.question))?.answer ||
            ''

          const phone =
            invitee.phone ||
            m.phone ||
            m.payload?.phone ||
            m.payload?.questions_and_answers?.find?.((q: any) => /phone|tel/i.test(q?.question))?.answer

          const service =
            m.event?.name ||
            m.payload?.event?.name ||
            m.event_type ||
            undefined

          const duration =
            (m.event?.duration && `${m.event.duration} minutes`) ||
            (m.payload?.event?.duration && `${m.payload.event.duration} minutes`) ||
            undefined

          const notes =
            m.notes ||
            m.payload?.notes ||
            m.description ||
            undefined

          const status: UIAppointment['status'] =
            r.status === 'confirmed' ? 'Confirmed' :
            r.status === 'rescheduled' ? 'Rescheduled' :
            'Canceled'

          return {
            id: r.id,
            dateTime: r.starts_at ?? new Date().toISOString(),
            clientName: name,
            email,
            status,
            phone,
            service,
            duration,
            notes,
          }
        })

        ui.sort((a, b) => +new Date(b.dateTime) - +new Date(a.dateTime))
        setAppointments(ui)
      } finally {
        setLoading(false)
      }
    })()
  }, [botId])

  const title = useMemo(
    () => (botName ? `Appointments – ${botName}` : 'Appointments'),
    [botName]
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto mb-4">
        <button
          onClick={() => router.push('/dashboard/appointments')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to bots
        </button>
      </div>

      {/* Server counts summary */}
      {counts && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card label="Bookings"    value={counts.bookings}    accent="text-blue-600" />
          <Card label="Confirmed"   value={counts.confirmed}   accent="text-green-600" />
          <Card label="Rescheduled" value={counts.rescheduled} accent="text-yellow-600" />
          <Card label="Canceled"    value={counts.canceled}    accent="text-red-600" />
          <Card label="Total"       value={counts.total}       accent="text-gray-800" />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading appointments…
        </div>
      ) : (
        <AppointmentsTable title={title} appointments={appointments} />
      )}
    </div>
  )
}

function Card({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  )
}
