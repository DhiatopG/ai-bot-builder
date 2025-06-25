'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const body = {
      name: formData.get('name'),
      email: formData.get('email'),
      message: formData.get('message'),
    }

    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSubmitted(true)
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
        <h1 className="text-4xl md:text-5xl font-bold font-poppins leading-tight mb-6">
          Contact Us
        </h1>
        <p className="text-lg text-gray-700 mb-8 max-w-xl mx-auto">
          Have questions, feedback, or need help? We’re happy to hear from you.
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto text-left space-y-4">
            <input
              type="text"
              name="name"
              required
              placeholder="Your Name"
              className="w-full p-3 border border-gray-300 rounded"
            />
            <input
              type="email"
              name="email"
              required
              placeholder="Your Email"
              className="w-full p-3 border border-gray-300 rounded"
            />
            <textarea
              name="message"
              required
              placeholder="Your Message"
              rows={5}
              className="w-full p-3 border border-gray-300 rounded"
            />
            <button
              type="submit"
              className="bg-[#1F51FF] text-white px-6 py-3 rounded hover:bg-blue-700"
            >
              Send Message
            </button>
          </form>
        ) : (
          <p className="text-green-600 font-medium">✅ Your message has been sent!</p>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-[#003366] text-white text-center py-10">
        <p>© 2025 In60second</p>
        <p className="mt-2">
          <Link href="/" className="underline">Home</Link> |{' '}
          <Link href="/about" className="underline">About</Link> |{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </footer>
    </div>
  )
}
