'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type Session, type User, type AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/client';

type SupabaseUserContextType = {
  session: Session | null;
  user: User | null;
};

const SupabaseUserContext = createContext<SupabaseUserContextType>({
  session: null,
  user: null,
});

export function Providers({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(
      ({ data }: { data: { session: Session | null } }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseUserContext.Provider value={{ session, user }}>
      {children}
    </SupabaseUserContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(SupabaseUserContext);
}
