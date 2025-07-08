'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const finishOAuth = async () => {
      console.log('[AuthCallback] checking user...')
      const { data: userData, error } = await supabase.auth.getUser()
      console.log('[AuthCallback] userData:', userData)

      if (error || !userData?.user) {
        console.log('[AuthCallback] no user — redirecting to /login')
        router.replace('/login')
        return
      }

      const user = userData.user

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      console.log('[AuthCallback] existing user:', existing)

      if (!existing) {
        console.log('[AuthCallback] inserting new user...')
        await supabase.from('users').insert({
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
          uuid: user.id,
          auth_id: user.id,
          role: 'user',
        })
        console.log('[AuthCallback] inserted new user, redirecting...')
        setTimeout(() => router.replace('/login'), 3000)
      } else {
        console.log('[AuthCallback] existing user — redirecting to dashboard')
        router.replace('/dashboard')
      }
    }

    finishOAuth()
  }, [router])

  return (
    <div className="p-10 text-center text-lg">
      We’re creating your dashboard...<br />
      Please wait, you’ll be redirected shortly.
    </div>
  )
}
