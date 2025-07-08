import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from './lib/supabase/server'

export async function middleware() {
  const res = NextResponse.next()
  const supabase = await createServerSupabaseClient()
  await supabase.auth.getSession()
  return res
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
