'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type SupabaseUserContextType = {
  session: Session | null
  user: User | null
}

const SupabaseUserContext = createContext<SupabaseUserContextType>({
  session: null,
  user: null,
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
    })

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])

  return (
    <SupabaseUserContext.Provider value={{ session, user }}>
      {children}
    </SupabaseUserContext.Provider>
  )
}

export function useSupabaseAuth() {
  return useContext(SupabaseUserContext)
}
