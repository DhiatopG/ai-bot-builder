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
    { number: "24/7", label: "Availability" },
    { number: "Setup", label: "in minutes (typical)" },
    { number: "SSL", label: "Secure by Default" },
    { number: "Export", label: "Your Data Anytime" }
  ]

  const features = [
    { icon: '🤖', title: 'AI Assistant for Your Website', desc: 'Answers FAQs in real time — from your site, your files, or your custom Q&A. No coding. No stress.' },
    { icon: '🧠', title: 'Custom Knowledge Base', desc: 'Drop your site links, upload PDFs/TXT, write custom answers — your assistant blends it all.' },
    { icon: '🧪', title: '7-Day Free Trial', desc: 'Full access. No credit card. Cancel anytime during the trial.' },
    { icon: '📥', title: 'Built-In Lead Collection', desc: 'Assistant asks for name & email naturally inside chat. Auto-saved to your CRM.' },
    { icon: '💬', title: 'Real-Time Chat Interface', desc: 'Smooth, mobile-friendly, feels alive. Supports buttons & logic.' },
    { icon: '📊', title: 'Conversation & Lead Logs', desc: 'Track every interaction. View or export in your dashboard.' },
    { icon: '📆', title: 'Daily Summaries', desc: 'See what users asked, every morning, right in your dashboard.' },
    { icon: '🛠️', title: 'Drag & Drop Dashboard', desc: 'Build assistants, upload files, customize Q&A — no tech skills needed.' },
    { icon: '🏁', title: 'Launch It and Let It Work', desc: 'Your assistant helps prospects 24/7 and hands off to your team when needed.' },
  ]

  const testimonials = [
    {
      name: "Dr. Laura Patel, DDS",
      role: "Owner",
      company: "SmileBright Family Dental (Austin, TX)",
      content: "After-hours inquiries now get captured with name and phone. We book more consults without adding front-desk hours.",
      rating: 5
    },
    {
      name: "Dr. Michael Nguyen, DMD",
      role: "Clinic Owner",
      company: "Lakeside Family Dentistry (Portland, OR)",
      content: "It answers new-patient FAQs—insurance, cleanings, whitening—and offers the booking link when patients ask. Setup took minutes.",
      rating: 5
    },
    {
      name: "Mia Thompson",
      role: "Practice Manager",
      company: "GreenOak Dental (UK)",
      content: "Patients get quick answers while calls stay clear for treatments. The morning summaries and conversation logs are super helpful.",
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-white text-blue-900">
      {/* Navbar */}
      <nav className="border-b border-blue-200 bg-white/80 backdrop-blur-lg z-50 sticky top-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-4">
          {/* CHANGED: bigger logo */}
          <Image
            src="/logo.png"
            alt="In60second Logo"
            width={180}
            height={60}
            className="h-10 md:h-12 w-auto object-contain"
            priority
          />
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-blue-600">
            <Link href="#features" className="hover:text-blue-900">Features</Link>
            <Link href="#testimonials" className="hover:text-blue-900">Reviews</Link>
            <Link href="/pricing" className="hover:text-blue-900">Pricing</Link>
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
        <div className={`transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            AI Assistant Platform
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-blue-900 mb-6">
            Turn your website into a 24/7 AI assistant for prospects & customers
          </h1>
          <p className="text-lg md:text-xl text-blue-700 mb-8">
            Answer common questions instantly, capture leads automatically, and hand off complex chats to your team.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
            <button
              onClick={() => router.push('/login')}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg text-white font-bold text-lg shadow-xl flex items-center gap-2 transition-transform hover:scale-105"
            >
              🚀 Start Free Trial Now
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="text-sm text-blue-600 flex gap-4">
              <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> No Credit Card</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Trusted by teams</span>
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
          <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-4">Everything You Need to Scale Fast</h2>
          <p className="text-xl text-blue-700 mb-12">From setup to scale, we’ve got every piece of the puzzle covered.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-white border border-blue-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all">
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
          <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-4">Trusted by Professionals</h2>
          <p className="text-xl text-blue-700 mb-12">Real customer feedback from everyday use</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-blue-50 border border-blue-200 p-6 rounded-2xl hover:border-blue-300 transition-all">
                <div className="flex gap-1 mb-4">
                  {Array(t.rating).fill(0).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-blue-500 fill-current" />
                  ))}
                </div>
                <p className="text-blue-800 italic mb-4">"{t.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-blue-900">
                      {t.name} <span className="text-blue-700 text-xs align-middle">• Verified customer</span>
                    </div>
                    <div className="text-sm text-blue-700">{t.role} at {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-blue-600">Testimonials reflect individual experiences; results vary.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-blue-50 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-6">Try it free for 7 days.</h2>
        <p className="text-xl text-blue-700 mb-2">No card. No commitment.</p>
        <p className="text-xl text-blue-700 mb-6">Cancel anytime during the trial.</p>
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
            {/* CHANGED: bigger logo */}
            <Image
              src="/logo.png"
              alt="In60second Logo"
              width={180}
              height={60}
              className="h-12 w-auto mb-4"
            />
            <p>Website assistant that answers common questions, captures leads, and helps your team respond faster.</p>

            {/* Company identity (filled with your agent address) */}
            <div className="mt-4 space-y-1">
              <div>Legal entity: <span className="text-white">In60Second LLC</span></div>
              <div>Mailing Address: <span className="text-white">1001 S MAIN ST, STE 600, KALISPELL, MT 59901-5635, USA</span></div>
              <div>Registered Agent: <span className="text-white">Northwest Registered Agent LLC</span></div>
              <div>Agent Address: <span className="text-white">1001 S MAIN ST, STE 600, Kalispell, MT 59901, USA</span></div>
              <div>Support: <span className="text-white">support@in60second.net</span></div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link href="#features" className="hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="#testimonials" className="hover:text-white">Reviews</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-white">About</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="/refunds" className="hover:text-white">Refund Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-white">Cookie Notice</Link></li>
            </ul>
          </div>
        </div>
        <div className="text-center text-blue-300 text-sm pt-8 border-t border-blue-800 mt-12">© 2025 In60second. All rights reserved.</div>
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
