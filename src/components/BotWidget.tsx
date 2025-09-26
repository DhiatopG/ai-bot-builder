'use client'

import { useEffect, useRef, useState } from 'react'
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
    startNewConversation,
  } = useChatLogic(botId)

  const DEBUG =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('debug') ||
      process.env.NEXT_PUBLIC_DEBUG_CHAT === '1')
  const dlog = (...args: any[]) => { if (DEBUG) console.log('[BotWidget]', ...args) }

  // running inside an iframe (embedded mode)?
  const IN_IFRAME =
    typeof window !== 'undefined' && window.parent && window.parent !== window

  // ---------- ONLY CHANGE THAT MATTERS ----------
  // Host embed.js listens for { type: 'in60:open' | 'in60:close' | 'in60:toggle' }.
  // Keep legacy payload too for safety.
  const notifyParent = (action: 'open' | 'close' | 'toggle') => {
    try {
      if (typeof window === 'undefined' || !window.parent || window.parent === window) return
      const map = { open: 'in60:open', close: 'in60:close', toggle: 'in60:toggle' } as const
      // expected by host
      window.parent.postMessage({ type: map[action] }, '*')
      // legacy schema (optional)
      window.parent.postMessage({ source: 'in60', type: action }, '*')
    } catch (e) {
      if (DEBUG) console.warn('[BotWidget] notifyParent failed:', e) // <-- not empty now
    }
  }

  useEffect(() => {
    notifyParent(visible ? 'open' : 'close')
  }, [visible])

  const announcedIframesRef = useRef<Set<string>>(new Set())
  const closedIframesRef = useRef<Set<string>>(new Set())

  function toEmbedUrl(raw: string) {
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://example.com'
      const u = new URL(raw, base)
      const h = u.hostname.toLowerCase()
      const before = u.toString()

      if (/(^|\.)cal\.com$/.test(h)) u.searchParams.set('embed', 'true')
      if (/(^|\.)tidycal\.com$/.test(h)) u.searchParams.set('embed', 'true')
      if (/(^|\.)youcanbook\.me$/.test(h)) u.searchParams.set('embed', 'true')
      if (/(^|\.)savvycal\.com$/.test(h)) u.searchParams.set('embed', 'true')

      if (/(^|\.)calendly\.com$/.test(h)) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
        u.searchParams.set('embed_domain', host)
        u.searchParams.set('embed_type', 'Inline')
      }

      const after = u.toString()
      if (DEBUG) dlog('toEmbedUrl:', { host: h, before, after, changed: before !== after })
      return after
    } catch (e) {
      if (DEBUG) dlog('toEmbedUrl: failed to parse', { raw, error: String(e) })
      return raw
    }
  }

  const convertIframeToLink = (index: number) => {
    setMessages(m => {
      const src = (m as any)[index]?.iframe || ''
      const alreadyNotified = announcedIframesRef.current.has(`fail:${src}`)
      if (DEBUG) dlog('convertIframeToLink()', { index, src, alreadyNotified })

      const updated = (m as any).map((msg: any, i: number) =>
        i === index && msg.iframe
          ? { ...msg, text: 'Booking provider blocked embedding. Use the button below to open the booking page:', link: msg.iframe, iframe: undefined }
          : msg
      )
      if (!alreadyNotified && src) {
        announcedIframesRef.current.add(`fail:${src}`)
        return [
          ...updated,
          { sender: 'bot', text: 'No problem — tap “Open Booking Page” to continue.' }
        ]
      }
      return updated
    })
  }

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

  function EmbedBubble({ src, idx }: { src: string; idx: number }) {
    const [loaded, setLoaded] = useState(false)
    const [visibleCard, setVisibleCard] = useState(!closedIframesRef.current.has(src))
    const embedSrc = toEmbedUrl(src)

    useEffect(() => {
      if (!visibleCard) return
      if (DEBUG) dlog('EmbedBubble mount', { idx, src, embedSrc, visibleCard })

      const tFallback = setTimeout(() => {
        if (!loaded) {
          if (DEBUG) dlog('EmbedBubble fallback timer fired', { idx, src })
          convertIframeToLink(idx)
        }
      }, 4000)

      const tNudge = setTimeout(() => {
        if (visibleCard) {
          if (DEBUG) dlog('EmbedBubble nudge fired', { idx, src })
          pushEmailNudgeOnce(src)
        }
      }, 90_000)

      return () => {
        clearTimeout(tFallback)
        clearTimeout(tNudge)
        if (DEBUG) dlog('EmbedBubble cleanup', { idx, src })
      }
    }, [loaded, idx, visibleCard, src, embedSrc])

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
          src={embedSrc}
          width="100%"
          height={
            /calendar|schedule|meeting|booking|calendly|tidycal|zoho|vcita|appointlet|cal\.com|youcanbook/i.test(embedSrc)
              ? '600'
              : '300'
          }
          className="w-full"
          style={{ border: 'none', marginTop: '10px', borderRadius: '8px', display: 'block', overflow: 'hidden' }}
          allow="payment; geolocation; microphone; camera; web-share; clipboard-write; fullscreen"
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
          onLoad={() => {
            if (!loaded) {
              if (DEBUG) dlog('EmbedBubble iframe onLoad', { idx, embedSrc })
              setLoaded(true)
              if (!announcedIframesRef.current.has(`ok:${src}`)) {
                announcedIframesRef.current.add(`ok:${src}`)
              }
            }
          }}
          onError={() => {
            if (DEBUG) dlog('EmbedBubble iframe onError', { idx, embedSrc })
            convertIframeToLink(idx)
          }}
        />
      </div>
    )
  }

  function FunctionCallCalendar({ src, idx }: { src: string; idx: number }) {
    const [loaded, setLoaded] = useState(false)
    const [visibleCard, setVisibleCard] = useState(!closedIframesRef.current.has(src))
    const embedSrc = toEmbedUrl(src)

    useEffect(() => {
      if (!visibleCard) return
      if (DEBUG) dlog('FunctionCallCalendar mount', { idx, src, embedSrc, visibleCard })

      const tFallback = setTimeout(() => {
        if (!loaded && !announcedIframesRef.current.has(`fail:${src}`)) {
          announcedIframesRef.current.add(`fail:${src}`)
          if (DEBUG) dlog('FunctionCallCalendar fallback timer fired', { idx, src })
          convertIframeToLink(idx)
        }
      }, 4000)

      const tNudge = setTimeout(() => {
        if (visibleCard) {
          if (DEBUG) dlog('FunctionCallCalendar nudge fired', { idx, src })
          pushEmailNudgeOnce(src)
        }
      }, 90_000)

      return () => {
        clearTimeout(tFallback)
        clearTimeout(tNudge)
        if (DEBUG) dlog('FunctionCallCalendar cleanup', { idx, src })
      }
    }, [loaded, visibleCard, src, idx, embedSrc])

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
          src={embedSrc}
          width="100%"
          height="600"
          className="w-full"
          style={{ border: 'none', marginTop: '10px', borderRadius: '8px', display: 'block', overflow: 'hidden' }}
          allow="payment; geolocation; microphone; camera; web-share; clipboard-write; fullscreen"
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
          onLoad={() => {
            if (DEBUG) dlog('FunctionCallCalendar iframe onLoad', { idx, embedSrc })
            setLoaded(true)
            if (!announcedIframesRef.current.has(`ok:${src}`)) announcedIframesRef.current.add(`ok:${src}`)
          }}
          onError={() => {
            if (DEBUG) dlog('FunctionCallCalendar iframe onError', { idx, embedSrc })
            convertIframeToLink(idx)
          }}
        />
      </div>
    )
  }

  if (!visible) {
    // when embedded, do NOT render the launcher bubble
    if (IN_IFRAME) return null

    return (
      <button
        onClick={() => { setVisible(true); notifyParent('open') }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group z-50"
      >
        <div className="w-12 h-12 rounded-full shadow-lg overflow-hidden border border-gray-300 bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt="Bot Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-xl">💬</div>
          )}
        </div>
      </button>
    )
  }

  // >>> CHANGED STRUCTURE <<<
  // Outer wrapper = transparent & non-interactive.
  // Inner card = the visible white panel.
  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 z-50 flex items-end md:items-stretch justify-end bg-transparent pointer-events-none">
      <div className="md:w-[350px] md:h-[500px] w-full h-full bg-white md:rounded-lg shadow-2xl flex flex-col pointer-events-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white md:rounded-t-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full shadow-lg overflow-hidden border border-gray-200 bg-white">
              {logoUrl ? (
                <img src={logoUrl} alt="Bot Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="bg-blue-600 w-full h-full flex items-center justify-center text-white text-xl">💬</div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{botName}</h3>
              <p className="text-xs text-green-600">● Online</p>
            </div>
          </div>
          <button
            onClick={startNewConversation}
            className="mr-2 px-3 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200"
            title="Start a new chat"
          >
            New chat
          </button>
          <button
            onClick={() => { setVisible(false); notifyParent('close') }}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors duration-150"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-sm text-gray-800 space-y-3 bg-white">
          {messages.map((msg: any, idx: number) => (
            <div key={idx} className={`flex gap-2 items-start ${msg.sender === 'bot' ? 'self-start' : 'self-end'}`}>
              {msg.sender === 'bot' && logoUrl && (
                <img src={logoUrl} alt="Bot Logo" className="w-8 h-8 rounded-full border border-gray-300 mt-1" />
              )}
              <div
                className={`px-4 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  msg.iframe ? 'w-full max-w-full' : 'max-w-[75%]'
                } ${msg.sender === 'bot' ? 'bg-gray-100 text-black' : 'bg-blue-600 text-white'}`}
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

                {msg.iframe && <EmbedBubble src={msg.iframe} idx={idx} />}

                {msg.function_call?.name === 'show_calendar' && (
                  <FunctionCallCalendar
                    src={(() => {
                      try { return JSON.parse(msg.function_call.arguments).url } catch { return '' }
                    })()}
                    idx={idx}
                  />
                )}

                {msg.link && (
                  <a href={msg.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline block mt-2">
                    Open Booking Page
                  </a>
                )}

                {(() => {
                  const labelsFromButtons = Array.isArray(msg.buttons) ? msg.buttons : []
                  const labelsFromCtas = Array.isArray(msg.ctas) ? msg.ctas.map((c: any) => c.label) : []
                  const uniqueLabels = [...new Set([...labelsFromButtons, ...labelsFromCtas])].filter(Boolean)
                  if (uniqueLabels.length === 0) return null
                  return (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {uniqueLabels.map((label: string, i: number) => (
                        <button
                          key={`${label}-${i}`}
                          onClick={() => sendMessage(label, weekday)}
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
              {logoUrl && <img src={logoUrl} alt="Bot Logo" className="w-8 h-8 rounded-full border border-gray-300 mt-1" />}
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
    </div>
  )
}

