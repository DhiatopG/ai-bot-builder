// src/app/pricing/page.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check } from 'lucide-react'

type Period = { price: number; period: 'mo' | 'yr' | 'once'; note?: string; sku?: string }

type SubscriptionPlan = {
  name: string
  description: string
  features: string[]
  cta: string
  popular: boolean
  gradient: string
  special: false
  monthly: Period
  annual: Period
}

type LifetimePlan = {
  name: string
  description: string
  features: string[]
  cta: string
  popular: boolean
  gradient: string
  special: true
  lifetime: Period
}

type Plan = SubscriptionPlan | LifetimePlan

// If you use a different storefront, change this env or the fallback URL.
const STORE_URL =
  process.env.NEXT_PUBLIC_FASTSPRING_STORE_URL || 'https://in60second.onfastspring.com'

const plans: Plan[] = [
  {
    name: 'BASIC',
    monthly: { price: 69, period: 'mo', sku: 'in60-basic-m' },
    annual: { price: 690, period: 'yr', note: '2 months free', sku: 'in60-basic-a' },
    description: 'Lean and lethal.',
    features: [
      '1 AI assistant',
      'Website/blog scraping + manual Q&A',
      'PDF uploads',
      'Lead capture',
      'Tone control',
      'Daily summary email',
      'Full convo history',
    ],
    cta: 'Start Basic',
    popular: false,
    gradient: 'from-blue-600 to-blue-700',
    special: false,
  },
  {
    name: 'PRO',
    monthly: { price: 99, period: 'mo', sku: 'in60-pro-m' },
    annual: { price: 990, period: 'yr', note: '2 months free', sku: 'in60-pro-a' },
    description: 'Ready to scale.',
    features: [
      '3 assistants',
      'Zapier + Make.com (coming)',
      'Postmark alerts',
      'Priority support',
      'Everything in Basic',
    ],
    cta: 'Start Pro',
    popular: true,
    gradient: 'from-blue-600 to-blue-700',
    special: false,
  },
  {
    name: 'ELITE',
    monthly: { price: 129, period: 'mo', sku: 'in60-elite-m' },
    annual: { price: 1290, period: 'yr', note: '2 months free', sku: 'in60-elite-a' },
    description: 'Full-stack operator mode.',
    features: [
      '10 assistants',
      'WhatsApp API (coming)',
      'NocoDB integration',
      'VIP feature drops',
      'Future analytics dashboard',
      'Everything in Pro',
    ],
    cta: 'Start Elite',
    popular: false,
    gradient: 'from-blue-600 to-blue-700',
    special: false,
  },
  {
    // Lifetime stays static (no toggle)
    name: 'LIFETIME',
    lifetime: {
      price: 399,
      period: 'once',
      note: 'One-time purchase (non-recurring)',
      sku: 'in60-ltd-399',
    },
    description: 'One-time payment. Lifetime power.',
    features: ['1 assistant', 'All Basic features', 'Free updates', 'No monthly. Ever.'],
    cta: 'Grab Lifetime',
    popular: false,
    gradient: 'from-blue-600 to-blue-700',
    special: true,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-white text-blue-900">
      <div className="px-4 pt-6 max-w-7xl mx-auto">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-900">
          ← Back to Homepage
        </Link>
      </div>

      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-blue-900">Yo. Here&apos;s the Deal.</h1>
          <div className="text-xl md:text-2xl leading-relaxed mb-8 text-blue-700">
            <p className="mb-4">You&apos;re bleeding leads.</p>
            <p className="mb-4">Your site looks slick, but it doesn&apos;t talk.</p>
            <p className="mb-6">
              In60second fixes that — by chatting, converting, and capturing leads while you&apos;re off doing bigger
              things.
            </p>
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
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-blue-900">Choose Your Weapon</h2>
            <p className="text-xl text-blue-700">Pick the plan that fits your hustle</p>

            {/* Monthly / Annual toggle */}
            <div className="mt-6 flex justify-center items-center gap-3">
              <span className={!annual ? 'font-semibold text-blue-900' : 'text-blue-700'}>Monthly</span>
              <button
                onClick={() => setAnnual((a) => !a)}
                className="relative inline-flex items-center h-8 w-16 rounded-full border border-blue-300 bg-white"
                aria-label="Toggle billing period"
              >
                <span
                  className={`absolute h-7 w-7 rounded-full bg-blue-600 transition-transform ${
                    annual ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={annual ? 'font-semibold text-blue-900' : 'text-blue-700'}>Annual</span>
              {annual && <span className="text-sm text-blue-700 ml-2">(2 months free)</span>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan, index) => {
              const isLifetime = plan.special === true
              const selected: Period = isLifetime ? plan.lifetime : annual ? plan.annual : plan.monthly
              const checkoutUrl =
                selected.sku && STORE_URL ? `${STORE_URL}/p/${selected.sku}` : ''

              return (
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
                  {isLifetime && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                      ⚠️ LIMITED TIME
                    </div>
                  )}

                  <div className="text-center mb-8">
                    <div
                      className={`inline-block px-4 py-2 rounded-lg bg-gradient-to-r ${plan.gradient} text-white font-bold text-lg mb-4`}
                    >
                      🔥 {plan.name}
                    </div>
                    <p className="text-blue-700 mb-4">{plan.description}</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-blue-900">${selected.price}</span>
                      <span className="text-blue-700">/{selected.period}</span>
                    </div>

                    {!isLifetime && annual && plan.annual.note && (
                      <div className="text-sm text-blue-700 mt-2">Billed annually ({plan.annual.note})</div>
                    )}
                    {!isLifetime && !annual && plan.annual.note && (
                      <div className="text-sm text-blue-700 mt-2">
                        Annual: ${plan.annual.price} ({plan.annual.note})
                      </div>
                    )}
                    {isLifetime && plan.lifetime.note && (
                      <div className="text-sm text-blue-700 mt-2">{plan.lifetime.note}</div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="text-blue-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {checkoutUrl ? (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full block text-center py-3 rounded-lg font-bold transition-all duration-300 hover:scale-105 bg-gradient-to-r ${plan.gradient} hover:shadow-lg text-white`}
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <button
                      onClick={() => router.push('/login')}
                      className={`w-full py-3 rounded-lg font-bold transition-all duration-300 hover:scale-105 bg-gradient-to-r ${plan.gradient} hover:shadow-lg text-white`}
                    >
                      {plan.cta}
                    </button>
                  )}

                  {isLifetime && (
                    <p className="text-center text-blue-600 text-sm mt-4 font-semibold">
                      ⚠️ Grab it now or miss it forever. No fake urgency here — we really will pull it.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Tax note */}
          <p className="mt-6 text-center text-sm text-blue-600">
            Prices exclude VAT/GST. Taxes and currency are calculated at checkout.
          </p>
          {/* MoR note */}
          <p className="mt-2 text-center text-sm text-blue-600">
            Payments are processed by FastSpring (authorized reseller & Merchant of Record).
          </p>
        </div>
      </section>

      <section className="py-20 px-4 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-blue-900">Try it free for 7 days.</h2>
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
        {/* …footer unchanged… */}
      </footer>
    </div>
  )
}
