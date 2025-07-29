'use client'

import { useParams } from 'next/navigation'
import BotWidget from '@/components/BotWidget'

export default function BotTestPage() {
  const params = useParams()
  const botId = params.botId as string

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Test Your Bot</h1>
      <div className="max-w-xl mx-auto border rounded-xl shadow p-4">
        <BotWidget botId={botId} />
      </div>
    </div>
  )
}
