'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

interface Bot {
  id: string
  bot_name: string
  description: string
  urls: string
  nocodb_api_url?: string | null
  nocodb_api_key?: string | null
  nocodb_table?: string | null
  calendar_url?: string | null
  document_url?: string | null
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [bots, setBots] = useState<Bot[]>([])
  const [botName, setBotName] = useState('')
  const [urls, setUrls] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState('')
  const [answers, setAnswers] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (status === 'authenticated' && session?.user?.email) {
      const email = session.user.email
      setUserId(email)
      loadBots(email)
    }
  }, [status, session, router])

  const loadBots = async (email: string) => {
    const { data } = await supabase.from('bots').select('*').eq('user_id', email)
    setBots(data || [])
  }

  const handleLaunch = async () => {
    let logoUrl = ''
    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop()
      const filePath = `logos/${uuidv4()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('bot-assets')  
        .upload(filePath, logoFile)
      if (uploadError) {
        alert('❌ Failed to upload logo.')  
        return
      }
      const { data: publicUrlData } = supabase
        .storage  
        .from('bot-assets')  
        .getPublicUrl(filePath)
      logoUrl = publicUrlData.publicUrl
    }

    const urlList = urls.split('\n').map((u) => u.trim()).filter(Boolean)
    const qaPairs = questions
      .split('?')
      .map((q, i) => ({
        question: q.trim() + '?',  
        answer: answers.split(',')[i]?.trim() || '',
      }))
      .filter((pair) => pair.question.length > 1)

    const res = await fetch('/api/create-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,  
        botName,  
        businessInfo: { urls: urlList, description, logo_url: logoUrl },  
        qaPairs,
      }),
    })

    const response = await res.json()
    if (response.success) {
      setBotName('')
      setUrls('')
      setDescription('')
      setQuestions('')
      setAnswers('')
      setLogoFile(null)
      loadBots(userId)
      alert('✅ Bot created successfully.')
    } else {
      alert('❌ Failed to create bot.')
    }
  }

  const updateBot = async (botId: string, field: string, value: string) => {
    await supabase.from('bots').update({ [field]: value }).eq('id', botId)
    loadBots(userId)
  }

  const handleDelete = async (botId: string) => {
    const confirmed = confirm('Are you sure you want to delete this bot?')
    if (!confirmed) return

    const res = await fetch('/api/delete-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_id: botId }),
    })

    if (res.ok) {
      setBots((prev) => prev.filter((b) => b.id !== botId))
    } else {
      alert('❌ Failed to delete bot.')
    }
  }

  const handleLogout = () => signOut()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#333333]">
        <p>Checking access...</p>
      </div>
    )
  }

  return (
    <div className="bg-white text-[#333333] font-sans min-h-screen">
      <header className="bg-[#003366] text-white p-4 shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center">  
          <h1 className="text-xl font-bold">AI Bot Dashboard</h1>  
          <div className="flex gap-4">  
            <button onClick={() => router.push('/dashboard/leads')} className="bg-[#2ECC71] text-white px-4 py-2 rounded hover:bg-green-700">  
              View Leads  
            </button>  
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">  
              Logout  
            </button>  
          </div>  
        </div>
      </header>
      <div className="relative">
        {!sidebarOpen && (  
          <button onClick={() => setSidebarOpen(true)} className="absolute top-4 left-4 z-50 text-2xl font-bold text-[#003366]">☰</button>  
        )}  
        {sidebarOpen && (  
          <div className="absolute top-0 left-0 w-64 h-screen bg-[#f9f9f9] shadow-xl p-6 z-40 border-r border-[#CCCCCC]">  
            <div className="flex justify-between items-center mb-6">  
              <h2 className="text-xl font-bold text-[#333333]">📋 Menu</h2>  
              <button onClick={() => setSidebarOpen(false)} className="text-xl font-bold text-[#666666] hover:text-[#333333]">✕</button>  
            </div>  
            <ul className="space-y-4 text-left">  
              <li>  
                <button  
                  onClick={() => router.push('/dashboard')}  
                  className="w-full text-left px-3 py-2 rounded hover:bg-[#EEEEEE] text-[#333333] font-medium"  
                >  
                  🏠 Dashboard  
                </button>  
              </li>  
              <li>  
                <button  
                  onClick={() => router.push('/dashboard/summary')}  
                  className="w-full text-left px-3 py-2 rounded hover:bg-[#EEEEEE] text-[#333333] font-medium"  
                >  
                  📊 Daily Summary  
                </button>  
              </li>  
              <li>  
                <button  
                  onClick={() => router.push('/dashboard/conversations')}  
                  className="w-full text-left px-3 py-2 rounded hover:bg-[#EEEEEE] text-[#333333] font-medium"  
                >  
                  💬 Conversations  
                </button>  
              </li>  
              <li>  
                <button  
                  onClick={() => router.push('/dashboard/upload')}  
                  className="w-full text-left px-3 py-2 rounded hover:bg-[#EEEEEE] text-[#333333] font-medium"  
                >  
                  📎 Upload PDF  
                </button>  
              </li>  
            </ul>  
          </div>  
        )}
      </div>
      <main className="max-w-7xl mx-auto p-6 space-y-10">
        <section className="bg-[#F2F2F2] p-6 rounded-lg shadow-md space-y-4">  
          <h2 className="text-lg font-semibold mb-4">Quick Launch</h2>  
          <input type="text" placeholder="Bot Name" className="border border-[#CCCCCC] p-3 w-full rounded" value={botName} onChange={(e) => setBotName(e.target.value)} />  
          <textarea placeholder="Website URLs (one per line)" className="border border-[#CCCCCC] p-3 w-full rounded" value={urls} onChange={(e) => setUrls(e.target.value)} />  
          <textarea placeholder="Bot Description" className="border border-[#CCCCCC] p-3 w-full rounded" value={description} onChange={(e) => setDescription(e.target.value)} />  
          <textarea placeholder="Questions (Q1? Q2?...)" className="border border-[#CCCCCC] p-3 w-full rounded" value={questions} onChange={(e) => setQuestions(e.target.value)} />  
          <textarea placeholder="Answers (A1, A2,...)" className="border border-[#CCCCCC] p-3 w-full rounded" value={answers} onChange={(e) => setAnswers(e.target.value)} />  
          <input type="file" accept="image/*" className="border border-[#CCCCCC] p-3 w-full rounded" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />  
          <button onClick={handleLaunch} className="bg-[#2ECC71] text-white px-4 py-2 rounded hover:bg-green-600 w-full">  
            Launch in 60 Seconds  
          </button>  
        </section>  

        <section>  
          <h3 className="text-md font-semibold mb-2">Your Bots</h3>  
          {bots.length === 0 ? (  
            <p className="text-[#999999]">No bots yet.</p>  
          ) : (  
            <ul className="space-y-6">  
              {bots.map((bot) => (  
                <li key={bot.id} className="bg-white border border-[#CCCCCC] rounded-lg p-4 shadow-sm">  
                  <h4 className="font-bold text-lg mb-1 text-[#003366]">{bot.bot_name}</h4>  
                  <p className="text-sm text-[#666666] mb-1">{bot.description}</p>  
                  <p className="text-xs text-[#999999] mb-2">{bot.urls}</p>  
                  <div className="bg-[#F9F9F9] p-2 text-sm font-mono rounded mb-2 break-all">  
                    {`<script src="https://in60second.net/embed.js" data-user="${bot.id}" defer></script>`}  
                  </div>  
                  <div className="flex gap-2 mb-3">  
                    <button className="text-xs px-3 py-1 bg-blue-600 text-white rounded" onClick={() =>  
                      navigator.clipboard.writeText(  
                        `<script src="https://in60second.net/embed.js" data-user="${bot.id}" defer></script>`  
                      )}>  
                      Copy Script  
                    </button>  
                    <button className="text-xs px-3 py-1 bg-red-600 text-white rounded" onClick={() => handleDelete(bot.id)}>  
                      Delete  
                    </button>  
                  </div>  

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start">  
                    <input  
                      className="p-2 text-sm border border-[#CCCCCC] rounded"  
                      placeholder="NocoDB API URL"  
                      value={bot.nocodb_api_url ?? ''}  
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, nocodb_api_url: e.target.value } : b))}  
                    />  
                    <input  
                      className="p-2 text-sm border border-[#CCCCCC] rounded"  
                      placeholder="NocoDB API Key"  
                      value={bot.nocodb_api_key ?? ''}  
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, nocodb_api_key: e.target.value } : b))}  
                    />  
                    <input  
                      className="p-2 text-sm border border-[#CCCCCC] rounded"  
                      placeholder="NocoDB Table Name"  
                      value={bot.nocodb_table ?? ''}  
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, nocodb_table: e.target.value } : b))}  
                    />  
                    <input
                      className="p-2 text-sm border border-[#CCCCCC] rounded"
                      placeholder="Calendar URL (optional)"
                      value={bot.calendar_url ?? ''}
                      onChange={(e) =>
                        setBots(bots.map(b => b.id === bot.id ? { ...b, calendar_url: e.target.value } : b))
                      }
                    />
                    <input
                      className="p-2 text-sm border border-[#CCCCCC] rounded"
                      placeholder="Document Upload URL (optional)"
                      value={bot.document_url ?? ''}
                      onChange={(e) =>
                        setBots(bots.map(b => b.id === bot.id ? { ...b, document_url: e.target.value } : b))
                      }
                    />
                  </div>  
                  <button  
                    className="bg-[#003366] text-white px-3 py-2 rounded hover:bg-[#002244] text-xs mt-2"  
                    onClick={async () => {  
                      await updateBot(bot.id, 'nocodb_api_url', bot.nocodb_api_url || '')  
                      await updateBot(bot.id, 'nocodb_api_key', bot.nocodb_api_key || '')  
                      await updateBot(bot.id, 'nocodb_table', bot.nocodb_table || '')  
                      await updateBot(bot.id, 'calendar_url', bot.calendar_url || '')
                      await updateBot(bot.id, 'document_url', bot.document_url || '')  
                    }}  
                  >  
                    Save  
                  </button>  
                </li>  
              ))}  
            </ul>  
          )}  
        </section>
      </main>
    </div>
  )
}