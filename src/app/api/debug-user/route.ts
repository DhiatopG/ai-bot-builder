import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  console.log('🧪 DEBUG USER:', user)

  return NextResponse.json({
    email: user?.email || null,
    id: user?.id || null,
  })
}
