'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from "../../../lib/supabase/browser"

interface Conversation {
  id: string
  question: string
  answer: string
  created_at: string
}

export default function ConversationsPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConversations = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        router.replace('/login')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_email', user.email) // optional: filter per user
        .order('created_at', { ascending: false })

      if (!fetchError && data) {
        setConversations(data)
      }

      setLoading(false)
    }

    fetchConversations()
  }, [router])

  if (loading) {
    return <p className="p-6">Loading conversations...</p>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Visitor Conversations</h1>

      {conversations.length === 0 ? (
        <p className="text-gray-500">No conversations yet.</p>
      ) : (
        <ul className="space-y-4">
          {conversations.map((conv) => (
            <li key={conv.id} className="bg-white p-4 rounded shadow">
              <p className="text-gray-800">
                <strong>Q:</strong> {conv.question}
              </p>
              <p className="text-gray-600 mt-2">
                <strong>A:</strong> {conv.answer}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(conv.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
