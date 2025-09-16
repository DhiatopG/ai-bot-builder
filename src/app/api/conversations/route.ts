// src/app/api/conversations/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * List conversations for the authenticated user (optionally filter by ?bot_id=...).
 */
export async function GET(req: Request) {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', detail: userError?.message },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const botId = searchParams.get('bot_id')

  let query: any = supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false })

  if (botId) query = query.eq('bot_id', botId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * Create a new conversation row.
 * Body: { user_id: <botId>, conversation_id: <uuid> }
 */
export async function POST(req: Request) {
  const supabase = await createServerClient()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { user_id: botId, conversation_id } = body || {}
  if (!botId || !conversation_id) {
    return NextResponse.json(
      { error: 'Missing botId or conversation_id' },
      { status: 400 }
    )
  }

  // Only insert columns that exist in your table
  const row: any = {
    id: conversation_id,
    bot_id: botId,
  }

  // 1) Try normal insert (respecting RLS)
  let { data, error } = await supabase
    .from('conversations')
    .insert(row)
    .select('id')
    .single()

  // 2) If RLS blocks it, fall back to admin insert
  const rlsBlocked =
    error &&
    (error.code === '42501' ||
      error.code === 'PGRST116' ||
      /row-level security/i.test(error.message || ''))

  if (rlsBlocked) {
    const admin = await createAdminClient()
    const r2 = await admin
      .from('conversations')
      .insert(row)
      .select('id')
      .single()
    data = r2.data as any
    error = r2.error as any
  }

  // 3) If duplicate PK (id) just return ok (user refreshed quickly, etc.)
  if (
    error &&
    (error.code === '23505' ||
      /duplicate key value violates unique constraint/i.test(error.message))
  ) {
    return NextResponse.json({ ok: true, id: conversation_id, duplicate: true })
  }

  if (error) {
    console.error('[api/conversations POST] insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id ?? conversation_id })
}
