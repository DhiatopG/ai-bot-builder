import { createServerSupabaseClient } from '@/lib/supabase/server'
import { type NextRequest } from 'next/server'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: botId } = await context.params
  const supabase = await createServerSupabaseClient()
  const body = await req.json()

  const {
    Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
  } = body

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = user.id
  const days = [
    { name: 'Monday', data: Monday },
    { name: 'Tuesday', data: Tuesday },
    { name: 'Wednesday', data: Wednesday },
    { name: 'Thursday', data: Thursday },
    { name: 'Friday', data: Friday },
    { name: 'Saturday', data: Saturday },
    { name: 'Sunday', data: Sunday },
  ]

  await supabase
    .from('working_hours')
    .delete()
    .eq('user_id', userId)
    .eq('bot_id', botId)

  const inserts = days.map((day) => ({
    user_id: userId,
    bot_id: botId,
    day: day.name,
    start: day.data.start,
    end: day.data.end,
    closed: day.data.closed,
  }))

  const { error: insertError } = await supabase.from('working_hours').insert(inserts)

  if (insertError) {
    console.error('Insert error:', insertError)
    return new Response('Failed to save working hours', { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: botId } = await context.params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data, error } = await supabase
    .from('working_hours')
    .select('*')
    .eq('user_id', user.id)
    .eq('bot_id', botId)

  if (error) {
    console.error('Fetch error:', error)
    return new Response('Failed to load working hours', { status: 500 })
  }

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
