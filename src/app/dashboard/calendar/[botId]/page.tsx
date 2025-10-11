// src/app/dashboard/calendar/[botId]/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'
import toast from 'react-hot-toast'

type BotInfo = {
  contact_email: string
  contact_phone: string
  contact_form_url: string
  location: string
  offer_1_title: string; offer_1_url: string
  offer_2_title: string; offer_2_url: string
  offer_3_title: string; offer_3_url: string
  offer_4_title: string; offer_4_url: string
  offer_5_title: string; offer_5_url: string
}

// --- helpers ---------------------------------------------------
function toRelativeBooking(urlOrPath: string, origin?: string): string {
  try {
    if (/^\/(?!\/)/.test(urlOrPath)) return urlOrPath.trim()
    const o = origin || (typeof window !== 'undefined' ? window.location.origin : '')
    const u = new URL(urlOrPath, o)
    if (o && u.origin === o) {
      return (u.pathname + u.search).trim() || '/'
    }
    return u.toString()
  } catch {
    return (urlOrPath || '').trim()
  }
}

function toAbsolute(urlOrPath: string): string {
  try {
    if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    if (!base) return urlOrPath
    return new URL(urlOrPath || '/', base).toString()
  } catch {
    return urlOrPath
  }
}
// --------------------------------------------------------------

