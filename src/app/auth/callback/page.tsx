'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'

export default function OAuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleRedirect = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) return router.replace('/login')

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!existingUser) {
        await supabase.from('users').insert({
          email: user.email,
          name: user.user_metadata.full_name || user.user_metadata.name,
          auth_id: user.id,
          role: 'user',
        })

        sessionStorage.setItem('first_signup_redirect_done', 'true')

        setTimeout(() => {
          router.replace('/login')
        }, 3000)
      } else {
        router.replace('/dashboard')
      }
    }

    handleRedirect()
  }, [router])

  return (
    <div className="p-10 text-center text-lg">
      We’re creating your dashboard...<br />
      Please wait, you’ll be redirected.
    </div>
  )
}
