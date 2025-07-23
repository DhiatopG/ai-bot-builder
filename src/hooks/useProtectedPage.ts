'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/client';

export const useProtectedPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      try {
        if (typeof window === 'undefined' || !supabase) return;

        const session = await supabase.auth.getSession();
        if (!session?.data?.session?.user) {
          router.replace('/login');
        } else {
          setUser(session.data.session.user);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    getSession();
  }, [router]);

  return { user, loading };
};