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
    gradient: 'from-emerald-600 to-emerald-700'
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
    gradient: 'from-purple-600 to-purple-700'
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
    gradient: 'from-orange-600 to-orange-700',
    special: true
  }
]

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="px-4 pt-6 max-w-7xl mx-auto">
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Back to Homepage
        </Link>
      </div>

      <section className="py-20 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Yo. Here's the Deal.
          </h1>
          <div className="text-xl md:text-2xl leading-relaxed mb-8 text-gray-300">
            <p className="mb-4">You're bleeding leads.</p>
            <p className="mb-4">Your site looks slick, but it doesn't talk.</p>
            <p className="mb-6">In60second fixes that — by chatting, converting, and capturing leads while you're off doing bigger things.</p>
          </div>
          <p className="text-gray-400 mb-8">Try it free. No credit card. No strings.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Start Free Trial
          </button>
        </div>
      </section>

      <section className="py-20 px-4 bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Choose Your Weapon
            </h2>
            <p className="text-xl text-gray-400">Pick the plan that fits your hustle</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan, index) => (
              <div key={index} className={`relative bg-gray-800 rounded-2xl p-8 transition-all duration-300 hover:scale-105 ${plan.popular ? 'ring-2 ring-emerald-500 shadow-2xl shadow-emerald-500/20' : 'hover:shadow-xl'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                    🚀 MOST POPULAR
                  </div>
                )}
                {plan.special && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                    ⚠️ LIMITED TIME
                  </div>
                )}

                <div className="text-center mb-8">
                  <div className={`inline-block px-4 py-2 rounded-lg bg-gradient-to-r ${plan.gradient} text-white font-bold text-lg mb-4`}>
                    🔥 {plan.name}
                  </div>
                  <p className="text-gray-400 mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-400">/{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-3 rounded-lg font-bold transition-all duration-300 hover:scale-105 bg-gradient-to-r ${plan.gradient} hover:shadow-lg`}>
                  {plan.cta}
                </button>

                {plan.special && (
                  <p className="text-center text-orange-400 text-sm mt-4 font-semibold">
                    ⚠️ Grab it now or miss it forever. No fake urgency here — we really will pull it.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-emerald-400">
            Try it free for 7 days.
          </h2>
          <div className="space-y-2 text-xl text-gray-300 mb-8">
            <p>No card.</p>
            <p>No commitment.</p>
            <p>Just an AI that talks smart, sells harder, and updates you daily.</p>
          </div>
          <div className="flex justify-center mb-8">
            <div className="text-4xl">👇</div>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white px-12 py-4 rounded-lg font-bold text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
          >
            Start Free Trial
          </button>
        </div>
      </section>
    </div>
  )
}
