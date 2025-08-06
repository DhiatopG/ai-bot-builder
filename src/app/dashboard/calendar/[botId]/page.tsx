'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'
import toast from 'react-hot-toast'

export default function CalendarPage() {
  const { botId } = useParams()
  const router = useRouter()
  const [calendarUrl, setCalendarUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchCalendar = async () => {
      const { data } = await supabase
        .from('bots')
        .select('calendar_url')
        .eq('id', botId)
        .single()

      if (data?.calendar_url) setCalendarUrl(data.calendar_url)
    }

    if (botId) fetchCalendar()
  }, [botId])

  const handleSave = async () => {
    setLoading(true)
    await supabase
      .from('bots')
      .update({ calendar_url: calendarUrl })
      .eq('id', botId)
    setLoading(false)
    toast.success('Calendar URL saved!')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Setup Calendar</h1>
        <button
          onClick={() => router.push('/dashboard/calendar')}
          className="text-blue-600 hover:underline cursor-pointer"
        >
          ← Back to list
        </button>
      </div>

      <div className="mb-6">
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
        onClick={handleSave}
        disabled={loading}
        className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
      >
        {loading ? 'Saving...' : 'Save Calendar'}
      </button>

      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-2">Preview</h2>
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
    </div>
  )
}
