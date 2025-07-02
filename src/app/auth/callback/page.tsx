'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase';

export default function OAuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.substring(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (access_token && refresh_token) {
     supabase.auth.setSession({ access_token, refresh_token }).then(() => {
        router.replace('/dashboard')
      })
    } else {
      router.replace('/login')
    }
  }, [router])

  return null
}