export default function CalendarPage() {
  const { botId } = useParams() as { botId: string }
  const router = useRouter()

  // Calendar URL (embedded form)
  const [calendarUrl, setCalendarUrl] = useState('')
  const [savingCal, setSavingCal] = useState(false)

  // Contact & Offers
  const [info, setInfo] = useState<BotInfo>({
    contact_email: '',
    contact_phone: '',
    contact_form_url: '',
    location: '',
    offer_1_title: '', offer_1_url: '',
    offer_2_title: '', offer_2_url: '',
    offer_3_title: '', offer_3_url: '',
    offer_4_title: '', offer_4_url: '',
    offer_5_title: '', offer_5_url: ''
  })
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [savingInfo, setSavingInfo] = useState(false)

  // Webhook secret
  const [provider, setProvider] = useState('calendly')
  const [hasSecret, setHasSecret] = useState(false)
  const [secret, setSecret] = useState('')
  const [savingSecret, setSavingSecret] = useState(false)
  const [testSecret, setTestSecret] = useState('') // for test button

  // ---------- Google Calendar Connect (dynamic) ----------
  const [gLoading, setGLoading] = useState(true)
  const [gConnected, setGConnected] = useState(false)
  const [gValid, setGValid] = useState(false)
  const [gCalendarId, setGCalendarId] = useState<string | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null)

  // NEW: extra status details for the UI
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<string | null>(null)

  // hydration-safe mount flag
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // >>> Only show toasts when user clicks Recheck
  const refreshGoogleStatus = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent
    const toastId = silent ? undefined : toast.loading('Rechecking Google connection…')
    setGLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id || null
      setAuthUserId(uid)
      // capture email for status line
      setConnectedEmail(auth?.user?.email ?? null)

      if (!uid) {
        setGConnected(false)
        setGValid(false)
        setGCalendarId(null)
        if (!silent) toast.success('Refreshed', { id: toastId })
        setLastChecked(new Date().toLocaleString())
        return
      }

      const { data: row, error } = await supabase
        .from('integrations_calendar')
        .select('access_token, refresh_token, expires_at, calendar_id')
        .eq('user_id', uid)
        .maybeSingle()

      if (error) throw error

      if (row) {
        const exp = Number(row.expires_at ?? 0)
        const now = Math.floor(Date.now() / 1000)
        setGConnected(Boolean(row.access_token) && Boolean(row.refresh_token))
        setGValid(exp > (now + 5 * 60))
        setGCalendarId(row.calendar_id ?? null)
      } else {
        setGConnected(false)
        setGValid(false)
        setGCalendarId(null)
      }

      if (!silent) toast.success('Refreshed', { id: toastId })
      setLastChecked(new Date().toLocaleString())
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Failed to recheck', { id: toastId })
      setGConnected(false)
      setGValid(false)
      setGCalendarId(null)
      setLastChecked(new Date().toLocaleString())
    } finally {
      setGLoading(false)
    }
  }

  // single navigation path + guard to avoid double-open
  let _oauthInFlight = false
  const handleGoogleConnect = () => {
    if (_oauthInFlight) return
    _oauthInFlight = true

    const next = typeof window !== 'undefined'
      ? encodeURIComponent(window.location.pathname)
      : encodeURIComponent(`/dashboard/bots/${botId}/calendar`)

    const url = `/api/integrations/google/start?next=${next}`
    window.location.assign(url)
  }

  // Disconnect
  const handleGoogleDisconnect = async () => {
    if (!gConnected) return
    setGLoading(true)
    try {
      let uid = authUserId
      if (!uid) {
        const { data } = await supabase.auth.getUser()
        uid = data?.user?.id || null
      }
      if (!uid) {
        toast.error('Not signed in')
        return
      }

      const res = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.error) throw new Error(j.error || `Failed (${res.status})`)

      setGConnected(false)
      setGValid(false)
      setGCalendarId(null)
      toast.success('Disconnected from Google Calendar')
    } catch (e: any) {
      toast.error(e.message || 'Disconnect failed')
    } finally {
      setGLoading(false)
    }
  }

  const setField = (key: keyof BotInfo) => (v: string) =>
    setInfo(prev => ({ ...prev, [key]: v }))

  useEffect(() => {
    if (!botId) return
    ;(async () => {
      // Load calendar URL from bots table
      const { data: botData } = await supabase
        .from('bots')
        .select('calendar_url')
        .eq('id', botId)
        .maybeSingle()

      const fallback = `/book?botId=${botId}`
      const value = (botData?.calendar_url && botData.calendar_url.trim()) ? botData.calendar_url : fallback
      setCalendarUrl(value)

      // Load contact/offers via API
      setLoadingInfo(true)
      try {
        const res = await fetch(`/api/bots/${botId}/info`, { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        if (res.ok && j?.data) {
          const bi = j.data
          setInfo({
            contact_email: bi.contact_email ?? '',
            contact_phone: bi.contact_phone ?? '',
            contact_form_url: bi.contact_form_url ?? '',
            location: bi.location ?? '',
            offer_1_title: bi.offer_1_title ?? '', offer_1_url: bi.offer_1_url ?? '',
            offer_2_title: bi.offer_2_title ?? '', offer_2_url: bi.offer_2_url ?? '',
            offer_3_title: bi.offer_3_title ?? '', offer_3_url: bi.offer_3_url ?? '',
            offer_4_title: bi.offer_4_title ?? '', offer_4_url: bi.offer_4_url ?? '',
            offer_5_title: bi.offer_5_title ?? '', offer_5_url: bi.offer_5_url ?? ''
          })
        }
      } catch (e: any) {
        toast.error(e.message || 'Failed to load contact info')
      } finally {
        setLoadingInfo(false)
      }

      // Prefill provider & saved-secret status
      try {
        const res = await fetch(`/api/integrations/calendar?botId=${botId}`, { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        if (res.ok && j?.data) {
          setProvider(j.data.calendar_provider || 'calendly')
          setHasSecret(Boolean(j.data.has_secret))
        }
      } catch (_e: any) {
        // ignore probe errors
      }

      // Load Google connect status (silent on first load)
      await refreshGoogleStatus({ silent: true })
    })()
  }, [botId])

  // preview URL handling
  const previewUrl = useMemo(() => {
    const value = (calendarUrl && calendarUrl.trim()) ? calendarUrl : `/book?botId=${botId}`
    return toRelativeBooking(value)
  }, [calendarUrl, botId])

  const iframeSrc = useMemo(() => (mounted ? toAbsolute(previewUrl) : previewUrl), [mounted, previewUrl])

  // Save calendar URL
  const handleSaveCalendar = async () => {
    setSavingCal(true)
    try {
      const normalized = toRelativeBooking(calendarUrl)
      const { error } = await supabase.from('bots')
        .update({ calendar_url: normalized })
        .eq('id', botId)
      if (error) throw error
      setCalendarUrl(normalized)
      toast.success('Calendar URL saved!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save calendar URL')
    } finally {
      setSavingCal(false)
    }
  }

  // Save contact/offers
  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/bots/${botId}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `Failed to save (${res.status})`)
      toast.success('Contact & offers saved!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setSavingInfo(false)
    }
  }

  // Save webhook secret
  const handleSaveSecret = async () => {
    if (!secret) return
    setSavingSecret(true)
    try {
      const res = await fetch('/api/integrations/calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ botId, provider, secret }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      setHasSecret(true)
      setSecret('')
      toast.success('Webhook secret saved!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save secret')
    } finally {
      setSavingSecret(false)
    }
  }

  // Test webhook (optional)
  const handleTestWebhook = async () => {
    const useSecret = testSecret || secret
    if (!useSecret) return toast.error('Enter a test secret first.')
    try {
      const res = await fetch('/api/appointments/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-provider': provider,
          'x-webhook-secret': useSecret,
        },
        body: JSON.stringify({
          bot_id: botId,
          event_id: 'evt_' + Math.random().toString(36).slice(2, 10),
          status: 'confirmed',
          start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          timezone: 'UTC',
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) throw new Error(j.error || 'Webhook failed')
      toast.success(`Webhook OK: ${j.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Webhook test failed')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
      <div className="mb-2 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Setup Calendar & Contact/Offers</h1>
        <button onClick={() => router.push('/dashboard/calendar')}
          className="text-blue-600 hover:underline cursor-pointer">← Back to list</button>
      </div>

      {/* Google Calendar Connect (OAuth) */}
      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">Google Calendar</h2>
        {gLoading ? (
          <p className="text-sm text-gray-500">Checking connection…</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <div>
                  Status{' '}
                  {gConnected ? (
                    <span className={gValid ? 'text-green-600' : 'text-orange-600'}>
                      {gValid ? 'Connected' : 'Connected (needs refresh)'}
                    </span>
                  ) : (
                    <span className="text-red-600">Not connected</span>
                  )}
                </div>
                <div>Calendar ID: <span className="text-gray-700">{gCalendarId || '—'}</span></div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={gConnected && gValid}
                  className="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-black transition disabled:opacity-50"
                >
                  {gConnected ? (gValid ? 'Connected' : 'Refresh Connection') : 'Connect Google'}
                </button>
                <button
                  type="button"
                  onClick={() => refreshGoogleStatus({ silent: false })} // show "Refreshed"
                  disabled={gLoading}
                  className="cursor-pointer border px-4 py-2 rounded-md disabled:opacity-50"
                >
                  Recheck
                </button>
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  disabled={!gConnected || gLoading}
                  className="cursor-pointer border border-red-500 text-red-600 px-4 py-2 rounded-md hover:bg-red-50 disabled:opacity-50"
                  title="Disconnect Google Calendar for this user"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {/* NEW: status line + Google permissions link */}
            <p className="mt-2 text-sm text-gray-700">
              Connected as <strong>{connectedEmail ?? '—'}</strong> • Calendar ID: <code>{gCalendarId ?? '—'}</code> • Last checked: {lastChecked ?? '—'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Disconnect removes your stored tokens from In60second. You can also manage or revoke access from your Google Account:&nbsp;
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                myaccount.google.com/permissions
              </a>.
            </p>
          </>
        )}
        <p className="text-xs text-gray-500">
          Connecting lets the bot read busy times and create appointments on your calendar.
        </p>
      </section>

      {/* Calendar (embedded URL for external providers or your own form) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Calendar</h2>
        <div>
          <label htmlFor="calendar-url" className="block text-sm font-medium text-gray-700 mb-1">
            Calendar URL
          </label>
          <input
            id="calendar-url"
            type="text"
            value={calendarUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
            placeholder={`/book?botId=${botId}  (or a provider URL like https://calendly.com/...)`}
          />
          <p className="text-xs text-gray-500 mt-1">
            Tip: If you paste your own domain URL, we’ll save it as a relative path for portability.
          </p>
        </div>
        <button
          onClick={handleSaveCalendar}
          disabled={savingCal}
          className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          {savingCal ? 'Saving...' : 'Save Calendar'}
        </button>
        <div className="mt-6">
          <h3 className="text-base font-semibold mb-2">Preview</h3>
          {previewUrl ? (
            <iframe src={iframeSrc} className="w-full h-96 border rounded-md" title="Calendar Preview" />
          ) : (
            <p className="text-sm text-gray-500">No calendar URL set.</p>
          )}
        </div>
      </section>

      {/* Webhook Secret */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Webhook Secret</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="calendly">Calendly</option>
              <option value="tidycal">TidyCal</option>
              <option value="savvycal">SavvyCal</option>
              <option value="setmore">Setmore</option>
              <option value="oncehub">OnceHub</option>
              <option value="acuity">Acuity</option>
              <option value="google_calendar">Google Calendar</option>
              <option value="outlook">Outlook</option>
              <option value="unknown">Other</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret</label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
              placeholder={hasSecret ? '******** (saved)' : 'Paste provider webhook secret'}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSecret}
            disabled={savingSecret || !secret}
            className="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {savingSecret ? 'Saving…' : 'Save Secret'}
          </button>

          {/* optional test helper */}
          <input
            type="password"
            value={testSecret}
            onChange={(e) => setTestSecret(e.target.value)}
            placeholder="(optional) Test secret"
            className="w-56 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button onClick={handleTestWebhook} className="cursor-pointer border px-4 py-2 rounded-md">
            Send Test Webhook
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Status: {hasSecret ? 'Secret saved' : 'No secret saved'}
        </p>
      </section>

      {/* Contact & Offers */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Contact & Offers</h2>
        {loadingInfo ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={info.contact_email}
                  onChange={(e) => setField('contact_email')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={info.contact_phone}
                  onChange={(e) => setField('contact_phone')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Form URL</label>
                <input type="url" value={info.contact_form_url}
                  onChange={(e) => setField('contact_form_url')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={info.location}
                  onChange={(e) => setField('location')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm" />
              </div>
            </div>

            {([1,2,3,4,5] as const).map((i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offer {i} Title</label>
                  <input type="text"
                    value={info[`offer_${i}_title` as keyof BotInfo] as string}
                    onChange={(e) => setField(`offer_${i}_title` as keyof BotInfo)(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offer {i} URL</label>
                  <input type="url"
                    value={info[`offer_${i}_url` as keyof BotInfo] as string}
                    onChange={(e) => setField(`offer_${i}_url` as keyof BotInfo)(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm" />
                </div>
              </div>
            ))}

            <button onClick={handleSaveInfo} disabled={savingInfo}
              className="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-black transition">
              {savingInfo ? 'Saving…' : 'Save Contact & Offers'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
