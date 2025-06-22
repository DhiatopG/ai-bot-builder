'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function UploadPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session?.user?.email) return

    setUploading(true)
    const filePath = `${session.user.email}/${file.name}`

    const { error: uploadError } = await supabase.storage.from('pdfs').upload(filePath, file)

    if (uploadError) {
      alert('❌ Upload failed')
      setUploading(false)
      return
    }

    // 🔁 Call your API route to extract content and save it
    const botRes = await supabase.from('bots').select('id').eq('user_id', session.user.email).limit(1).single()
    const bot_id = botRes.data?.id

    const res = await fetch('/api/upload-file-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_id, filename: file.name })
    })

    const response = await res.json()
    setUploading(false)

    if (response.success) {
      alert('✅ File uploaded and content saved')
    } else {
      alert('⚠️ Uploaded but failed to process file content')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 relative">
      <button
        onClick={() => router.push('/dashboard')}
        className="absolute top-4 right-4 text-white text-xl font-bold hover:text-red-400"
      >
        ×
      </button>

      <h2 className="text-xl font-bold mb-6 text-white">Upload PDF Knowledge Base</h2>

      <label className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded cursor-pointer">
        Click to Upload PDF
        <input
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          className="hidden"
        />
      </label>

      {uploading && <p className="mt-4 text-white">Uploading...</p>}
    </div>
  )
}
