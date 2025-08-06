import { createServerClient } from '@/lib/supabase/server'
import BotWidget from '@/components/BotWidget'

export default async function BotEmbedPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = await createServerClient() // ✅ Uses shared helper

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
