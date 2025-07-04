'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative">
      {/* Logo Top Left */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50">
        <Image
          src="/logo.png"
          alt="In60second Logo"
          width={180}
          height={60}
          className="h-10 sm:h-12 w-auto object-contain"
          priority
        />
      </div>

      <section className="text-center text-[#003366] py-24 px-6 bg-white">
        <h1 className="text-4xl md:text-5xl font-bold font-poppins leading-tight mb-6">
          Turn Your Website into a<br />24/7 Lead-Closing Machine
        </h1>
        <p className="text-lg font-medium text-gray-700 mb-3">
          Busy-as-hell business owners.
        </p>
        <p className="text-lg text-gray-600 mb-8">
          You don’t have time to answer the same damn questions over and over.<br />
          Now you don’t have to.
        </p>
        <Link
          href="/login"
          className="bg-[#1F51FF] hover:bg-blue-700 text-white font-semibold text-lg py-3 px-6 rounded-lg transition inline-block"
        >
          🚀 Start Free Trial Now
        </Link>
      </section>

      <section className="bg-gray-100 py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: '🤖',
              title: 'AI Assistant for Your Website',
              desc: 'Answers FAQs in real time — from your site, your files, or your custom Q&A. No coding. No stress. Feels human. Works like magic.',
            },
            {
              icon: '🧠',
              title: 'Custom Knowledge Base',
              desc: 'Drop your site links, upload PDFs/TXT, write custom answers — your assistant blends it all.',
            },
            {
              icon: '🧪',
              title: '7-Day Free Trial',
              desc: 'Full access. No credit card. Just results.',
            },
            {
              icon: '📥',
              title: 'Built-In Lead Collection',
              desc: 'Assistant asks for name & email naturally inside chat. Auto-saved to your CRM (Airtable, NocoDB...)',
            },
            {
              icon: '💬',
              title: 'Real-Time Chat Interface',
              desc: 'Smooth, mobile-friendly, feels alive. Supports buttons & logic.',
            },
            {
              icon: '📊',
              title: 'Conversation & Lead Logs',
              desc: 'Track every interaction. View or export in your dashboard.',
            },
            {
              icon: '📆',
              title: 'AI-Powered Daily Summaries',
              desc: 'Know what your users ask — every morning. Straight to your dashboard.',
            },
            {
              icon: '🛠️',
              title: 'Drag & Drop Dashboard',
              desc: 'Build assistants, upload files, customize Q&A — no tech skills needed.',
            },
            {
              icon: '🏁',
              title: 'Launch It and Let It Work',
              desc: 'Let your assistant sell, serve, and scale while you sleep.',
            },
          ].map(({ icon, title, desc }, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-2">{icon} {title}</h3>
              <p className="text-sm text-gray-700">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="text-center py-16 bg-white">
        <h2 className="text-3xl font-semibold text-[#003366] font-poppins">
          Trusted by Professionals Worldwide
        </h2>
      </section>

      <section className="text-center py-16 bg-white">
        <h2 className="text-3xl font-semibold text-[#003366] font-poppins mb-6">
          Launch Your Assistant in In60second
        </h2>
        <Link
          href="/login"
          className="bg-[#00CFFF] hover:bg-blue-500 text-white font-semibold text-lg py-3 px-6 rounded-lg transition"
        >
          Launch Your Assistant Now — Free Trial
        </Link>
      </section>

      <footer className="bg-[#003366] text-white text-center py-10">
        <p>© 2025 In60second</p>
        <p className="mt-2">
          <Link href="/about" className="underline">About</Link> |{' '}
          <Link href="/contact" className="underline">Contact</Link> |{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link> |{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  );
}