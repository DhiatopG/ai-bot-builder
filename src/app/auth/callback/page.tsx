'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const finishOAuth = async () => {
      const { data: userData, error } = await supabase.auth.getUser()
      const user = userData?.user

      if (error || !user) {
        router.replace('/login')
        return
      }

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!existing) {
        await supabase.from('users').insert({
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
          uuid: user.id,
          auth_id: user.id,
          role: 'user',
        })

        setTimeout(() => {
          router.replace('/login')
        }, 3000)
      } else {
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
