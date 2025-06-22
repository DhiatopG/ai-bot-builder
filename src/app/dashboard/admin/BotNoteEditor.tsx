'use client'

import { useState } from 'react'

export default function BotNoteEditor({ id, initial }: { id: string, initial: string }) {
  const [note, setNote] = useState(initial)

  async function saveNote() {
    await fetch('/api/admin/update-bot-note', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, note }),
    })
  }

  return (
    <div className="mt-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        className="w-full p-2 border border-gray-300 rounded text-black"
        rows={2}
        placeholder="Add note or flag"
      />
    </div>
  )
}
