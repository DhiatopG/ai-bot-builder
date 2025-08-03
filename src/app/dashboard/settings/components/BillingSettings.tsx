'use client'

import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { supabase } from '@/lib/client'

export default function BillingSettings() {
  const [plan, setPlan] = useState('Free')
  const [usage, setUsage] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBillingInfo = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from('users')
        .select('plan, usage')
        .eq('email', user.email)
        .maybeSingle()

      if (data) {
        setPlan(data.plan || 'Free')
        setUsage(data.usage || 0)
      }

      setLoading(false)
    }

    fetchBillingInfo()
  }, [])

  const handleUpgrade = () => {
    window.location.href = '/pricing' // or Stripe checkout URL
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Billing</h3>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Current Plan */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Current Plan</h4>
          <p className="text-lg font-semibold text-gray-900">{loading ? 'Loading...' : plan}</p>
        </div>

        {/* Usage */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Usage</h4>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-3 transition-all"
              style={{ width: `${Math.min(usage, 100)}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">{usage}% of quota used</p>
        </div>

        {/* Upgrade */}
        <div className="flex justify-end">
          <button
            onClick={handleUpgrade}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Upgrade Plan
          </button>
        </div>

        {/* Billing History Placeholder */}
        <div className="mt-6 border-t pt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Billing History</h4>
          <p className="text-sm text-gray-500">Billing history integration coming soon.</p>
        </div>
      </div>
    </div>
  )
}
