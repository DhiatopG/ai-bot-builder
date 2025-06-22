'use client'

export default function DeleteBotButton({ id, onDelete }: { id: string; onDelete: () => void }) {
  async function handleDelete() {
    const res = await fetch('/api/admin/delete-bot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
    })

    if (res.ok) {
      onDelete()
    }
  }

  return (
    <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white rounded">
      Delete
    </button>
  )
}
