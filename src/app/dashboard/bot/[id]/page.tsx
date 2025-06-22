'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import FileUpload from '@/components/FileUpload'
import FileList from '@/components/FileList'

export default function BotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [bot, setBot] = useState<any>(null)
  const [botName, setBotName] = useState('')
  const [description, setDescription] = useState('')
  const [urls, setUrls] = useState('')

  useEffect(() => {
    const fetchBot = async () => {
      const res = await fetch(`/api/bots/${params.id}`)
      const data = await res.json()
      if (res.status !== 200) return
      setBot(data)
      setBotName(data.bot_name || '')
      setDescription(data.description || '')
      setUrls(data.urls || '')
    }
    if (params.id) fetchBot()
  }, [params.id])

  const handleUpdate = async () => {
    await fetch(`/api/bots/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify({ bot_name: botName, description, urls }),
      headers: { 'Content-Type': 'application/json' }
    })
    router.back()
  }

  if (!bot) return <div className="p-8 text-white">Loading...</div>

  return (
    <div className="max-w-xl mx-auto p-8 text-white relative">
      <button onClick={() => router.back()} className="absolute top-4 right-4 text-white text-2xl">×</button>
      <h1 className="text-2xl font-bold mb-6">Edit Bot</h1>

      <input
        className="w-full border border-gray-600 bg-black text-white p-2 mb-4"
        value={botName}
        onChange={(e) => setBotName(e.target.value)}
        placeholder="Bot Name"
      />
      <textarea
        className="w-full border border-gray-600 bg-black text-white p-2 mb-4"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <textarea
        className="w-full border border-gray-600 bg-black text-white p-2 mb-4"
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder="Website URLs (separated by newline)"
      />

      <button
        onClick={handleUpdate}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-6"
      >
        Save Changes
      </button>

      <FileUpload bot_id={params.id as string} />
      <FileList bot_id={params.id as string} />
    </div>
  )
}
