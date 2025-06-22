'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type Props = {
  bot_id: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function FileList({ bot_id }: Props) {
  const [files, setFiles] = useState<{ file_name: string }[]>([])

  useEffect(() => {
    const fetchFiles = async () => {
      const { data } = await supabase
        .from('bot_knowledge_files')
        .select('file_name')
        .eq('bot_id', bot_id)

      if (data) setFiles(data)
    }

    fetchFiles()
  }, [bot_id])

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-2">Uploaded Knowledge Files</h2>
      {files.length === 0 ? (
        <p className="text-gray-400">No files uploaded yet.</p>
      ) : (
        <ul className="list-disc list-inside text-white">
          {files.map((f, idx) => (
            <li key={idx}>{f.file_name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
