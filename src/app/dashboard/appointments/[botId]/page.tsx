'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppointmentsTable, { UIAppointment } from '@/components/AppointmentsTable'
import { ArrowLeft, Loader2 } from 'lucide-react'

type DBAppointment = {
  id: string
  bot_id: string
  status: string                      // normalize later
  starts_at: string | null
  timezone: string | null
  metadata: any
  invitee_name?: string | null        // <-- NEW
  invitee_email?: string | null       // <-- NEW
  external_event_id?: string | null   // <-- add: present in your data
}

export default function BotAppointmentsPage() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<UIAppointment[]>([])
  const [botName, setBotName] = useState<string>('')

  // Fetch bot name (best-effort)
  useEffect(() => {
    if (!botId) return
    ;(async () => {
      try {
        const r = await fetch(`/api/bots/${botId}`, { cache: 'no-store' }).catch(() => null)
        if (r?.ok) {
          const j = await r.json()
          setBotName(j?.bot?.bot_name || '')
        }
      } catch { /* ignore */ }
    })()
  }, [botId])

  const loadAppointments = useCallback(async () => {
    if (!botId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments?botId=${botId}`, { cache: 'no-store' })
      const json = await res.json()
      const rows: DBAppointment[] = json?.data || []

      const ui: UIAppointment[] = rows.map((r) => {
        const m = r?.metadata || {}

        // Try DB columns first, then metadata shapes
        const invitee =
          m.invitee ||
          m.payload?.invitee ||
          m.payload?.invitees?.[0] ||
          {}

        const name =
          (r.invitee_name && String(r.invitee_name).trim()) ||
          invitee.name ||
          m.name ||
          m.payload?.name ||
          m.payload?.questions_and_answers?.find?.((q: any) => /name/i.test(q?.question))?.answer ||
          'Unknown'

        const email =
          (r.invitee_email && String(r.invitee_email).trim()) ||
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

        // Normalize status spelling to UI set
        const raw = (r.status || '').toLowerCase()
        const status: UIAppointment['status'] =
          raw === 'confirmed'   ? 'Confirmed'   :
          raw === 'rescheduled' ? 'Rescheduled' :
          /* canceled/cancelled */               'Canceled'

        // Surface Google event id (needed for Cancel button in AppointmentsTable)
        const externalEventId =
          r.external_event_id ??
          m.external_event_id ??
          m.payload?.external_event_id ??
          null

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
          externalEventId, // <-- important
        }
      })

      ui.sort((a, b) => +new Date(b.dateTime) - +new Date(a.dateTime))
      setAppointments(ui)
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  // Compute all headline stats from the same list the table shows
  const stats = useMemo(() => {
    const total = appointments.length
    const confirmed   = appointments.filter(a => a.status === 'Confirmed').length
    const rescheduled = appointments.filter(a => a.status === 'Rescheduled').length
    const canceled    = appointments.filter(a => a.status === 'Canceled').length
    const bookings    = confirmed + rescheduled
    return { total, confirmed, rescheduled, canceled, bookings }
  }, [appointments])

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

      {/* Single source of truth – stats from the loaded list */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card label="Bookings"    value={stats.bookings}    accent="text-blue-600" />
        <Card label="Confirmed"   value={stats.confirmed}   accent="text-green-600" />
        <Card label="Rescheduled" value={stats.rescheduled} accent="text-yellow-600" />
        <Card label="Canceled"    value={stats.canceled}    accent="text-red-600" />
        <Card label="Total"       value={stats.total}       accent="text-gray-800" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading appointments…
        </div>
      ) : (
        <AppointmentsTable
          title={title}
          appointments={appointments}
          botId={botId as string}
          showSummary={false}
          onChanged={loadAppointments}   // <-- required by AppointmentsTable
          // showSummary defaults to true in the table; omit or set explicitly
        />
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
