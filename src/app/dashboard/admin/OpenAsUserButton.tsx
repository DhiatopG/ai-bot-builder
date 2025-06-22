'use client'

export default function OpenAsUserButton({ id, userId }: { id: string, userId: string }) {
  return (
    <a
      href={`/bot/${id}?as_user=${userId}`}
      className="px-3 py-1 bg-blue-600 text-white rounded inline-block"
    >
      Open as User
    </a>
  )
}
