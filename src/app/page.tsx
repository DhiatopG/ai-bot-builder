// src/app/page.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Shield, Users, Star, Zap } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const stats = [
    { number: "340%", label: "Average Lead Increase" },
    { number: "24/7", label: "Always Available" },
    { number: "60sec", label: "Setup Time" },
    { number: "99.9%", label: "Uptime Guarantee" }
  ]

  const features = [
    { icon: '🤖', title: 'AI Assistant for Your Website', desc: 'Answers FAQs in real time — from your site, your files, or your custom Q&A. No coding. No stress. Feels human. Works like magic.' },
    { icon: '🧠', title: 'Custom Knowledge Base', desc: 'Drop your site links, upload PDFs/TXT, write custom answers — your assistant blends it all.' },
    { icon: '🧪', title: '7-Day Free Trial', desc: 'Full access. No credit card. Just results.' },
    { icon: '📥', title: 'Built-In Lead Collection', desc: 'Assistant asks for name & email naturally inside chat. Auto-saved to your CRM.' },
    { icon: '💬', title: 'Real-Time Chat Interface', desc: 'Smooth, mobile-friendly, feels alive. Supports buttons & logic.' },
    { icon: '📊', title: 'Conversation & Lead Logs', desc: 'Track every interaction. View or export in your dashboard.' },
    { icon: '📆', title: 'AI-Powered Daily Summaries', desc: 'Know what your users ask — every morning. Straight to your dashboard.' },
    { icon: '🛠️', title: 'Drag & Drop Dashboard', desc: 'Build assistants, upload files, customize Q&A — no tech skills needed.' },
    { icon: '🏁', title: 'Launch It and Let It Work', desc: 'Let your assistant sell, serve, and scale while you sleep.' },
  ]

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Marketing Director",
      company: "TechFlow Solutions",
      content: "Our lead conversion increased by 340% in the first month. The AI assistant handles customer questions 24/7 while I focus on strategy.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "Founder",
      company: "GrowthLab Agency",
      content: "Game-changer for our agency. Clients love the instant responses, and we're closing deals even while we sleep.",
      rating: 5
    },
    {
      name: "Emily Watson",
      role: "E-commerce Owner",
      company: "StyleBox Boutique",
      content: "Setup took literally 60 seconds. Now it's like having a sales team that never sleeps. ROI was immediate.",
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-lg z-50 sticky top-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-4">
          <Image src="/logo.png" alt="Logo" width={160} height={40} className="h-8 w-auto object-contain" />
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
            <Link href="#features" className="hover:text-white">Features</Link>
            <Link href="#testimonials" className="hover:text-white">Reviews</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-semibold shadow-lg transition-transform hover:scale-105"
          >
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-4 text-center relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className={`transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            #1 AI Assistant Platform
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text mb-6">
            Turn Your Website into a 24/7 Lead-Closing Machine
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8">
            Busy-as-hell business owners.<br />
            You don't have time to answer the same damn questions over and over.<br />
            Now you don't have to.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
            <button
              onClick={() => router.push('/login')}
              className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 px-8 py-4 rounded-lg text-white font-bold text-lg shadow-xl flex items-center gap-2 transition-transform hover:scale-105"
            >
              🚀 Start Free Trial Now
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="text-sm text-gray-400 flex gap-4">
              <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> No Credit Card</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> 10,000+ Users</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text mb-1">{s.number}</div>
                <div className="text-sm text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text mb-4">Everything You Need to Scale Fast</h2>
          <p className="text-xl text-gray-400 mb-12">From setup to scale, we've got every piece of the puzzle covered</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 hover:shadow-lg transition-all">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 bg-gray-900">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text mb-4">Trusted by Professionals Worldwide</h2>
          <p className="text-xl text-gray-400 mb-12">Real results from real businesses</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-gray-800 border border-gray-700 p-6 rounded-2xl hover:border-gray-600 transition-all">
                <div className="flex gap-1 mb-4">
                  {Array(t.rating).fill(0).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 italic mb-4">"{t.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full flex items-center justify-center font-bold text-white">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-sm text-gray-400">{t.role} at {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gray-800 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-emerald-400 mb-6">Try it free for 7 days.</h2>
        <p className="text-xl text-gray-300 mb-2">No card. No commitment.</p>
        <p className="text-xl text-gray-300 mb-6">Just an AI that talks smart, sells harder, and updates you daily.</p>
        <div className="text-4xl mb-6">👇</div>
        <button
          onClick={() => router.push('/login')}
          className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 px-10 py-4 text-white rounded-lg font-bold text-xl transition-transform hover:scale-105 shadow-xl"
        >
          Start Free Trial
        </button>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-sm text-gray-400">
          <div className="md:col-span-2">
            <Image src="/logo.png" alt="Logo" width={160} height={40} className="h-10 w-auto mb-4" />
            <p>Turn your website into a 24/7 lead-closing machine with AI-powered customer assistance.</p>
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
            </ul>
          </div>
        </div>
        <div className="text-center text-gray-600 text-sm pt-8 border-t border-gray-800 mt-12">© 2025 In60second. All rights reserved.</div>
      </footer>
    </div>
  )
}
