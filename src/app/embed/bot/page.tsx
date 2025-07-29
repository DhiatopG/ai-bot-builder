import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import BotWidget from '@/components/BotWidget'

export default async function BotEmbedPage({ searchParams }: { searchParams: { id?: string } }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieStore }
  )

  const botId = searchParams.id
  if (!botId) return <div>Missing bot ID</div>

  const { data: bot, error } = await supabase
    .from('bots')
    .select('*')
    .eq('id', botId)
    .maybeSingle()

  if (error || !bot) return <div>Bot not found</div>

  return (
    <div className="h-screen w-screen overflow-hidden">
      <BotWidget botId={botId} />
    </div>
  )
}
