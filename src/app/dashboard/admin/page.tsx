'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import DeleteBotButton from './DeleteBotButton'
import EditBotButton from './EditBotButton'
import OpenAsUserButton from './OpenAsUserButton'
import BotNoteEditor from './BotNoteEditor'

type User = {
  id: string
  email: string
  name: string | null
  role: string
}

type Conversation = {
  id: string
  user_id: string
  bot_id: string
  lead_name: string
  lead_email: string
  question: string
  answer: string
  created_at: string
}

type Bot = {
  id: string
  user_id: string
  bot_name: string
  urls: string
  description: string
  airtable_api_key: string
  airtable_base_id: string
  airtable_table_name: string
  note: string
  created_at: string
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [bots, setBots] = useState<Bot[]>([])

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/admin/users')
        .then((res) => {
          if (res.status === 403) {
            setIsAdmin(false)
            return []
          }
          setIsAdmin(true)
          return res.json()
        })
        .then((data) => {
          if (Array.isArray(data)) setUsers(data)
        })

      fetch('/api/admin/conversations')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setConversations(data)
        })

      fetch('/api/admin/bots')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setBots(data)
        })
    }
  }, [session])

  if (status === 'loading') return <p className="p-6">Loading...</p>
  if (!isAdmin) return <p className="p-6 text-red-500">Access Denied</p>

  async function updateRole(email: string, role: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, role }),
    })
    const updated = await fetch('/api/admin/users').then(res => res.json())
    if (Array.isArray(updated)) {
      setUsers(updated)
    }
  }

  return (
    <div className="p-6 space-y-8 bg-black min-h-screen text-white">
      <div>
        <h1 className="text-2xl font-bold mb-4">All Users</h1>
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="bg-white p-4 shadow rounded text-black">
              <p>Email: {u.email}</p>
              <p>Name: {u.name}</p>
              <p>Role: {u.role}</p>
              {session?.user?.email !== u.email && (
                <button
                  onClick={() => updateRole(u.email, u.role === 'admin' ? 'user' : 'admin')}
                  className="mt-2 mr-2 px-3 py-1 rounded bg-blue-600 text-white"
                >
                  Make {u.role === 'admin' ? 'User' : 'Admin'}
                </button>
              )}
              <a
                href={`/dashboard/admin/user/${u.id}`}
                className="mt-2 inline-block px-3 py-1 rounded bg-green-600 text-white"
              >
                Open User Dashboard
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-4">All Conversations</h1>
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id} className="bg-gray-100 p-4 rounded text-black">
              <p>User ID: {c.user_id}</p>
              <p>Bot: {c.bot_id}</p>
              <p>Q: {c.question}</p>
              <p>A: {c.answer}</p>
              <p>Lead: {c.lead_name} - {c.lead_email}</p>
              <p className="text-xs text-gray-600">{new Date(c.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-4">All Bots</h1>
        <ul className="space-y-2">
          {bots.map((b) => (
            <li key={b.id} className="bg-gray-100 p-4 rounded text-black">
              <p>User ID: {b.user_id}</p>
              <p>Bot Name: {b.bot_name}</p>
              <p>URLs: {b.urls}</p>
              <p>Knowledge: {b.description}</p>
              <p>API Key: {b.airtable_api_key?.slice(0, 6)}*****</p>
              <p>Base ID: {b.airtable_base_id}</p>
              <p>Table Name: {b.airtable_table_name}</p>
              <p className="text-xs">{new Date(b.created_at).toLocaleString()}</p>
              <BotNoteEditor id={b.id} initial={b.note || ''} />
              <div className="flex gap-2 mt-2">
                <DeleteBotButton id={b.id} onDelete={() => setBots(bots.filter(bot => bot.id !== b.id))} />
                <EditBotButton id={b.id} />
                <OpenAsUserButton id={b.id} userId={b.user_id} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
