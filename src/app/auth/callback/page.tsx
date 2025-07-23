'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    let called = false

    const processUser = async () => {
      if (called) return
      called = true

      // Add null check for supabase
      if (!supabase) {
        console.error('[AuthCallback] ❌ Supabase not initialized');
        router.replace('/login');
        return;
      }

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      if (!session || sessionError) {
        console.error('[AuthCallback] ❌ Session failed:', sessionError)
        router.replace('/login')
        return
      }

      const user = session.user
      console.log('[AuthCallback] ✅ Session:', user)

      // Call internal insert API with trace header
      const res = await fetch('/api/users/insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Origin': 'auth-callback-page'
        },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
          auth_id: user.id
        })
      })

      const json = await res.json()
      console.log('[AuthCallback] 🧾 Insert response:', res.status, json)

      if (!res.ok) {
        router.replace('/login')
        return
      }

      router.replace('/dashboard')
    }

    processUser()
  }, [router])

  return (
    <div className="p-10 text-center text-lg">
      We’re creating your dashboard...<br />Please wait a moment...
    </div>
  )
}