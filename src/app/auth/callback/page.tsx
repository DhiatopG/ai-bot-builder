'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthRedirect = async () => {
      console.log('[AuthCallback] waiting for session...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('[AuthCallback] session error:', sessionError)
        router.replace('/login')
        return
      }

      const user = session?.user
      console.log('[AuthCallback] session:', session)

      if (!user) {
        console.log('[AuthCallback] no user — redirecting to /login')
        router.replace('/login')
        return
      }

      console.log('[AuthCallback] inserting user...')
      const { error: insertError } = await supabase.from('users').insert({
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
        auth_id: user.id,
        role: 'user',
      })

      if (insertError) {
        console.warn('[AuthCallback] insert error:', insertError.message)
      }

      router.replace('/login')
    }

    handleAuthRedirect()
  }, [router])

  return (
    <div className="p-10 text-center text-lg">
      We’re creating your dashboard...<br />Please log in again in a few seconds.
    </div>
  )
}
