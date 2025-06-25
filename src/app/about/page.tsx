'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="relative">
      {/* Logo Top Left */}
      <div className="absolute top-6 left-6">
        <Image
          src="/logo.png"
          alt="In60second Logo"
          width={160}
          height={50}
          style={{ width: 'auto', height: 'auto', maxWidth: '120px' }}
        />
      </div>

      {/* Hero Section */}
      <section className="text-center text-[#003366] py-24 px-6 bg-white">
        <h1 className="text-4xl md:text-5xl font-bold font-poppins leading-tight mb-6">
          About In60second
        </h1>
        <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto">
          In60second is built for busy professionals who don’t have time to answer the same questions every day. 
          Whether you’re a doctor, lawyer, coach, or run a service business, our AI assistant saves you hours each week — 
          and helps you convert more leads while you sleep.
        </p>
        <p className="text-md text-gray-600 mb-6 max-w-3xl mx-auto">
          Our mission is simple: make your website smarter, your clients happier, and your life easier.
        </p>
        <Link
          href="/login"
          className="bg-[#1F51FF] hover:bg-blue-700 text-white font-semibold text-lg py-3 px-6 rounded-lg transition inline-block"
        >
          Start Your Free Trial
        </Link>
      </section>

      {/* Values Section */}
      <section className="bg-gray-100 py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: '🚀',
              title: 'Speed & Simplicity',
              desc: 'Launch in minutes. No tech skills needed. Start closing leads instantly.',
            },
            {
              icon: '🤝',
              title: 'Human-First AI',
              desc: 'Feels natural, sounds smart. Your assistant talks like a real human.',
            },
            {
              icon: '📈',
              title: 'Results You Can See',
              desc: 'Track every chat, lead, and question. Know exactly what’s working.',
            },
          ].map(({ icon, title, desc }, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-2">{icon} {title}</h3>
              <p className="text-sm text-gray-700">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#003366] text-white text-center py-10">
        <p>© 2025 In60second</p>
        <p className="mt-2">
          <Link href="/" className="underline">Home</Link> |{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link> |{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  )
}
