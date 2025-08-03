'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

type WorkingHours = Record<
  string,
  {
    start: string
    end: string
    closed: boolean
  }
>

export default function BotHoursPage() {
  const { botId } = useParams()
  const router = useRouter()

  const [hours, setHours] = useState<WorkingHours>(() =>
    days.reduce((acc, day) => {
      acc[day] = {
        start: '',
        end: '',
        closed: day === 'Saturday' || day === 'Sunday',
      }
      return acc
    }, {} as WorkingHours)
  )

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHours = async () => {
      try {
        const res = await fetch(`/api/bots/${botId}/hours`)
        const result = await res.json()

        if (result?.data) {
          const formatted: WorkingHours = days.reduce((acc, day) => {
            acc[day] = {
              start: '',
              end: '',
              closed: day === 'Saturday' || day === 'Sunday',
            }
            return acc
          }, {} as WorkingHours)
          result.data.forEach((entry: any) => {
            formatted[entry.day] = {
              start: entry.start || '',
              end: entry.end || '',
              closed: entry.closed || false,
            }
          })
          setHours(formatted)
        }
      } catch (err) {
        console.error('Error loading working hours:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHours()
  }, [botId])

  const handleChange = (day: string, field: 'start' | 'end', value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }))
  }

  const toggleClosed = (day: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        closed: !prev[day].closed,
        start: '',
        end: '',
      },
    }))
  }

  const handleSubmit = async () => {
    try {
      const res = await fetch(`/api/bots/${botId}/hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(hours).map(([day, val]) => [
              day,
              {
                start: val.start || '',
                end: val.end || '',
                closed: val.closed ?? false,
              },
            ])
          )
        ),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Unknown error')
      }

      toast.success('Working hours saved successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save working hours.')
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="relative bg-white min-h-screen">
      {/* X Back Button */}
      <button
        onClick={() => router.back()}
        className="fixed top-6 right-6 text-gray-500 hover:text-gray-700 transition z-50 cursor-pointer"
        aria-label="Go back"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Set Working Hours</h1>

        <div className="space-y-4">
          {days.map((day) => (
            <div key={day} className="flex items-center gap-4">
              <label className="w-24 font-medium">{day}</label>

              {hours[day].closed ? (
                <span className="text-gray-500 italic">Closed</span>
              ) : (
                <>
                  <input
                    type="time"
                    className="border rounded px-2 py-1"
                    value={hours[day].start}
                    onChange={(e) => handleChange(day, 'start', e.target.value)}
                  />
                  <span>-</span>
                  <input
                    type="time"
                    className="border rounded px-2 py-1"
                    value={hours[day].end}
                    onChange={(e) => handleChange(day, 'end', e.target.value)}
                  />
                </>
              )}

              <button
                onClick={() => toggleClosed(day)}
                className="ml-auto text-sm text-blue-600 underline cursor-pointer"
              >
                {hours[day].closed ? 'Set Open' : 'Mark Closed'}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          className="mt-8 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Hours
        </button>
      </div>
    </div>
  )
}