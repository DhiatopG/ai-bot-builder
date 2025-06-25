import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase.from('users').upsert(
    {
      auth_id: session.user.id,
      email: session.user.email,
      name: session.user.name || '',
      role: 'user',
    },
    { onConflict: 'auth_id' }
  )

  return NextResponse.json({ success: true })
}
