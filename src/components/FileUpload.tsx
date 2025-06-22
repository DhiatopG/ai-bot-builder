'use client'

import { useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

type Props = {
  bot_id: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function FileUpload({ bot_id }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    const text = await file.text()

    await supabase.from('bot_knowledge_files').insert([
      {
        bot_id,
        file_name: file.name,
        file_text: text
      }
    ])

    location.reload()
  }

  return (
    <div className="mb-4">
      <input
        type="file"
        accept=".txt,.pdf"
        ref={fileInputRef}
        className="mb-2"
      />
      <button
        onClick={handleUpload}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Upload File
      </button>
    </div>
  )
}
