'use client'

import { useEffect, useState } from 'react'
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

export default function CalendarPage() {
  const { botId } = useParams() as { botId: string }
  const router = useRouter()

  // Calendar (your original)
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

  const setField = (key: keyof BotInfo) => (v: string) =>
    setInfo(prev => ({ ...prev, [key]: v }))

  useEffect(() => {
    if (!botId) return
    ;(async () => {
      // Load calendar (unchanged)
      const { data: botData, error: botErr } = await supabase
        .from('bots')
        .select('calendar_url')
        .eq('id', botId)
        .single()

      if (botErr) {
        console.error(botErr)
      } else if (botData?.calendar_url) {
        setCalendarUrl(botData.calendar_url)
      }

      // Load bot_info via API (bypasses RLS after server ownership check)
      setLoadingInfo(true)
      try {
        const res = await fetch(`/api/bots/${botId}/info`, { cache: 'no-store' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `Failed to load bot_info (${res.status})`)
        }
        const j = await res.json().catch(() => ({}))
        const bi = j.data
        if (bi) {
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
        console.error(e)
        toast.error(e.message || 'Failed to load contact info')
      } finally {
        setLoadingInfo(false)
      }
    })()
  }, [botId])

  // (Optional) RLS debug — safe to remove now that saves go through the API
  useEffect(() => {
    if (!botId) return
    ;(async () => {
      const { data: authData } = await supabase.auth.getUser()
      const { data: botRow } = await supabase
        .from('bots')
        .select('id, user_id')
        .eq('id', botId)
        .single()
      console.log('AUTH USER ID:', authData?.user?.id, 'BOT USER ID:', botRow?.user_id)
    })()
  }, [botId])

  // Save calendar (unchanged)
  const handleSaveCalendar = async () => {
    setSavingCal(true)
    const { error } = await supabase
      .from('bots')
      .update({ calendar_url: calendarUrl })
      .eq('id', botId)
    setSavingCal(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Calendar URL saved!')
  }

  // Save bot_info through API (server verifies ownership + uses admin client)
  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/bots/${botId}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `Failed to save (${res.status})`)
      }
      toast.success('Contact & offers saved!')
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to save')
    } finally {
      setSavingInfo(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="mb-2 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Setup Calendar & Contact/Offers</h1>
        <button
          onClick={() => router.push('/dashboard/calendar')}
          className="text-blue-600 hover:underline cursor-pointer"
        >
          ← Back to list
        </button>
      </div>

      {/* Calendar Section (your original UI) */}
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
            placeholder="https://calendly.com/..."
          />
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
          {calendarUrl ? (
            <iframe
              src={calendarUrl}
              className="w-full h-96 border rounded-md"
              title="Calendar Preview"
            />
          ) : (
            <p className="text-sm text-gray-500">No calendar URL set.</p>
          )}
        </div>
      </section>

      {/* Contact & Offers Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Contact & Offers</h2>

        {loadingInfo ? (
          <p className="text-sm text-gray-500">Loading contact info…</p>
        ) : (
          <>
            {/* Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={info.contact_email}
                  onChange={(e) => setField('contact_email')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                  placeholder="hello@yourdomain.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={info.contact_phone}
                  onChange={(e) => setField('contact_phone')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                  placeholder="+1 555-123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Form URL</label>
                <input
                  type="url"
                  value={info.contact_form_url}
                  onChange={(e) => setField('contact_form_url')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                  placeholder="https://yourdomain.com/contact"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={info.location}
                  onChange={(e) => setField('location')(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                  placeholder="123 Main St, City, Country"
                />
              </div>
            </div>

            {/* Offers 1–5 */}
            {([1,2,3,4,5] as const).map((i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Offer {i} Title
                  </label>
                  <input
                    type="text"
                    value={info[`offer_${i}_title` as keyof BotInfo] as string}
                    onChange={(e) => setField(`offer_${i}_title` as keyof BotInfo)(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                    placeholder={i === 1 ? 'Free Marketing Call' : `Offer ${i} title`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Offer {i} URL
                  </label>
                  <input
                    type="url"
                    value={info[`offer_${i}_url` as keyof BotInfo] as string}
                    onChange={(e) => setField(`offer_${i}_url` as keyof BotInfo)(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                    placeholder="https://yourdomain.com/offer"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={handleSaveInfo}
              disabled={savingInfo}
              className="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-black transition"
            >
              {savingInfo ? 'Saving…' : 'Save Contact & Offers'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
