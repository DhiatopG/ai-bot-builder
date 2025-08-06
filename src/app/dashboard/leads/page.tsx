'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/browser'
import { Bot, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LeadsBotSelectorPage() {
  const [bots, setBots] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    const fetchBots = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) return

      const { data } = await supabase.from('bots').select('*').eq('user_id', user.id)
      setBots(data || [])
    }

    fetchBots()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <button
          onClick={() => router.back()}
          className="fixed top-6 right-6 text-gray-500 hover:text-gray-700 transition cursor-pointer z-50"
          aria-label="Go back"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Choose a bot to view captured leads
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Select from your active bots to manage and view all captured leads for each one.
            </p>
          </div>
        </div>
      </div>

      {/* Bot Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`grid gap-6 ${
          bots.length === 1
            ? 'grid-cols-1 max-w-md mx-auto'
            : bots.length === 2
            ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 hover:border-blue-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">{bot.bot_name}</h3>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {bot.description || 'No description available.'}
              </p>

              <Link href={`/dashboard/leads/${bot.id}`}>
                <button
                  className="w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Manage Leads
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
