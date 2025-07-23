'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/browser'

export default function SettingsPage() {
  const [bots, setBots] = useState<any[]>([])

  useEffect(() => {
    const fetchUserAndBots = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data?.session?.user

      if (user) {
        const { data: botsData } = await supabase.from('bots').select('*').eq('user_id', user.id)
        setBots(botsData || [])
      }
    }

    fetchUserAndBots()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Integrations</h1>
      <p className="text-gray-600 mb-6">Here you can manage your integrations like NocoDB, Make, and Zapier.</p>

      <ul className="space-y-4">
        {bots.map((bot) => (
          <li key={bot.id} className="border p-4 rounded bg-white shadow">
            <p className="font-medium">Bot Name: {bot.name}</p>
            <p className="text-sm text-gray-500">NocoDB Table: {bot.nocodb_table || 'Not set'}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
