'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      console.log('[AuthCallback] waiting for session...')
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      console.log('[AuthCallback] session:', session)

      if (!session?.user) {
        console.log('[AuthCallback] no session user — redirecting to /login')
        router.replace('/login')
        return
      }

      const user = session.user

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!existing) {
        console.log('[AuthCallback] inserting user...')
        await supabase.from('users').insert({
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
          uuid: user.id,
          auth_id: user.id,
          role: 'user',
        })
        setTimeout(() => router.replace('/login'), 3000)
      } else {
        console.log('[AuthCallback] user exists — going to dashboard')
        router.replace('/dashboard')
      }
    }

    checkUser()
  }, [router])

  return (
    <div className="p-10 text-center text-lg">
      We’re creating your dashboard...<br />
      Please wait, you’ll be redirected shortly.
    </div>
  )
}
