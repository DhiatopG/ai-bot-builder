'use client'

import { useRouter } from 'next/navigation'

export default function EditBotButton({ id }: { id: string }) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(`/dashboard/bot/${id}`)}
      className="px-3 py-1 bg-yellow-600 text-white rounded"
    >
      Edit
    </button>
  )
}
