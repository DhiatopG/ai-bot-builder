'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { supabase } from '@/lib/client'

export default function MakeIntegrationPage() {
  const { botId } = useParams()
  const router = useRouter()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const res = await fetch(`/api/integrations/make?bot_id=${botId}`, {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        })

        const data = await res.json()
        if (data?.webhook_url) setWebhookUrl(data.webhook_url)
      } catch {
        toast.error('Failed to load webhook')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [botId])

  const handleSave = async () => {
    if (!webhookUrl) {
      toast.error('Webhook URL is required')
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch('/api/integrations/make', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ bot_id: botId, webhook_url: webhookUrl }),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Failed to save webhook')
      } else {
        toast.success('Webhook saved')
      }
    } catch {
      toast.error('Failed to save webhook')
    }
  }

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error('Webhook URL is required')
      return
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_id: botId,
          lead: {
            name: 'in60second',
            email: 'support@in60second.net',
            message: 'This is a test lead from the dashboard.',
          },
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        toast.error(`Test failed: ${text}`)
      } else {
        toast.success('Test request sent successfully')
      }
    } catch {
      toast.error('Test request failed')
    }
  }

  if (loading) return <p className="p-4">Loading...</p>

  return (
    <div className="relative min-h-screen p-6 max-w-xl">
      <button
        onClick={() => router.back()}
        className="fixed top-6 right-6 text-gray-500 hover:text-gray-700 transition cursor-pointer z-50"
        aria-label="Go back"
      >
        <X className="w-6 h-6" />
      </button>

      <h1 className="text-2xl font-bold mb-4">Make.com Webhook</h1>
      <input
        type="url"
        placeholder="Enter your Make.com webhook URL"
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
        className="w-full p-2 border rounded mb-4"
        required
      />

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save Webhook
        </button>

        <button
          onClick={handleTest}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Send Test Request
        </button>
      </div>
    </div>
  )
}
