'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function CancelByEmailPageInner() {
  const sp = useSearchParams()

  // Prefer ?botId= from the link; else fallback to env (set this per clinic if you want)
  const botId = useMemo(() => {
    return sp.get('botId') || process.env.NEXT_PUBLIC_BOT_ID || ''
  }, [sp])

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Optional: prefill from ?email=
  useEffect(() => {
    const e = sp.get('email')
    if (e) setEmail(e)
  }, [sp])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    setErr(null)

    try {
      if (!botId) throw new Error('Missing botId')
      if (!email.trim()) throw new Error('Enter the email you used when booking')

      const r = await fetch('/api/appointments/cancel-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, email: email.trim().toLowerCase() }),
      })
      const j = await r.json().catch(() => ({}))

      if (!r.ok) {
        // Friendly messages for common cases
        if (r.status === 404 && j?.error === 'no_upcoming_match') {
          throw new Error('No upcoming confirmed appointment found for this email.')
        }
        if (r.status === 429) {
          throw new Error('Too many attempts. Please try again in about a minute.')
        }
        throw new Error(j?.error || 'Cancellation failed')
      }

      setMsg('Your appointment was cancelled ✅')
      setEmail('')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-2">Cancel your appointment</h1>
      <p className="text-sm text-gray-600 mb-4">
        Enter the same email you used when booking. We’ll cancel your soonest upcoming confirmed appointment.
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <button
          disabled={loading}
          className="w-full rounded-lg px-3 py-2 bg-black text-white disabled:opacity-60"
        >
          {loading ? 'Cancelling…' : 'Confirm Cancel'}
        </button>
      </form>

      {msg && <div className="mt-3 text-sm text-green-700">{msg}</div>}
      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

      <div className="mt-6 text-xs text-gray-500">
        Trouble cancelling? <a className="underline" href="/contact">Contact the clinic</a>.
      </div>
    </main>
  )
}

export default function CancelByEmailPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6 text-sm text-gray-500">Loading…</main>}>
      <CancelByEmailPageInner />
    </Suspense>
  )
}
