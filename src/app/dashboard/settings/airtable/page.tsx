'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AirtableIntegrationPage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [baseId, setBaseId] = useState('')
  const [tableName, setTableName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/integrations/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        base_id: baseId,
        table_name: tableName,
      }),
    })

    const result = await res.json()
    setLoading(false)

    if (res.ok) {
      alert('✅ Airtable integration saved!')
      router.push('/dashboard/settings')
    } else {
      alert(`❌ Error: ${result.error}`)
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Connect Airtable</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border p-2 rounded"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Base ID"
          value={baseId}
          onChange={(e) => setBaseId(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Table Name"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
        />
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Integration'}
        </button>
      </form>
    </div>
  )
}
