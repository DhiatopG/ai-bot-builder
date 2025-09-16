/// <reference lib="dom" />
'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { supabase } from '@/lib/supabase/browser'
import type { User } from '@supabase/supabase-js'

export default function useChatLogic(botId: string) {
  const [messages, setMessages] = useState<{
    sender: string
    text: string
    buttons?: string[]
    iframe?: string
    link?: string
    function_call?: {
      name: string
      arguments: string
    }
  }[]>([])

  const [input, setInput] = useState('')
  const [visible, setVisible] = useState(true)
  const [logoUrl, setLogoUrl] = useState('')
  const [calendarUrl, setCalendarUrl] = useState('')
  const [botName, setBotName] = useState('Assistant')
  const [conversationId, setConversationId] = useState<string>('')
  const [user, setUser] = useState<User | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [isBusinessClosed, setIsBusinessClosed] = useState(false)
  const [pendingCalendarLink, setPendingCalendarLink] = useState('')
  const [pendingUserMsg, setPendingUserMsg] = useState('')
  const [, setHasBooked] = useState(false) // eslint fix: ignore unused state value
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const DEBUG =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('debug') ||
      process.env.NEXT_PUBLIC_DEBUG_CHAT === '1')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    setMessages([{ sender: 'bot', text: 'Hi! How can I help you today?' }])
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const fetchData = async () => {
      const { data: botData } = await supabase
        .from('bots')
        .select('logo_url, calendar_url, bot_name')
        .eq('id', botId)
        .single()

      setLogoUrl(botData?.logo_url || '')
      setCalendarUrl(botData?.calendar_url || '')
      setBotName(botData?.bot_name || 'Assistant')

      const { data: hoursData } = await supabase
        .from('working_hours')
        .select('*')
        .eq('bot_id', botId)

      const today = new Date()
      const weekday = today.toLocaleDateString('en-US', { weekday: 'long' })
      const todayHours = hoursData?.find(h => h.day === weekday)

      if (!todayHours || todayHours.closed || !todayHours.start || !todayHours.end) {
        setIsBusinessClosed(true)
        return
      }

      const now = today.getHours() + today.getMinutes() / 60
      const [startH, startM] = todayHours.start.split(':').map(Number)
      const [endH, endM] = todayHours.end.split(':').map(Number)

      const startTime = startH + startM / 60
      const endTime = endH + endM / 60

      setIsBusinessClosed(now < startTime || now > endTime)
    }
    fetchData()
  }, [botId])

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let cid = localStorage.getItem('conversation_id')
      if (cid) {
        setConversationId(cid)
      } else {
        cid = crypto.randomUUID()
        localStorage.setItem('conversation_id', cid)
        setConversationId(cid)
      }
      const bookedFlag = localStorage.getItem(`has_booked:${cid}`)
      if (bookedFlag === 'true') setHasBooked(true)
    }
  }, [])

  const splitConsent = (text: string) => {
    const m = text.match(/(Can I take your name[^?]*\?|Would you like to share your email[^?]*\?)/i)
    if (!m) return { body: text, consent: null }
    const consent = m[0].trim()
    const body = text.replace(m[0], '').trim()
    return { body, consent }
  }

  const startNewConversation = async () => {
    try {
      const newId = crypto.randomUUID()
      if (typeof window !== 'undefined') {
        localStorage.setItem('conversation_id', newId)
        localStorage.removeItem(`has_booked:${newId}`)
      }
      setConversationId(newId)
      setPendingCalendarLink('')
      setPendingUserMsg('')
      setIsTyping(false)
      setMessages([{ sender: 'bot', text: 'Hi! How can I help you today?' }])
      try {
        const session = await supabase.auth.getSession()
        const accessToken = session.data.session?.access_token
        await axios.post(
          '/api/conversations',
          { user_id: botId, conversation_id: newId },
          { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined }
        )
      } catch (e) {
        if (DEBUG) console.warn('[startNewConversation] conversations/start failed:', e)
      }
    } catch (e) {
      console.error('[startNewConversation] failed', e)
    }
  }

  const sendMessage = async (optionalInput?: string, weekday?: string) => {
    const userMessage = optionalInput || input
    if (!userMessage.trim()) return
    const lastBotText = [...messages].reverse().find(m => m.sender === 'bot')?.text || ''
    const askedName  = /what'?s your name|can i take your name/i.test(lastBotText)
    const askedEmail = /best email|share your email/i.test(lastBotText)
    const emailRe    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const visitor_name  = askedName ? userMessage.trim() : undefined
    const visitor_email = (askedEmail || emailRe.test(userMessage.trim())) ? userMessage.trim() : undefined

    setMessages(prev => [...prev, { sender: 'user', text: userMessage }])
    setInput('')

    if (userMessage === 'Open here' && pendingCalendarLink) {
      if (DEBUG) console.log('[ChatLogic] Open here → using pendingCalendarLink', { pendingCalendarLink, pendingUserMsg })
      setIsTyping(true)
      try {
        const formattedHistory = messages
          .filter(m => m.sender === 'user' || m.sender === 'bot')
          .map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          }))
        const session2 = await supabase.auth.getSession()
        const accessToken2 = session2.data.session?.access_token
        const res2 = await axios.post(
          '/api/chat',
          {
            question: pendingUserMsg || 'open calendar',
            user_id: botId,
            history: formattedHistory,
            user_auth_id: user?.id || null,
            conversation_id: conversationId,
            is_after_hours: isBusinessClosed,
            weekday,
            force_embed: true,
            debug: DEBUG,
            visitor_name,
            visitor_email,
          },
          { headers: { Authorization: `Bearer ${accessToken2}` } }
        )

        if (DEBUG) {
          console.log('api/chat reply (open here) →', {
            debugId: res2.headers?.['x-debug-id'],
            _debug: res2.data?._debug,
            answer: res2.data?.answer,
          })
        }

        if (res2.data?.booking_completed) {
          setHasBooked(true)
          localStorage.setItem(`has_booked:${conversationId}`, 'true')
        }

        const aiResponse2 = res2.data?.answer || ''
        const ctas2 = Array.isArray(res2.data?.ctas) ? res2.data.ctas : []
        if (aiResponse2) {
          const { body, consent } = splitConsent(aiResponse2)
          const pieces: typeof messages = []
          if (body) pieces.push({ sender: 'bot', text: body })
          if (consent) pieces.push({ sender: 'bot', text: consent })
          if (ctas2.length) pieces.push({ sender: 'bot', text: '', buttons: ctas2.map((c: any) => c.label) })
          if (pieces.length) {
            setMessages(prev => [...prev, ...pieces])
          } else {
            setMessages(prev => [...prev, { sender: 'bot', text: aiResponse2 }])
          }
        }

        if (res2.data?.iframe) {
          if (DEBUG) console.log('[ChatLogic] enqueue iframe', res2.data.iframe)
          setMessages(prev => [...prev, { sender: 'bot', text: '', iframe: res2.data.iframe }])
        } else if (res2.data?.calendar_link) {
          if (DEBUG) console.log('[ChatLogic] enqueue iframe from calendar_link', res2.data.calendar_link)
          setMessages(prev => [...prev, { sender: 'bot', text: '', iframe: res2.data.calendar_link }])
        }
      } catch (_e) {
        setMessages(prev => [...prev, { sender: 'bot', text: 'Sorry, I encountered an error. Please try again.' }])
      } finally {
        setPendingCalendarLink('')
        setPendingUserMsg('')
        setIsTyping(false)
      }
      return
    }

    if (userMessage === 'Open in new tab' && pendingCalendarLink) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Open Booking Page:', link: pendingCalendarLink }])
      setPendingCalendarLink('')
      setPendingUserMsg('')
      return
    }

    setIsTyping(true)
    try {
      const formattedHistory = messages
        .filter(m => m.sender === 'user' || m.sender === 'bot')
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }))

      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token

      if (DEBUG) {
        console.log('[ChatLogic] → /api/chat request', {
          question: userMessage,
          hasHistory: formattedHistory.length,
          is_after_hours: isBusinessClosed,
          weekday,
          conversation_id: conversationId
        })
      }

      const res = await axios.post(
        '/api/chat',
        {
          question: userMessage,
          user_id: botId,
          history: formattedHistory,
          user_auth_id: user?.id || null,
          conversation_id: conversationId,
          is_after_hours: isBusinessClosed,
          weekday,
          debug: DEBUG,
          visitor_name,
          visitor_email,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (DEBUG) {
        console.log('api/chat reply →', {
          debugId: res.headers?.['x-debug-id'],
          flags: {
            need_calendar_confirm: !!res.data?.need_calendar_confirm,
            has_iframe: !!res.data?.iframe,
            has_calendar_link: !!res.data?.calendar_link,
            has_link: !!res.data?.link
          },
          ctas_len: Array.isArray(res.data?.ctas) ? res.data.ctas.length : 0,
          answer_sample: typeof res.data?.answer === 'string' ? res.data?.answer.slice(0, 120) : null
        })
      }

      if (res.data?.booking_completed) {
        setHasBooked(true)
        localStorage.setItem(`has_booked:${conversationId}`, 'true')
      }

      const aiResponse = res.data?.answer || 'Sorry, I couldn’t find an answer.'
      const ctas = Array.isArray(res.data?.ctas) ? res.data.ctas : []

      const { body, consent } = splitConsent(aiResponse)
      const pieces: typeof messages = []
      if (body) pieces.push({ sender: 'bot', text: body })
      if (consent) pieces.push({ sender: 'bot', text: consent })
      if (ctas.length) pieces.push({ sender: 'bot', text: '', buttons: ctas.map((c: any) => c.label) })

      if (pieces.length) {
        setMessages(prev => [...prev, ...pieces])
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: aiResponse }])
      }

      if (res.data?.need_calendar_confirm && res.data?.calendar_link) {
        if (DEBUG) console.log('[ChatLogic] need_calendar_confirm', res.data.calendar_link)
        setPendingCalendarLink(res.data.calendar_link)
        setPendingUserMsg(userMessage)
        setMessages(prev => [...prev, { sender: 'bot', text: 'Open the calendar here?', buttons: ['Open here', 'Open in new tab'] }])
        setIsTyping(false)
        return
      }

      if (res.data?.iframe) {
        if (DEBUG) console.log('[ChatLogic] enqueue iframe', res.data.iframe)
        setMessages(prev => [...prev, { sender: 'bot', text: '', iframe: res.data.iframe }])
      } else if (res.data?.calendar_link) {
        if (DEBUG) console.log('[ChatLogic] enqueue iframe from calendar_link', res.data.calendar_link)
        setMessages(prev => [...prev, { sender: 'bot', text: '', iframe: res.data.calendar_link }])
      }
      if (res.data?.link && !res.data?.calendar_link) {
        setMessages(prev => [...prev, { sender: 'bot', text: 'Open this page:', link: res.data.link }])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, { sender: 'bot', text: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setIsTyping(false)
    }
  }

  return {
    messages,
    setMessages,
    input,
    setInput,
    sendMessage,
    botName,
    logoUrl,
    visible,
    setVisible,
    calendarUrl,
    conversationId,
    messagesEndRef,
    isTyping,
    startNewConversation,
  }
}
