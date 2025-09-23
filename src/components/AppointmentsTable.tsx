'use client'

import React, { useMemo, useState } from 'react'
import { Calendar, Clock, User, Mail, Eye, X, Search, Ban } from 'lucide-react'
import toast from 'react-hot-toast'

export type UIAppointment = {
  id: string
  dateTime: string // ISO
  clientName: string
  email: string
  status: 'Confirmed' | 'Rescheduled' | 'Canceled'
  phone?: string
  service?: string
  notes?: string
  duration?: string
  externalEventId?: string | null   // NEW: for Google cancellation
}

type Props = {
  title?: string
  appointments: UIAppointment[]
  botId: string                      // NEW: needed for cancel API
  showSummary?: boolean              // keep/disable the 4 local cards
  onChanged?: () => void             // *** ADDED: optional refresh callback
}

export default function AppointmentsTable({
  title = 'Appointments Dashboard',
  appointments,
  botId,
  showSummary = true,
  onChanged,                          // *** ADDED
}: Props) {
  const [selectedAppointment, setSelectedAppointment] = useState<UIAppointment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [rows, setRows] = useState<UIAppointment[]>(appointments)
  const [cancelling, setCancelling] = useState<string | null>(null)

  // keep local rows in sync if parent refetches
  React.useEffect(() => setRows(appointments), [appointments])

  const filteredAppointments = useMemo(() => {
    const q = searchTerm.toLowerCase()
    return (rows || []).filter(a =>
      a.clientName?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      (a.service || '').toLowerCase().includes(q)
    )
  }, [rows, searchTerm])

  const statusCounts = useMemo(() => {
    return filteredAppointments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [filteredAppointments])

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Confirmed':   return 'bg-green-100 text-green-800 border-green-200'
      case 'Rescheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Canceled':    return 'bg-red-100 text-red-800 border-red-200'
      default:            return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    }
  }

  const cancelOnGoogle = async (row: UIAppointment) => {
    if (!row.externalEventId) return
    setCancelling(row.id)
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ botId, eventId: row.externalEventId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.error) throw new Error(j?.error || `Cancel failed (${res.status})`)

      // Optimistic local update
      setRows(prev =>
        prev.map(r => r.id === row.id ? { ...r, status: 'Canceled' } as UIAppointment : r)
      )
      if (selectedAppointment?.id === row.id) {
        setSelectedAppointment({ ...row, status: 'Canceled' })
      }

      // *** ADDED: notify parent to refetch if it wants
      onChanged?.()

      toast.success('Appointment canceled on Google Calendar.')
    } catch (e: any) {
      toast.error(e?.message || 'Cancel failed')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600">Manage and track all your appointments</p>
        </div>

        {/* Summary Cards (table-local, optional) */}
        {showSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-blue-600">{filteredAppointments.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Confirmed</p>
                  <p className="text-2xl font-bold text-green-600">{statusCounts['Confirmed'] || 0}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <User className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rescheduled</p>
                  <p className="text-2xl font-bold text-yellow-600">{statusCounts['Rescheduled'] || 0}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Canceled</p>
                  <p className="text-2xl font-bold text-red-600">{statusCounts['Canceled'] || 0}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <X className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAppointments.map((a) => {
                  const { date, time } = formatDateTime(a.dateTime)
                  const canCancel = a.status === 'Confirmed' && !!a.externalEventId
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedAppointment(a)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{date}</div>
                          <div className="text-sm text-gray-500">{time}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{a.clientName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Mail className="h-4 w-4 mr-2" />
                          {a.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedAppointment(a) }}
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); cancelOnGoogle(a) }}
                            disabled={!canCancel || cancelling === a.id}
                            className={`flex items-center ${canCancel ? 'text-red-600 hover:text-red-800' : 'text-gray-300 cursor-not-allowed'}`}
                            title={a.externalEventId ? 'Cancel on Google Calendar' : 'No Google event id'}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            {cancelling === a.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty state */}
        {filteredAppointments.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">No appointments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by scheduling your first appointment.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
              <button onClick={() => setSelectedAppointment(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Name</label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-gray-900">{selectedAppointment.clientName}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-gray-900">{selectedAppointment.email}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-gray-900">
                      {formatDateTime(selectedAppointment.dateTime).date} at {formatDateTime(selectedAppointment.dateTime).time}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex items-center">
                    <span className={`inline-flex px-3 py-2 text-sm font-medium rounded-lg border ${getStatusBadgeColor(selectedAppointment.status)}`}>
                      {selectedAppointment.status}
                    </span>
                  </div>
                </div>
              </div>

              {selectedAppointment.duration && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-gray-900">{selectedAppointment.duration}</span>
                  </div>
                </div>
              )}

              {selectedAppointment.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-900">{selectedAppointment.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button onClick={() => setSelectedAppointment(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Close
              </button>
              {selectedAppointment.status === 'Confirmed' && selectedAppointment.externalEventId && (
                <button
                  onClick={() => cancelOnGoogle(selectedAppointment)}
                  disabled={cancelling === selectedAppointment.id}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  {cancelling === selectedAppointment.id ? 'Cancelling…' : 'Cancel Appointment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
