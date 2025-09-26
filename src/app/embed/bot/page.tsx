// src/app/embed/bot/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import BotWidget from '@/components/BotWidget'

export default async function BotEmbedPage({
  // In Next 14.2+/15, searchParams is a Promise in Server Components
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const sp = await searchParams
  const botId = sp?.id
  if (!botId) return <div>Missing bot ID</div>

  const supabase = await createServerClient()

  const { data: bot, error } = await supabase
    .from('bots')
    .select('*')
    .eq('id', botId)
    .maybeSingle()

  if (error || !bot) return <div>Bot not found</div>

  return (
    <>
      {/* Route-only guard: keep the embed page truly transparent */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
html, body, #__next, #root { background: transparent !important; }
#in60-backdrop, .in60-backdrop { background: transparent !important; pointer-events: none !important; }
#in60-backdrop.is-open, .in60-backdrop.is-open { background: rgba(0,0,0,.35) !important; pointer-events: auto !important; }
          `,
        }}
      />
      {/* Full-viewport container, transparent */}
      <div
        className="h-screen w-screen overflow-hidden bg-transparent"
        style={{ background: 'transparent' }}
      >
        <BotWidget botId={botId} />
      </div>
    </>
  )
}
