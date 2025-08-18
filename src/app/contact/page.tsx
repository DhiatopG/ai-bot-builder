// src/app/contact/page.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    // Simple honeypot: bots will fill hidden "website"
    if ((formData.get('website') as string)?.trim()) {
      setSubmitted(true)
      return
    }

    const body = {
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      message: String(formData.get('message') || ''),
    }

    if (!body.name || !body.email || !body.message) {
      setError('Please complete all fields.')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Request failed')
      setSubmitted(true)
      form.reset()
    } catch {
      setError('Something went wrong. Please email support@in60second.net.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Logo */}
      <div className="absolute top-6 left-6">
        <Image
          src="/logo.png"
          alt="In60second Logo"
          width={160}
          height={50}
          style={{ width: 'auto', height: 'auto', maxWidth: '120px' }}
        />
      </div>

      <section className="text-center text-[#003366] py-24 px-6 bg-white">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          Contact & Support
        </h1>

        {/* MoR-friendly support block */}
        <div className="max-w-xl mx-auto text-gray-700 mb-8">
          <p className="mb-2">
            Support: <a href="mailto:support@in60second.net" className="text-blue-700 underline">support@in60second.net</a>
            {' '}— we reply within <strong>1 business day</strong> (Mon–Fri).
          </p>
          <p className="text-sm">
            For billing questions or cancellations, see our{' '}
            <Link href="/refunds" className="underline">Refund Policy</Link>.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto text-left space-y-4">
            {/* Honeypot field (hidden) */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <label className="block">
              <span className="sr-only">Your Name</span>
              <input
                type="text"
                name="name"
                required
                placeholder="Your Name"
                className="w-full p-3 border border-gray-300 rounded"
              />
            </label>

            <label className="block">
              <span className="sr-only">Your Email</span>
              <input
                type="email"
                name="email"
                required
                placeholder="Your Email"
                className="w-full p-3 border border-gray-300 rounded"
              />
            </label>

            <label className="block">
              <span className="sr-only">Your Message</span>
              <textarea
                name="message"
                required
                placeholder="Your Message"
                rows={5}
                className="w-full p-3 border border-gray-300 rounded"
              />
            </label>

            {error && (
              <p role="alert" className="text-red-600 text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-[#1F51FF] text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        ) : (
          <p className="text-green-600 font-medium" role="status">
            ✅ Your message has been sent!
          </p>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-[#003366] text-white text-center py-10">
        <p>© 2025 In60second</p>
        <p className="mt-2">
          <Link href="/" className="underline">Home</Link> |{' '}
          <Link href="/about" className="underline">About</Link> |{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link> |{' '}
          <Link href="/terms" className="underline">Terms of Service</Link> |{' '}
          <Link href="/refunds" className="underline">Refund Policy</Link>
        </p>
      </footer>
    </div>
  )
}
