'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'
import toast from 'react-hot-toast'
import { useBots } from '@/hooks/useBots'

export default function BotNocoDBSettingsPage() {
  const { botId } = useParams()
  const router = useRouter()

  const [userId, setUserId] = useState('')
  const { bots } = useBots(userId)

  const [nocodbApiUrl, setNocodbApiUrl] = useState('')
  const [nocodbApiKey, setNocodbApiKey] = useState('')
  const [nocodbTable, setNocodbTable] = useState('')

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (user) {
        setUserId(user.id)
      }
    }

    loadSession()
  }, [])

  useEffect(() => {
    if (!botId || !bots.length) return

    const currentBot = bots.find((b) => b.id === botId)
    if (currentBot) {
      setNocodbApiUrl(currentBot.nocodb_api_url || '')
      setNocodbApiKey(currentBot.nocodb_api_key || '')
      setNocodbTable(currentBot.nocodb_table || '')
    } else {
      toast.error('❌ Bot not found')
    }
  }, [botId, bots])

  const handleSave = async () => {
    const res = await fetch(`/api/bots/${botId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nocodb_api_url: nocodbApiUrl,
        nocodb_api_key: nocodbApiKey,
        nocodb_table: nocodbTable,
      }),
    })

    if (res.ok) {
      toast.success('✅ NocoDB settings saved')
    } else {
      toast.error('❌ Failed to save settings')
    }
  }

  if (!botId || !bots.length) {
    return <div className="p-6 text-center">Loading...</div>
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">NocoDB Settings</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">NocoDB API URL</label>
          <input
            type="text"
            value={nocodbApiUrl}
            onChange={(e) => setNocodbApiUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">NocoDB API Key</label>
          <input
            type="text"
            value={nocodbApiKey}
            onChange={(e) => setNocodbApiKey(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">NocoDB Table Name</label>
          <input
            type="text"
            value={nocodbTable}
            onChange={(e) => setNocodbTable(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="border border-gray-400 text-gray-700 px-4 py-2 rounded hover:bg-gray-100"
        >
          Back
        </button>
      </div>
    </div>
  )
}
