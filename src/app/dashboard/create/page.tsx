// src/app/dashboard/create/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'
import toast from 'react-hot-toast'
import type { AuthChangeEvent } from '@supabase/supabase-js'

export default function CreateBotPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [forceRedirect, setForceRedirect] = useState(false)
  const [userId, setUserId] = useState('')
  const [botName, setBotName] = useState('')
  const [urls, setUrls] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState('')
  const [answers, setAnswers] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase.auth.getSession()
        if (data?.session) {
          const user = data.session.user
          setUserId(user.id)

          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

          if (!existingUser) {
            await fetch('/api/users/insert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: user.email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
                auth_id: user.id,
              }),
            })

            try {
              await fetch('/api/send-welcome-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
              })
            } catch (err) {
              console.error('❌ Failed to send welcome email', err)
            }
          }

          setCheckingSession(false)
          return
        }

        if (error) console.error(error)
        await new Promise((res) => setTimeout(res, 500))
      }

      const { data: userCheck } = await supabase.auth.getUser()
      if (userCheck?.user) {
        setUserId(userCheck.user.id)
        setCheckingSession(false)
      } else {
        const hasRedirected = sessionStorage.getItem('first_signup_redirect_done')
        if (!hasRedirected) {
          sessionStorage.setItem('first_signup_redirect_done', 'true')
          setForceRedirect(true)
          setTimeout(() => {
            router.replace('/login')
          }, 4000)
          return
        }

        setCheckingSession(false)
        router.replace('/')
      }
    }

    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
      if (session && event === 'INITIAL_SESSION') {
        const user = session.user
        setUserId(user.id)

        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle()

        if (!existingUser) {
          await fetch('/api/users/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
              auth_id: user.id,
            }),
          })

          try {
            await fetch('/api/send-welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email }),
            })
          } catch (err) {
            console.error('❌ Failed to send welcome email', err)
          }
        }

        setCheckingSession(false)
      }

      if (event === 'SIGNED_OUT' || (!session && event === 'INITIAL_SESSION')) {
        setCheckingSession(false)
        router.replace('/')
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  const handleLaunch = async () => {
    if (!botName || !description || !questions || !answers) {
      toast.error('❌ Please fill in all required fields before launching a bot.')
      return
    }

    let finalLogoUrl = null

    if (logoFile) {
      await supabase.auth.getSession()

      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('bot-logos')
        .upload(filePath, logoFile, { upsert: true })

      if (uploadError) {
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
      toast.success('✅ Bot created successfully.')
      router.push('/dashboard')
    } else {
      toast.error('❌ Failed to create bot.')
    }
  }

  if (forceRedirect) {
    return (
      <div className="p-10 text-center text-lg">
        We’re creating your dashboard...<br />Please log in again in a few seconds.
      </div>
    )
  }

  if (checkingSession) {
    return <div className="p-10 text-center text-lg">Loading...</div>
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-bold">Quick Launch</h2>
      <input type="text" placeholder="Bot Name" className="border p-3 w-full rounded" value={botName} onChange={(e) => setBotName(e.target.value)} />
      <textarea placeholder="Website URLs (one per line)" className="border p-3 w-full rounded" value={urls} onChange={(e) => setUrls(e.target.value)} />
      <textarea placeholder="Bot Description" className="border p-3 w-full rounded" value={description} onChange={(e) => setDescription(e.target.value)} />
      <textarea placeholder="Questions (Q1? Q2?...)" className="border p-3 w-full rounded" value={questions} onChange={(e) => setQuestions(e.target.value)} />
      <textarea placeholder="Answers (A1, A2,...)" className="border p-3 w-full rounded" value={answers} onChange={(e) => setAnswers(e.target.value)} />
      <input type="file" accept="image/*" className="border p-3 w-full rounded" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
      <button onClick={handleLaunch} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full">
        Launch in 60 Seconds
      </button>
    </main>
  )
}
