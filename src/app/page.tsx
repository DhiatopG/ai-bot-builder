// src/app/page.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Shield, Users, Star, Zap } from 'lucide-react'
import Script from 'next/script' // <-- added

export default function HomePage() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const stats = [
    { number: '60s', label: 'Average Response Time' },
    { number: 'HIPAA', label: 'Ready' },
    { number: 'Insurance', label: 'FAQ Trained' },
    { number: '2-Way', label: 'Booking Hand-Off' },
  ]

  const features = [
    {
      icon: '🦷',
      title: 'Insurance FAQs, Handled',
      desc: 'Verifies coverage basics and explains PPO vs HMO in plain English, then routes complex questions to staff.',
    },
    {
      icon: '📅',
      title: 'Booking Hand-Off',
      desc: 'Offers your online booking link or collects name, phone, and reason for visit, then sends it to your inbox or CRM.',
    },
    {
      icon: '🧾',
      title: 'New Patient Intake',
      desc: 'Collects contact details and visit reason. Auto-saves to your lead log so your team can follow up fast.',
    },
    {
      icon: '✨',
      title: 'Treatment Explainers',
      desc: 'Answers questions about cleanings, whitening, implants, veneers, Invisalign, and more using your content.',
    },
    {
      icon: '🚨',
      title: 'Emergency Triage',
      desc: 'Screens for emergencies and shows your urgent-care instructions or after-hours line.',
    },
    {
      icon: '🧠',
      title: 'Custom Knowledge Base',
      desc: 'Train it with your services, pricing notes, PDFs, and FAQs so it speaks like your practice.',
    },
    {
      icon: '📈',
      title: 'Conversation & Lead Logs',
      desc: 'See what patients ask and who left their info. Export anytime.',
    },
    {
      icon: '🔧',
      title: 'No IT Needed',
      desc: 'Paste one embed on your site, update everything from a simple dashboard.',
    },
    {
      icon: '🏁',
      title: '7-Day Free Trial',
      desc: 'Full access. No card. Cancel anytime during the trial.',
    },
  ]

  const testimonials = [
    {
      name: 'Dr. Alyssa Romero, DDS',
      role: 'Owner',
      company: 'Riverbend Family Dentistry, OH',
      content:
        'After-hours calls dropped, but new-patient inquiries doubled because the bot captured name and phone. We booked 14 extra consults last month.',
      rating: 5,
    },
    {
      name: 'Dr. Jamal Reed, DMD',
      role: 'Clinic Owner',
      company: 'Cedar Park Dental, TX',
      content:
        'It handles insurance and whitening questions, then offers our booking link. Setup took minutes.',
      rating: 5,
    },
    {
      name: 'Sofia Marino',
      role: 'Practice Manager',
      company: 'Harborview Dental, MA',
      content:
        'Morning summaries tell us exactly what patients want so we adjust promos. The lead log makes follow-ups simple.',
      rating: 5,
    },
  ]

  return (
    <div className="min-h-screen bg-white text-blue-900">
      {/* Navbar */}
      <nav className="border-b border-blue-200 bg-white/80 backdrop-blur-lg z-50 sticky top-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-4">
          {/* bigger logo */}
          <Image
            src="/logo.png"
            alt="In60second Logo"
            width={180}
            height={60}
            className="h-10 md:h-12 w-auto object-contain"
            priority
          />
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-blue-600">
            <Link href="#features" className="hover:text-blue-900">
              Dental Features
            </Link>
            <Link href="#testimonials" className="hover:text-blue-900">
              Practice Results
            </Link>
            <Link href="/pricing" className="hover:text-blue-900">
              Pricing
            </Link>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-semibold shadow-lg transition-transform hover:scale-105"
          >
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-4 text-center relative bg-white">
        <div
          className={`transition-all duration-1000 transform ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            Dental AI Front Desk
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-blue-900 mb-6">
            Turn your dental website into a 24/7 front desk that books patients
          </h1>
          <p className="text-lg md:text-xl text-blue-700 mb-8">
            Answer insurance questions, pre-qualify new-patient leads, and hand off to your front
            desk without adding front-desk hours.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
            <button
              onClick={() => router.push('/login')}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg text-white font-bold text-lg shadow-xl flex items-center gap-2 transition-transform hover:scale-105"
            >
              🚀 Start Free Trial
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="text-sm text-blue-600 flex gap-4">
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4" /> No Credit Card
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" /> Used by solo practices and DSOs
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">{s.number}</div>
                <div className="text-sm text-blue-700">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-blue-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-4">
            Built for Busy Dental Practices
          </h2>
          <p className="text-xl text-blue-700 mb-12">
            From insurance questions to whitening consults, everything runs smoother.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white border border-blue-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold text-blue-900 mb-2">{f.title}</h3>
                <p className="text-blue-700 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-4">
            Trusted by Dental Professionals
          </h2>
          <p className="text-xl text-blue-700 mb-12">Real outcomes from real practices</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-blue-50 border border-blue-200 p-6 rounded-2xl hover:border-blue-300 transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {Array(t.rating)
                    .fill(0)
                    .map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-blue-500 fill-current" />
                    ))}
                </div>
                <p className="text-blue-800 italic mb-4">"{t.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white">
                    {t.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-blue-900">
                      {t.name}{' '}
                      <span className="text-blue-700 text-xs align-middle">• Verified customer</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      {t.role} at {t.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-blue-600">
            Testimonials reflect individual experiences; results vary.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-blue-50 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-6">
          Try it free for 7 days.
        </h2>
        <p className="text-xl text-blue-700 mb-2">No card. No commitment.</p>
        <p className="text-xl text-blue-700 mb-6">Live on your site in minutes.</p>
        <div className="text-4xl mb-6">👇</div>
        <button
          onClick={() => router.push('/login')}
          className="bg-blue-600 hover:bg-blue-700 px-10 py-4 text-white rounded-lg font-bold text-xl transition-transform hover:scale-105 shadow-xl"
        >
          Start Free Trial
        </button>
      </section>

      {/* Footer */}
      <footer className="bg-blue-900 border-t border-blue-800 py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-sm text-blue-300">
          <div className="md:col-span-2">
            <Image
              src="/logo.png"
              alt="In60second Logo"
              width={180}
              height={60}
              className="h-12 w-auto mb-4"
            />
            <p>
              Dental website assistant that answers insurance and treatment questions, captures
              new-patient leads, and helps your team respond faster.
            </p>

            {/* Company identity */}
            <div className="mt-4 space-y-1">
              <div>
                Legal entity: <span className="text-white">In60Second LLC</span>
              </div>
              <div>
                Mailing Address:{' '}
                <span className="text-white">
                  1001 S MAIN ST, STE 600, KALISPELL, MT 59901-5635, USA
                </span>
              </div>
              <div>
                Registered Agent:{' '}
                <span className="text-white">Northwest Registered Agent LLC</span>
              </div>
              <div>
                Agent Address:{' '}
                <span className="text-white">1001 S MAIN ST, STE 600, Kalispell, MT 59901, USA</span>
              </div>
              <div>
                Support: <span className="text-white">support@in60second.net</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#features" className="hover:text-white">
                  Dental Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#testimonials" className="hover:text-white">
                  Practice Results
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="hover:text-white">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refunds" className="hover:text-white">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-white">
                  Cookie Notice
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="text-center text-blue-300 text-sm pt-8 border-t border-blue-800 mt-12">
          © 2025 In60second. All rights reserved.
        </div>
      </footer>

      {/* In60second embed on Home only */}
      <Script
        id="in60-embed"
        src="/embed.js"
        strategy="afterInteractive"
        data-bot-id="40e696d6-d1ab-48dc-b5e9-d356d96bbe7a"
        data-position="bottom-right"
      />
    </div>
  )
}
