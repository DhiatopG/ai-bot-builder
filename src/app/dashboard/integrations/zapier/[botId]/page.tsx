'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'

export default function ZapierBotWebhookPage() {
  const { botId } = useParams()
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    const fetchWebhook = async () => {
      const res = await fetch(`/api/integrations/zapier?bot_id=${botId}`)
      const data = await res.json()
      if (data.webhook_url) {
        setWebhookUrl(data.webhook_url)
      }
    }
    fetchWebhook()
  }, [botId])

  const handleSave = async () => {
    const res = await fetch('/api/integrations/zapier', {
      method: 'POST',
      body: JSON.stringify({ bot_id: botId, webhook_url: webhookUrl }),
      headers: { 'Content-Type': 'application/json' },
    })

    if (res.ok) {
      toast.success('Zapier webhook saved!')
    } else {
      toast.error('Error saving webhook')
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-4">Zapier Webhook</h1>
      <input
        type="url"
        className="w-full border p-2 rounded mb-4"
        placeholder="Enter your Zapier webhook URL"
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
      />
      <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">
        Save Webhook
      </button>
    </div>
  )
}
