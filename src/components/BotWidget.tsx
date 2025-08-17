'use client'

import { useEffect, useRef, useState } from 'react' // ⬅️ added useRef
import useChatLogic from './ChatLogic'

export default function BotWidget({ botId }: { botId: string }) {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  
  const {
    messages,
    setMessages,
    input,
    setInput,
    sendMessage,
    botName,
    logoUrl,
    visible,
    setVisible,
    messagesEndRef,
    isTyping,
  } = useChatLogic(botId)

  // ⬇️ NEW: keep track of which iframe src we already announced (success/fallback/close/nudge)
  const announcedIframesRef = useRef<Set<string>>(new Set())
  // ⬇️ NEW: track manual close per src so it stays hidden if component re-mounts
  const closedIframesRef = useRef<Set<string>>(new Set())

  // ⬇️ UPDATED: gate the fallback note so it shows only once per src
  const convertIframeToLink = (index: number) => {
    setMessages(m => {
      const src = (m as any)[index]?.iframe || ''
      const alreadyNotified = announcedIframesRef.current.has(`fail:${src}`)
      const updated = (m as any).map((msg: any, i: number) =>
        i === index && msg.iframe
          ? { ...msg, text: 'Booking opens in a new tab:', link: msg.iframe, iframe: undefined }
          : msg
      )
      if (!alreadyNotified && src) {
        announcedIframesRef.current.add(`fail:${src}`)
        return [
          ...updated,
          { sender: 'bot', text: 'Looks like the provider blocks embedding, so I opened the booking page in a new tab.' }
        ]
      }
      return updated
    })
  }

  // ⬇️ NEW: one-time email nudge helper
  const pushEmailNudgeOnce = (src: string) => {
    if (!src) return
    const key = `nudge:${src}`
    if (announcedIframesRef.current.has(key)) return
    announcedIframesRef.current.add(key)
    setMessages((prev: any[]) => [
      ...prev,
      {
        sender: 'bot',
        text: "Didn't find a time? I can email you the first openings and a quick estimate.",
        buttons: ['Email me times & estimate']
      }
    ])
  }

  // ⬇️ NEW: closable + idle-nudge iframe bubble for msg.iframe
  function EmbedBubble({ src, idx }: { src: string; idx: number }) {
    const [loaded, setLoaded] = useState(false)
    const [visibleCard, setVisibleCard] = useState(!closedIframesRef.current.has(src))

    useEffect(() => {
      if (!visibleCard) return
      // fallback: if not loaded in 4s, convert to link
      const tFallback = setTimeout(() => {
        if (!loaded) convertIframeToLink(idx)
      }, 4000)

      // recovery nudge after 90s if still visible (assume no booking yet)
      const tNudge = setTimeout(() => {
        if (visibleCard) pushEmailNudgeOnce(src)
      }, 90_000)

      return () => {
        clearTimeout(tFallback)
        clearTimeout(tNudge)
      }
    }, [loaded, idx, visibleCard, src])

    if (!visibleCard) return null

    return (
      <div className="relative mt-2">
        {/* Close button */}
        <button
          aria-label="Close calendar"
          className="absolute right-2 top-2 z-10 rounded-full px-2 py-1 text-sm bg-white/90 shadow hover:bg-white"
          onClick={() => {
            setVisibleCard(false)
            closedIframesRef.current.add(src)
            pushEmailNudgeOnce(src)
          }}
        >
          × Close
        </button>

        <iframe
          src={src}
          width="100%"
          height={
            /calendar|schedule|meeting|booking|calendly|tidycal|zoho|vcita|appointlet|cal\.com|youcanbook/i.test(src)
              ? '600'
              : '300'
          }
          style={{
            border: 'none',
            marginTop: '10px',
            borderRadius: '8px',
            display: 'block',
            overflow: 'hidden',
          }}
          className="w-full"
          allow="clipboard-write; fullscreen"
          onLoad={() => {
            if (!loaded) {
              setLoaded(true)
              // ⬇️ Only announce inline-opened once per src even if component remounts
              if (!announcedIframesRef.current.has(`ok:${src}`)) {
                announcedIframesRef.current.add(`ok:${src}`)
                // no extra text bubble; iframe itself is the signal
              }
            }
          }}
        />
      </div>
    )
  }

  // ⬇️ NEW: closable iframe for function_call calendars (show_calendar)
  function FunctionCallCalendar({ src }: { src: string }) {
    const [loaded, setLoaded] = useState(false)
    const [visibleCard, setVisibleCard] = useState(!closedIframesRef.current.has(src))

    useEffect(() => {
      if (!visibleCard) return
      // If not loaded in 4s, post a note and give link
      const tFallback = setTimeout(() => {
        if (!loaded && !announcedIframesRef.current.has(`fail:${src}`)) {
          announcedIframesRef.current.add(`fail:${src}`)
          setMessages((prev: any[]) => [
            ...prev,
            { sender: 'bot', text: 'Looks like the provider blocks embedding, so I opened the booking page in a new tab.', link: src }
          ])
        }
      }, 4000)

      const tNudge = setTimeout(() => {
        if (visibleCard) pushEmailNudgeOnce(src)
      }, 90_000)

      return () => {
        clearTimeout(tFallback)
        clearTimeout(tNudge)
      }
    }, [loaded, visibleCard, src])

    if (!visibleCard) return null

    return (
      <div className="relative mt-2">
        <button
          aria-label="Close calendar"
          className="absolute right-2 top-2 z-10 rounded-full px-2 py-1 text-sm bg-white/90 shadow hover:bg-white"
          onClick={() => {
            setVisibleCard(false)
            closedIframesRef.current.add(src)
            pushEmailNudgeOnce(src)
          }}
        >
          × Close
        </button>

        <iframe
          src={src}
          width="100%"
          height="600"
          style={{
            border: 'none',
            marginTop: '10px',
            borderRadius: '8px',
            display: 'block',
            overflow: 'hidden',
          }}
          className="w-full"
          allow="camera; microphone; clipboard-write"
          onLoad={() => {
            setLoaded(true)
            if (!announcedIframesRef.current.has(`ok:${src}`)) {
              announcedIframesRef.current.add(`ok:${src}`)
              // no extra text bubble
            }
          }}
        />
      </div>
    )
  }

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group z-50"
      >
        <div className="w-12 h-12 rounded-full shadow-lg overflow-hidden border border-gray-300 bg-white">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Bot Logo"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-xl">
              💬
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[350px] md:h-[500px] bg-white md:rounded-lg shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white md:rounded-t-lg">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full shadow-lg overflow-hidden border border-gray-200 bg-white">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Bot Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="bg-blue-600 w-full h-full flex items-center justify-center text-white text-xl">
                💬
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{botName}</h3>
            <p className="text-xs text-green-600">● Online</p>
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors duration-150"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-sm text-gray-800 space-y-3 bg-white">
        {messages.map((msg: any, idx: number) => (
          <div
            key={idx}
            className={`flex gap-2 items-start ${msg.sender === 'bot' ? 'self-start' : 'self-end'}`}
          >
            {msg.sender === 'bot' && logoUrl && (
              <img
                src={logoUrl}
                alt="Bot Logo"
                className="w-8 h-8 rounded-full border border-gray-300 mt-1"
              />
            )}
            <div
              className={`px-4 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                msg.iframe ? 'w-full max-w-full' : 'max-w-[75%]'
              } ${
                msg.sender === 'bot' ? 'bg-gray-100 text-black' : 'bg-blue-600 text-white'
              }`}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: String(msg.text || '').replace(
                    /(https?:\/\/[^\s<>"')\]]+)/g,
                    (rawUrl) => {
                      const cleanedUrl = rawUrl.replace(/[.)\],]+$/, '')
                      return `<a href="${cleanedUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${cleanedUrl}</a>`
                    }
                  ),
                }}
              ></div>

              {msg.iframe && (
                <EmbedBubble src={msg.iframe} idx={idx} />
              )}

              {msg.function_call?.name === 'show_calendar' && (
                <FunctionCallCalendar
                  src={(() => {
                    try {
                      return JSON.parse(msg.function_call.arguments).url
                    } catch {
                      return ''
                    }
                  })()}
                />
              )}

              {msg.link && (
                <a
                  href={msg.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline block mt-2"
                >
                  Open Booking Page
                </a>
              )}

              {/* ⬇️ UPDATED: Render CTAs (from API) + buttons (legacy) together */}
              {(() => {
                // Collect labels from both formats:
                const labelsFromButtons = Array.isArray(msg.buttons) ? msg.buttons : []
                const labelsFromCtas = Array.isArray(msg.ctas) ? msg.ctas.map((c: any) => c.label) : []
                const uniqueLabels = [...new Set([...labelsFromButtons, ...labelsFromCtas])].filter(Boolean)

                if (uniqueLabels.length === 0) return null
                return (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {uniqueLabels.map((label: string, i: number) => (
                      <button
                        key={`${label}-${i}`}
                        onClick={() => sendMessage(label, weekday)}  // send label as next user message
                        className="bg-gray-200 text-sm px-3 py-1 rounded-full hover:bg-gray-300"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-2 items-start">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Bot Logo"
                className="w-8 h-8 rounded-full border border-gray-300 mt-1"
              />
            )}
            <div className="px-4 py-2 bg-gray-100 rounded-xl text-sm max-w-[75%] flex gap-1 items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:.1s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:.2s]"></div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t bg-white flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(undefined, weekday)
            }
          }}
          placeholder="Type your message..."
          rows={1}
          className="w-full resize-none overflow-hidden px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 max-h-40"
        />
        <button
          onClick={() => sendMessage(undefined, weekday)}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
