'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'
import toast from 'react-hot-toast'

export default function AirtableIntegrationPage() {
  const { botId } = useParams()
  const [apiKey, setApiKey] = useState('')
  const [baseId, setBaseId] = useState('')
  const [tableName, setTableName] = useState('')
  const [loading, setLoading] = useState(false)
  const [botName, setBotName] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) return

      const { data: botData } = await supabase
        .from('bots')
        .select('bot_name')
        .eq('id', botId)
        .single()

      if (botData) {
        setBotName(botData.bot_name)
      }

      const { data } = await supabase
        .from('integrations_airtable')
        .select('*')
        .eq('user_id', user.id)
        .eq('bot_id', botId)
        .single()

      if (data) {
        setApiKey(data.api_key || '')
        setBaseId(data.base_id || '')
        setTableName(data.table_name || '')
      }
    }

    loadData()
  }, [botId])

  const handleSave = async () => {
    if (!apiKey || !baseId || !tableName) {
      toast.error('All fields are required.')
      return
    }

    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user
    if (!user) return

    const { error } = await supabase
      .from('integrations_airtable')
      .upsert({
        user_id: user.id,
        bot_id: botId,
        api_key: apiKey,
        base_id: baseId,
        table_name: tableName,
      })

    setLoading(false)
    if (error) {
      toast.error('Failed to save Airtable integration.')
    } else {
      toast.success('Airtable integration saved!')
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">
        Manage Airtable for Bot: {botName || '...'}
      </h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">API Key</label>
        <input
          type="text"
          className="w-full border px-3 py-2 rounded"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Base ID</label>
        <input
          type="text"
          className="w-full border px-3 py-2 rounded"
          value={baseId}
          onChange={(e) => setBaseId(e.target.value)}
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Table Name</label>
        <input
          type="text"
          className="w-full border px-3 py-2 rounded"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="cursor-pointer bg-black text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Integration'}
      </button>
    </div>
  )
}
