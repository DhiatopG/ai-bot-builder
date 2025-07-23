'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/browser'

export default function ZapierBotListPage() {
  const [bots, setBots] = useState<any[]>([])

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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Choose a bot to manage Zapier integration</h1>
      <div className="grid gap-4">
        {bots.map((bot) => (
          <div key={bot.id} className="border rounded p-4 shadow">
            <h2 className="text-lg font-semibold mb-2">{bot.bot_name}</h2>
            <Link href={`/dashboard/integrations/zapier/${bot.id}`}>
              <button className="bg-orange-500 text-white px-4 py-2 rounded hover:opacity-90">
                Manage
              </button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
