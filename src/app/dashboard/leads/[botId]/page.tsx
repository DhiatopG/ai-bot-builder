'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  X,
  User,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  ClipboardCheck,
  Copy,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  message: string
  created_at: string
  status?: string
}

export default function BotLeadsPage() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const itemsPerPage = 5

  const copySingleField = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(() => {
      toast.success(`Copied ${label}`)
      console.log(`[Clipboard] Copied ${label}: ${value}`)
    }).catch((err) => {
      toast.error(`❌ Failed to copy ${label}`)
      console.error(`❌ Failed to copy ${label}:`, err)
    })
  }

  const copyLeadInfo = async (lead: Lead) => {
    const text = `Name: ${lead.name || '-'}
Email: ${lead.email || '-'}
Phone: ${lead.phone || '-'}
Message: ${lead.message || '-'}
Date: ${lead.created_at || '-'}`;

    console.log('[COPY] Trying to copy text:', text);

    if (!navigator.clipboard) {
      console.warn('[COPY] Clipboard API not supported. Trying fallback...');
    }

    try {
      await navigator.clipboard.writeText(text);
      console.log('[COPY] ✅ Clipboard API copy success');

      setCopySuccess(lead.id);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('[COPY] ❌ Clipboard API failed:', err);

      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const successful = document.execCommand('copy');
        console.log('[COPY] Fallback execCommand result:', successful);

        document.body.removeChild(textarea);

        if (successful) {
          setCopySuccess(lead.id);
          setTimeout(() => setCopySuccess(null), 2000);
        } else {
          console.error('[COPY] ❌ Fallback execCommand failed.');
        }
      } catch (fallbackErr) {
        console.error('[COPY] ❌ Fallback copy exception:', fallbackErr);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const fetchLeads = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !botId) return
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
      if (!error && data) setLeads(data)
    }
    fetchLeads()
  }, [botId])

  const filtered = useMemo(() => {
    return leads.filter((lead) =>
      [lead.name, lead.email, lead.phone, lead.message].some((f) =>
        f?.toLowerCase().includes(search.toLowerCase())
      )
    )
  }, [search, leads])

  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)

  const deleteLead = async (leadId: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', leadId)
    if (!error) {
      setLeads((prev) => prev.filter((lead) => lead.id !== leadId))
    }
    setOpenDropdown(null)
  }

  const markLead = async (leadId: string, status: string) => {
    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', leadId)
      .select()

    if (!error && data) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, status } : lead
        )
      )
    }

    setOpenDropdown(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-sm text-blue-600 hover:underline mb-2"
          >
            ← Go Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb极-2">Leads</h1>
          <p className="text-gray-600">Manage your leads</p>
        </div>

        {/* Search Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1极2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-sm">Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm">Email</th>
                  <th className="text-left py-4 px-6 font-semib极 text-sm">Phone</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm">Message</th>
                  <th className="text-right py-4 px-6 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-gray-50 ${
                    lead.status === 'converted' ? 'bg-green-50' :
                    lead.status === 'qualified' ? 'bg-yellow-50' : ''
                  }`}>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="text-sm text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</div>
                      {lead.status && (
                        <span className={`text-xs font-semibold rounded-full px-2 py-1 capitalize ${
                          lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                          lead.status === 'qualified' ? 'bg-yellow-100 text-yellow-700' :
                          lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                          lead.status === 'not-interested' ? 'bg-gray-100 text-gray-600' : ''
                        }`}>
                          {lead.status}
                        </span>
                      )}
                      <div>
                        <button
                          onClick={() => copySingleField(lead.name, 'Name')}
                          className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                        >
                          Copy Name
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {lead.email}
                      <div>
                        <button
                          onClick={() => copySingleField(lead.email, 'Email')}
                          className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                        >
                          Copy Email
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {lead.phone}
                      <div>
                        <button
                          onClick={() => copySingleField(lead.phone, 'Phone')}
                          className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                        >
                          Copy Phone
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm truncate max-w-xs" title={lead.message}>
                      {lead.message}
                      <div>
                        <button
                          onClick={() => copySingleField(lead.message, 'Message')}
                          className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                        >
                          Copy Message
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setSelectedLead(lead)} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <div ref={dropdownRef} className="relative">
                          <button onClick={() => setOpenDropdown(openDropdown === lead.id ? null : lead.id)} className="p-1 hover:bg-gray-100 rounded">
                            <MoreHorizontal className="hidden" />
                          </button>
                          {openDropdown === lead.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    console.log(`[Copy] Triggered for lead: ${lead.id}`)
                                    copyLeadInfo(lead)
                                  }}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  {copySuccess === lead.id ? (
                                    <>
                                      <ClipboardCheck className="h-4 w-4 text-green-600" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" />
                                      Copy Info
                                    </>
                                  )}
                                </button>

                                <div className="border-t border-gray-100 my-1" />

                                <div className="px-4 py-2">
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Mark as</p>
                                  <div className="space-y-1">
                                    <button
                                      onClick={() => markLead(lead.id, 'contacted')}
                                      className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors"
                                    >
                                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                      Contacted
                                    </button>
                                    <button
                                      onClick={() => markLead(lead.id, 'qualified')}
                                      className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 rounded transition-colors"
                                    >
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                      Qualified
                                    </button>
                                    <button
                                      onClick={() => markLead(lead.id, 'converted')}
                                      className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 rounded transition-colors"
                                    >
                                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                                      Converted
                                    </button>
                                    <button
                                      onClick={() => markLead(lead.id, 'not-interested')}
                                      className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-700 rounded transition-colors"
                                    >
                                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                      Not Interested
                                    </button>
                                  </div>
                                </div>

                                <div className="border-t border-gray-100 my-1" />

                                <button
                                  onClick={() => deleteLead(lead.id)}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete Lead
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-gray-200">
            {paginated.map((lead) => (
              <div key={lead.id} className="p-4">
                <div className="flex justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{lead.name}</h3>
                    <p className="text-sm text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</p>
                    {lead.status && (
                      <span className={`text-xs font-semibold rounded-full px-2 py-1 capitalize ${
                        lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                        lead.status === 'qualified' ? 'bg-yellow-100 text-yellow-700' :
                        lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                        lead.status === 'not-interested' ? 'bg-gray-100 text-gray-600' : ''
                      }`}>
                        {lead.status}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedLead(lead)} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <div ref={dropdownRef} className="relative">
                      <button onClick={() => setOpenDropdown(openDropdown === lead.id ? null : lead.id)} className="p-1 hover:极gray-100 rounded">
                        <MoreHorizontal className="hidden" />
                      </button>
                      {openDropdown === lead.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                console.log(`[Copy] Triggered for lead: ${lead.id}`)
                                copyLeadInfo(lead)
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              {copySuccess === lead.id ? (
                                <>
                                  <ClipboardCheck className="h-4 w-4 text-green-600" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4" />
                                  Copy Info
                                </>
                              )}
                            </button>

                            <div className="border-t border-gray-100 my-1" />

                            <div className="px-4 py-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Mark as</p>
                              <div className="space-y-1">
                                <button
                                  onClick={() => markLead(lead.id, 'contacted')}
                                  className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors"
                                >
                                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                  Contacted
                                </button>
                                <button
                                  onClick={() => markLead(lead.id, 'qualified')}
                                  className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 rounded transition-colors"
                                >
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                  Qualified
                                </button>
                                <button
                                  onClick={() => markLead(lead.id, 'converted')}
                                  className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 rounded transition-colors"
                                >
                                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                                  Converted
                                </button>
                                <button
                                  onClick={() => markLead(lead.id, 'not-interested')}
                                  className="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-700 rounded transition-colors"
                                >
                                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                  Not Interested
                                </button>
                              </div>
                            </div>

                            <div className="border-t border-gray-100 my-1" />

                            <button
                              onClick={() => deleteLead(lead.id)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Lead
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Name</span>
                    <p>{lead.name}</p>
                    <button
                      onClick={() => copySingleField(lead.name, 'Name')}
                      className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                    >
                      Copy Name
                    </button>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Email</span>
                    <p>{lead.email}</p>
                    <button
                      onClick={() => copySingleField(lead.email, 'Email')}
                      className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                    >
                      Copy Email
                    </button>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Phone</span>
                    <p>{lead.phone}</p>
                    <button
                      onClick={() => copySingleField(lead.phone, 'Phone')}
                      className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                    >
                      Copy Phone
                    </button>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Message</span>
                    <p>{lead.message}</p>
                    <button
                      onClick={() => copySingleField(lead.message, 'Message')}
                      className="mt-1 px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium cursor-pointer"
                    >
                      Copy Message
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-gray-700">
              Showing {Math.min((page - 1) * itemsPerPage + 1, filtered.length)} to{' '}
              {Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-2 border rounded disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-sm">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-2 border rounded disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Lead Details</h2>
              <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedLead.name}</h3>
                  <p className="text-sm text-gray-500">Lead Contact</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg mt-1">
                      <Mail className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="text-gray-900">{selectedLead.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg mt-1">
                      <Phone className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="text-gray-900">{selectedLead.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg mt-1">
                    <Calendar className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Date Created</p>
                    <p className="text-gray-900">
                      {new Date(selectedLead.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg mt-1">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Message</p>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-900">{selectedLead.message}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button onClick={() => setSelectedLead(null)} className="px-4 py-2 border rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                Close
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Contact Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}