// src/components/BotWidget.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import useChatLogic from './ChatLogic'

const ROOT_ID = 'in60-widget-root' // unique wrapper id used for de-duping

// HEIGHT TOKENS used for mobile-safe embed viewport
const CHAT_HEADER_PX = 64   // top bar height
const CHAT_INPUT_PX  = 64   // composer (textarea + send) height

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

  // Debug flag + logger
  const DEBUG =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('debug') ||
      process.env.NEXT_PUBLIC_DEBUG_CHAT === '1')
  const debugRef = useRef<boolean>(DEBUG)
  useEffect(() => { debugRef.current = DEBUG }, [DEBUG])
  const dlog = (...args: any[]) => { if (debugRef.current) console.log('[BotWidget]', ...args) }

  // running inside an iframe (embedded mode)?
  const IN_IFRAME =
    typeof window !== 'undefined' && window.parent && window.parent !== window

  // ----- DEDUP GUARD: ensure only one widget root exists -----
  useEffect(() => {
    try {
      const roots = Array.from(document.querySelectorAll<HTMLElement>(`#${ROOT_ID}`))
      if (roots.length > 1) {
        // keep the newest (last), remove older ones
        roots.slice(0, -1).forEach(n => n.remove())
        if (debugRef.current) console.warn('[BotWidget] removed duplicate roots:', roots.length - 1)
      }
    } catch (e) {
      if (debugRef.current) console.warn('[BotWidget] dedup guard error:', e)
    }
  }, [])

  // ---------- Parent notifier (stable; no DEBUG capture) ----------
  // Host embed.js listens for: in60:open | in60:close | in60:toggle
  const notifyParent = useCallback((action: 'open' | 'close' | 'toggle') => {
    try {
      if (typeof window === 'undefined' || !window.parent || window.parent === window) return
      const map = { open: 'in60:open', close: 'in60:close', toggle: 'in60:toggle' } as const
      window.parent.postMessage({ type: map[action] }, '*')             // current schema
      window.parent.postMessage({ source: 'in60', type: action }, '*')  // legacy schema
    } catch (e) {
      if (debugRef.current) console.warn('[BotWidget] notifyParent failed:', e)
    }
  }, []) // stable reference; no exhaustive-deps warning

  useEffect(() => {
    notifyParent(visible ? 'open' : 'close')
  }, [visible, notifyParent])

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
      if (debugRef.current) dlog('toEmbedUrl:', { host: h, before, after, changed: before !== after })
      return after
    } catch (e) {
      if (debugRef.current) dlog('toEmbedUrl: failed to parse', { raw, error: String(e) })
      return raw
    }
  }

  const convertIframeToLink = (index: number) => {
    setMessages(m => {
      const src = (m as any)[index]?.iframe || ''
      const alreadyNotified = announcedIframesRef.current.has(`fail:${src}`)
      if (debugRef.current) dlog('convertIframeToLink()', { index, src, alreadyNotified })

      const updated = (m as any).map((msg: any, i: number) =>
        i === index && msg.iframe
          ? { ...msg, text: 'Booking provider blocked embedding. Use the button below to open the booking page:', link: msg.iframe, iframe: undefined }
          : msg
      )
      if (!alreadyNotified && src) {
        announcedIframesRef.current.add(`fail:${src}`)
        return [
          ...updated,
          { sender: 'bot', text: 'No problem — tap "Open Booking Page" to continue.' }
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
      if (debugRef.current) dlog('EmbedBubble mount', { idx, src, embedSrc, visibleCard })

      const tFallback = setTimeout(() => {
        if (!loaded) {
          if (debugRef.current) dlog('EmbedBubble fallback timer fired', { idx, src })
          convertIframeToLink(idx)
        }
      }, 4000)

      const tNudge = setTimeout(() => {
        if (visibleCard) {
          if (debugRef.current) dlog('EmbedBubble nudge fired', { idx, src })
          pushEmailNudgeOnce(src)
        }
      }, 90_000)

      return () => {
        clearTimeout(tFallback)
        clearTimeout(tNudge)
        if (debugRef.current) dlog('EmbedBubble cleanup', { idx, src })
      }
    }, [loaded, idx, visibleCard, src, embedSrc])

    if (!visibleCard) return null

    return (
      <div className="relative mt-2 h-full">
        <button
          aria-label="Close calendar"
          className="absolute right-2 top-2 z-10 rounded-lg px-2 py-1 text-sm bg-white/95 shadow-md hover:bg-white transition-colors duration-150"
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
          height="100%"
          className="w-full h-full block"
          style={{ border: 'none', marginTop: '10px', borderRadius: '12px', overflow: 'hidden' }}
          allow="payment; geolocation; microphone; camera; web-share; clipboard-write; fullscreen"
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
          onLoad={() => {
            if (!loaded) {
              if (debugRef.current) dlog('EmbedBubble iframe onLoad', { idx, embedSrc })
              setLoaded(true)
              if (!announcedIframesRef.current.has(`ok:${src}`)) {
                announcedIframesRef.current.add(`ok:${src}`)
              }
            }
          }}
          onError={() => {
            if (debugRef.current) dlog('EmbedBubble iframe onError', { idx, embedSrc })
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
      if (debugRef.current) dlog('FunctionCallCalendar mount', { idx, src, embedSrc, visibleCard })

      const tFallback = setTimeout(() => {
        if (!loaded && !announcedIframesRef.current.has(`fail:${src}`)) {
          announcedIframesRef.current.add(`fail:${src}`)
          if (debugRef.current) dlog('FunctionCallCalendar fallback timer fired', { idx, src })
          convertIframeToLink(idx)
        }
      }, 4000)

      const tNudge = setTimeout(() => {
        if (visibleCard) {
          if (debugRef.current) dlog('FunctionCallCalendar nudge fired', { idx, src })
          pushEmailNudgeOnce(src)
        }
      }, 90_000)

      return () => {
        clearTimeout(tFallback)
        clearTimeout(tNudge)
        if (debugRef.current) dlog('FunctionCallCalendar cleanup', { idx, src })
      }
    }, [loaded, visibleCard, src, idx, embedSrc])

    if (!visibleCard) return null

    return (
      <div className="relative mt-2 h-full">
        <button
          aria-label="Close calendar"
          className="absolute right-2 top-2 z-10 rounded-lg px-2 py-1 text-sm bg-white/95 shadow-md hover:bg-white transition-colors duration-150"
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
          height="100%"
          className="w-full h-full block"
          style={{ border: 'none', marginTop: '10px', borderRadius: '12px', overflow: 'hidden' }}
          allow="payment; geolocation; microphone; camera; web-share; clipboard-write; fullscreen"
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
          onLoad={() => {
            if (debugRef.current) dlog('FunctionCallCalendar iframe onLoad', { idx, embedSrc })
            setLoaded(true)
            if (!announcedIframesRef.current.has(`ok:${src}`)) announcedIframesRef.current.add(`ok:${src}`)
          }}
          onError={() => {
            if (debugRef.current) dlog('FunctionCallCalendar iframe onError', { idx, embedSrc })
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center group z-50"
      >
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white bg-white shadow-lg">
          {logoUrl ? (
            <img src={logoUrl} alt="Bot Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 text-white text-lg">💬</div>
          )}
        </div>
      </button>
    )
  }

  // Outer wrapper = transparent & non-interactive.
  // Inner card = the visible white panel.
  return (
    <div id={ROOT_ID} className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 z-50 flex items-end md:items-stretch justify-end bg-transparent pointer-events-none">
      <div className="md:w-96 md:h-[540px] w-full h-full bg-white md:rounded-2xl shadow-2xl flex flex-col pointer-events-auto md:border md:border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white md:rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-white shadow-sm flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Bot Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 w-full h-full flex items-center justify-center text-white text-sm">💬</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-slate-900 truncate">{botName}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                <p className="text-xs text-slate-500">Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={startNewConversation}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors duration-150 whitespace-nowrap"
              title="Start a new chat"
            >
              New chat
            </button>
            <button
              onClick={() => { setVisible(false); notifyParent('close') }}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors duration-150 text-slate-500 hover:text-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-700 space-y-4 bg-slate-50">
          {messages.map((msg: any, idx: number) => {
            // ---- EMBED MODE (full-bleed, viewport-height) ----
            if (msg.iframe) {
              return (
                <div key={idx} className="w-full">
                  <div className="-mx-4 my-2">
                    <div className="relative bg-transparent border-0 shadow-none rounded-none">
                      <div
                        className="overflow-hidden pb-[env(safe-area-inset-bottom)]"
                        style={{
                          height: `calc(100dvh - ${CHAT_HEADER_PX}px - ${CHAT_INPUT_PX}px)`,
                          minHeight: '60dvh',
                          maxHeight: '100dvh',
                        }}
                      >
                        <EmbedBubble src={msg.iframe} idx={idx} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            // ---- NORMAL BUBBLE MODE ----
            return (
              <div key={idx} className={`flex gap-3 items-end ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                {msg.sender === 'bot' && logoUrl && (
                  <img src={logoUrl} alt="Bot Logo" className="w-6 h-6 rounded-full border border-slate-200 flex-shrink-0" />
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap max-w-xs lg:max-w-sm ${
                    msg.sender === 'bot'
                      ? 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'
                  }`}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: String(msg.text || '').replace(
                        /(https?:\/\/[^\s<>"')\]]+)/g,
                        (rawUrl) => {
                          const cleanedUrl = rawUrl.replace(/[.)\],]+$/, '')
                          return `<a href="${cleanedUrl}" target="_blank" rel="noopener noreferrer" class="${msg.sender === 'bot' ? 'text-blue-600' : 'text-blue-100'} underline">${cleanedUrl}</a>`
                        }
                      ),
                    }}
                  />

                  {msg.function_call?.name === 'show_calendar' && (
                    <FunctionCallCalendar
                      src={(() => {
                        try { return JSON.parse(msg.function_call.arguments).url } catch { return '' }
                      })()}
                      idx={idx}
                    />
                  )}

                  {msg.link && (
                    <a href={msg.link} target="_blank" rel="noopener noreferrer" className={`${msg.sender === 'bot' ? 'text-blue-600' : 'text-blue-100'} underline block mt-2 text-xs font-medium`}>
                      Open Booking Page
                    </a>
                  )}

                  {(() => {
                    // UPDATED: send hidden CTA IDs (e.g., "cancel_appt:<UUID>") instead of labels
                    const ctas = Array.isArray(msg.ctas) ? msg.ctas : [];
                    const buttons = Array.isArray(msg.buttons) ? msg.buttons.map((label: string) => ({ id: label, label })) : [];
                    const items: Array<{ id: string; label: string }> = [
                      ...buttons,
                      ...ctas.map((c: any) => ({ id: c?.id || String(c?.label || ''), label: String(c?.label || c?.id || '') }))
                    ].filter(i => i.label);

                    if (items.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {items.map((it, i) => (
                          <button
                            key={`${it.id}-${i}`}
                            onClick={() => sendMessage(it.id, weekday)}  // <-- send ID, not label
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150 ${
                              msg.sender === 'bot'
                                ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                                : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                            title={it.label}
                          >
                            {it.label}
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}

          {isTyping && (
            <div className="flex gap-3 items-end">
              {logoUrl && <img src={logoUrl} alt="Bot Logo" className="w-6 h-6 rounded-full border border-slate-200 flex-shrink-0" />}
              <div className="px-4 py-2.5 bg-white text-slate-600 rounded-2xl text-sm max-w-xs flex gap-1.5 items-center border border-slate-200 shadow-sm">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:.1s]"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:.2s]"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex gap-2 relative z-[1]">
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
            className="w-full resize-none overflow-hidden px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 max-h-40 text-sm"
          />
          <button
            onClick={() => sendMessage(undefined, weekday)}
            className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl flex items-center justify-center transition-all duration-150 hover:scale-105 shadow-md flex-shrink-0"
            aria-label="Send message"
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
