'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ZapierBotWebhookPage() {
  const { botId } = useParams()
  const router = useRouter()
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

  const handleSendTest = async () => {
    if (!botId) {
      toast.error('Missing bot ID')
      return
    }

    try {
      const res = await fetch('/api/integrations/zapier/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('Test request sent to Zapier!')
      } else {
        toast.error(data.error || 'Zapier test failed')
      }
    } catch (err) {
      console.error('Zapier test error:', err)
      toast.error('Zapier request failed')
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <button
        onClick={() => router.back()}
        className="fixed top-6 right-6 text-gray-500 hover:text-gray-700 transition cursor-pointer z-50"
        aria-label="Go back"
      >
        <X className="w-6 h-6" />
      </button>

      <h1 className="text-xl font-semibold mb-4">Zapier Webhook</h1>
      <input
        type="url"
        className="w-full border p-2 rounded mb-4"
        placeholder="Enter your Zapier webhook URL"
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
      />
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save Webhook
        </button>
        <button
          onClick={handleSendTest}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Send Test Request
        </button>
      </div>
    </div>
  )
}