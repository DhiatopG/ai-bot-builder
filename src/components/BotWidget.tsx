'use client'

import { useState } from 'react'

interface BotWidgetProps {
  botName?: string
  logoUrl?: string
}

export default function BotWidget({ botName = "AI Assistant", logoUrl }: BotWidgetProps) {
  const [show, setShow] = useState(true)

  if (!show) return null

  return (
    <div className="fixed inset-0 sm:bottom-4 sm:right-4 sm:left-auto sm:top-auto sm:w-[350px] sm:h-[500px] sm:max-w-[95%] sm:max-h-[90vh] rounded-none sm:rounded-xl shadow-xl bg-white z-50 flex flex-col border border-gray-300">
      {/* Close Button */}
      <button
        onClick={() => setShow(false)}
        className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl font-bold z-50"
      >
        ×
      </button>

      {/* Header with Logo */}
      <div className="flex items-center gap-2 p-3 border-b">
        {logoUrl && (
          <img src={logoUrl} alt="Bot Logo" className="w-8 h-8 rounded-full" />
        )}
        <h2 className="font-semibold text-lg">{botName}</h2>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 text-sm text-gray-800">
        Hello! Ask me anything.
      </div>

      {/* Input */}
      <div className="p-2 border-t">
        <input
          type="text"
          placeholder="Type your message..."
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>
    </div>
  )
}
