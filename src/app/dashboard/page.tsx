'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client';
import toast from 'react-hot-toast'

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
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true) // ✅ Step ①
  const [userId, setUserId] = useState('')
  const [bots, setBots] = useState<Bot[]>([])
  const [botName, setBotName] = useState('')
  const [urls, setUrls] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState('')
  const [answers, setAnswers] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
const [, setSavingBotId] = useState<string | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) {
        router.replace('/')
      } else {
        const user = session.user
        setUserId(user.id)
        loadBots(user.id)

        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle()

        if (!existingUser) {
          await supabase.from('users').insert({
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
            auth_id: user.id,
          })
        }
      }

      setCheckingSession(false) // ✅ Step ③
    }

    checkSession()
  }, [router])

  const loadBots = async (userId: string) => {
    const { data } = await supabase.from('bots').select('*').eq('user_id', userId)
    setBots(data || [])
  }

  const handleLaunch = async () => {
    if (!botName || !description || !questions || !answers) {
      toast.error('❌ Please fill in all required fields before launching a bot.');
      return;
    }
    
    let finalLogoUrl = null

    if (logoFile) {
      await supabase.auth.getSession() // ✅ This line ensures session is attached!

      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('bot-logos')
        .upload(filePath, logoFile, { upsert: true })

      if (uploadError) {
        console.error('Logo upload failed:', JSON.stringify(uploadError, null, 2))
        toast.error(`❌ Upload failed: ${uploadError.message || 'unknown error'}`)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('bot-logos')
        .getPublicUrl(filePath)

      finalLogoUrl = publicUrlData?.publicUrl || null
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
        businessInfo: { urls: urlList, description },  
        qaPairs,
        logoUrl: finalLogoUrl,
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
      toast.success('✅ Bot created successfully.')
    } else {
      toast.error('❌ Failed to create bot.')
    }
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
      toast.success('✅ Bot deleted.');
    } else {
      toast.error('❌ Failed to delete bot.');
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const updateNocoDB = async (bot: Bot) => {
    if (!bot.nocodb_api_url || !bot.nocodb_api_key || !bot.nocodb_table) {
      toast.error('❌ Fill all NocoDB fields before saving.');
      return;
    }

    setSavingBotId(bot.id);
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nocodb_api_url: bot.nocodb_api_url,
        nocodb_api_key: bot.nocodb_api_key,
        nocodb_table: bot.nocodb_table,
      }),
    });
    setSavingBotId(null);

    if (res.ok) {
      toast.success('✅ NocoDB settings saved');
      loadBots(userId);
    } else {
      toast.error('❌ Failed to save NocoDB settings');
    }
  };

  const updateCalendar = async (bot: Bot) => {
    if (!bot.calendar_url) {
      toast.error('❌ Calendar URL is required');
      return;
    }

    setSavingBotId(bot.id);
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendar_url: bot.calendar_url }),
    });
    setSavingBotId(null);

    if (res.ok) {
      toast.success('✅ Calendar URL saved');
      loadBots(userId);
    } else {
      toast.error('❌ Failed to save calendar URL');
    }
  };

  const updateDocument = async (bot: Bot) => {
    if (!bot.document_url) {
      toast.error('❌ Document URL is required');
      return;
    }

    setSavingBotId(bot.id);
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_url: bot.document_url }),
    });
    setSavingBotId(null);

    if (res.ok) {
      toast.success('✅ Document URL saved');
      loadBots(userId);
    } else {
      toast.error('❌ Failed to save document URL');
    }
  };

  if (checkingSession) return <div className="p-10 text-center text-lg">Loading...</div> // ✅ Step ②

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
                    <button className="text-xs px-3 py-1 bg-blue-600 text-white rounded" onClick={() => {
                      navigator.clipboard.writeText(`<script src="https://in60second.net/embed.js" data-user="${bot.id}" defer></script>`);
                      toast.success('✅ Embed script copied!');
                    }}>  
                      Copy Script  
                    </button>  
                    <button className="text-xs px-3 py-1 bg-red-600 text-white rounded" onClick={() => handleDelete(bot.id)}>  
                      Delete  
                    </button>  
                    <button
                      className="text-xs px-3 py-1 bg-green-600 text-white rounded"
                      onClick={() => router.push(`/dashboard/bots/${bot.id}/test`)}
                    >
                      Test Bot
                    </button>
                  </div>  

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="NocoDB API URL"
                      className="p-2 text-sm border border-[#CCCCCC] rounded w-full"
                      value={bot.nocodb_api_url ?? ''}
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, nocodb_api_url: e.target.value } : b))}
                    />
                    <input
                      type="text"
                      placeholder="NocoDB API Key"
                      className="p-2 text-sm border border-[#CCCCCC] rounded w-full"
                      value={bot.nocodb_api_key ?? ''}
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, nocodb_api_key: e.target.value } : b))}
                    />
                    <input
                      type="text"
                      placeholder="NocoDB Table Name"
                      className="p2 text-sm border border-[#CCCCCC] rounded w-full"
                      value={bot.nocodb_table ?? ''}
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, nocodb_table: e.target.value } : b))}
                    />
                    <button 
                      onClick={() => updateNocoDB(bot)} 
                      className="bg-blue-600 text-white px-3 py-2 rounded w-full text-sm"
                    >
                      Save NocoDB
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                      type="text"
                      placeholder="Calendar URL (optional)"
                      className="p-2 text-sm border border-[#CCCCCC] rounded w-full"
                      value={bot.calendar_url ?? ''}
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, calendar_url: e.target.value } : b))}
                    />
                    <button 
                      onClick={() => updateCalendar(bot)} 
                      className="bg-purple-600 text-white px-3 py-2 rounded w-full text-sm"
                    >
                      Save Calendar
                    </button>
                    <input
                      type="text"
                      placeholder="Document Upload URL (optional)"
                      className="p-2 text-sm border border-[#CCCCCC] rounded w-full"
                      value={bot.document_url ?? ''}
                      onChange={(e) => setBots(bots.map(b => b.id === bot.id ? { ...b, document_url: e.target.value } : b))}
                    />
                    <button 
                      onClick={() => updateDocument(bot)} 
                      className="bg-teal-600 text-white px-3 py-2 rounded w-full text-sm"
                    >
                      Save Document URL
                    </button>
                  </div> 
                </li>  
              ))}  
            </ul>  
          )}  
        </section>
      </main>
    </div>
  )
}