import type { UIAppointment } from '@/components/AppointmentsTable'

export function capStatus(s: string): UIAppointment['status'] {
  switch ((s || '').toLowerCase()) {
    case 'confirmed': return 'Confirmed'
    case 'rescheduled': return 'Rescheduled'
    case 'canceled':
    case 'cancelled': return 'Canceled'
    default: return 'Confirmed'
  }
}

export function toUI(row: any): UIAppointment {
  const meta = row?.metadata || {}
  const inner = meta.metadata || {}
  const invitee =
    meta.invitee ||
    inner.invitee ||
    { name: meta.name || inner.name, email: meta.email || inner.email } ||
    {}

  const name =
    invitee?.name ??
    meta?.invitee_name ??
    inner?.invitee_name ??
    'Unknown'

  const email =
    invitee?.email ??
    meta?.invitee_email ??
    inner?.invitee_email ??
    ''

  return {
    id: row.id,
    dateTime: row.starts_at ?? new Date().toISOString(),
    clientName: name,
    email,
    status: capStatus(row.status),
    service: meta?.event_type?.name || meta?.service || inner?.service || undefined,
    notes: meta?.notes || inner?.notes || undefined,
    duration: meta?.duration ? `${meta.duration} min` : undefined,
  }
}
