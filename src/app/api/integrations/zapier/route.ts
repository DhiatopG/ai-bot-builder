import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: async (name) => {
            return (await cookies()).get(name)?.value
          },
          set: () => {},
          remove: () => {},
        },
      }
    )

    const body = await req.json()
    const { bot_id, webhook_url } = body

    if (!bot_id || !webhook_url) {
      return NextResponse.json({ error: 'Missing bot_id or webhook_url' }, { status: 400 })
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('integrations_zapier')
      .upsert(
        {
          bot_id,
          webhook_url,
          user_id: user.id,
        },
        { onConflict: 'bot_id' }
      )

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Unhandled error in POST /zapier:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: async (name) => {
            return (await cookies()).get(name)?.value
          },
          set: () => {},
          remove: () => {},
        },
      }
    )

    const { searchParams } = new URL(req.url)
    const bot_id = searchParams.get('bot_id')

    if (!bot_id) {
      return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('integrations_zapier')
      .select('webhook_url')
      .eq('bot_id', bot_id)
      .maybeSingle()

    if (error) {
      console.error('GET /zapier error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err: any) {
    console.error('Unhandled error in GET /zapier:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
