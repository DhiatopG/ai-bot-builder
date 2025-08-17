'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'BASIC',
    price: '$19',
    period: '/mo',
    description: 'Lean and lethal.',
    features: [
      '1 AI assistant',
      'Website/blog scraping + manual Q&A',
      'PDF uploads',
      'Lead capture',
      'Tone control',
      'Daily summary email',
      'Full convo history'
    ],
    cta: 'Start Basic',
    popular: false,
    gradient: 'from-blue-600 to-blue-700'
  },
  {
    name: 'PRO',
    price: '$49',
    period: '/mo',
    description: 'Ready to scale.',
    features: [
      '3 assistants',
      'Zapier + Make.com (coming)',
      'Postmark alerts',
      'Priority support',
      'Everything in Basic'
    ],
    cta: 'Start Pro',
    popular: true,
    gradient: 'from-blue-600 to-blue-700'
  },
  {
    name: 'ELITE',
    price: '$99',
    period: '/mo',
    description: 'Full-stack operator mode.',
    features: [
      '10 assistants',
      'WhatsApp API (coming)',
      'NocoDB integration',
      'VIP feature drops',
      'Future analytics dashboard',
      'Everything in Pro'
    ],
    cta: 'Start Elite',
    popular: false,
    gradient: 'from-blue-600 to-blue-700'
  },
  {
    name: 'LIFETIME',
    price: '$69',
    period: 'once',
    description: 'One-time payment. Lifetime power.',
    features: [
      '1 assistant',
      'All Basic features',
      'Free updates',
      'No monthly. Ever.'
    ],
    cta: 'Grab Lifetime',
    popular: false,
    gradient: 'from-blue-600 to-blue-700',
    special: true
  }
]

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white text-blue-900">
      <div className="px-4 pt-6 max-w-7xl mx-auto">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-900">
          ← Back to Homepage
        </Link>
      </div>

      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-blue-900">
            Yo. Here's the Deal.
          </h1>
          <div className="text-xl md:text-2xl leading-relaxed mb-8 text-blue-700">
            <p className="mb-4">You're bleeding leads.</p>
            <p className="mb-4">Your site looks slick, but it doesn't talk.</p>
            <p className="mb-6">In60second fixes that — by chatting, converting, and capturing leads while you're off doing bigger things.</p>
          </div>
          <p className="text-blue-600 mb-8">Try it free. No credit card. No strings.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Start Free Trial
          </button>
        </div>
      </section>

      <section className="py-20 px-4 bg-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-blue-900">
              Choose Your Weapon
            </h2>
            <p className="text-xl text-blue-700">Pick the plan that fits your hustle</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white rounded-2xl p-8 transition-all duration-300 hover:scale-105 ${
                  plan.popular ? 'ring-2 ring-blue-500 shadow-2xl shadow-blue-500/20' : 'hover:shadow-xl'
                } border border-blue-200 hover:border-blue-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    🚀 MOST POPULAR
                  </div>
                )}
                {plan.special && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    ⚠️ LIMITED TIME
                  </div>
                )}

                <div className="text-center mb-8">
                  <div className={`inline-block px-4 py-2 rounded-lg bg-gradient-to-r ${plan.gradient} text-white font-bold text-lg mb-4`}>
                    🔥 {plan.name}
                  </div>
                  <p className="text-blue-700 mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-blue-900">{plan.price}</span>
                    <span className="text-blue-700">/{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <span className="text-blue-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-3 rounded-lg font-bold transition-all duration-300 hover:scale-105 bg-gradient-to-r ${plan.gradient} hover:shadow-lg text-white`}>
                  {plan.cta}
                </button>

                {plan.special && (
                  <p className="text-center text-blue-600 text-sm mt-4 font-semibold">
                    ⚠️ Grab it now or miss it forever. No fake urgency here — we really will pull it.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-blue-900">
            Try it free for 7 days.
          </h2>
          <div className="space-y-2 text-xl text-blue-700 mb-8">
            <p>No card.</p>
            <p>No commitment.</p>
            <p>Just an AI that talks smart, sells harder, and updates you daily.</p>
          </div>
          <div className="flex justify-center mb-8">
            <div className="text-4xl">👇</div>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-lg font-bold text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
          >
            Start Free Trial
          </button>
        </div>
      </section>

      {/* Footer (identical to Home) */}
      <footer className="bg-blue-900 border-t border-blue-800 py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-sm text-blue-300">
          <div className="md:col-span-2">
            <img
              src="/logo.png"
              alt="In60second Logo"
              className="h-12 w-auto mb-4"
            />
            <p>Website assistant that answers common questions, captures leads, and helps your team respond faster.</p>
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
              <li><Link href="/#features" className="hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/#testimonials" className="hover:text-white">Reviews</Link></li>
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
        <div className="text-center text-blue-300 text-sm pt-8 border-top-0 border-t border-blue-800 mt-12">
          © 2025 In60second. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
