'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/client'
import toast from 'react-hot-toast'

interface Bot {
  id: string
  bot_name: string
  description: string
  urls: string
  nocodb_api_url?: string | null
  nocodb_api_key?: string | null
  nocodb_table?: string | null
  calendar_url?: string | null
  document_url?: string | null
}

export function useBots(userId: string | null) {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchBots = async () => {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('user_id', userId)

      if (error) {
        toast.error('❌ Failed to fetch bots')
        setBots([])
      } else {
        setBots(data || [])
      }

      setLoading(false)
    }

    fetchBots()
  }, [userId])

  return { bots, loading, setBots }
}
