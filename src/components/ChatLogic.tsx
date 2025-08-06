/// <reference lib="dom" />
'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { supabase } from '@/lib/supabase/browser'
import type { User } from '@supabase/supabase-js'

export default function useChatLogic(botId: string) {
  const [messages, setMessages] = useState<{ sender: string; text: string; buttons?: string[]; iframe?: string; link?: string }[]>([])
  const [input, setInput] = useState('')
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [visible, setVisible] = useState(true)
  const [logoUrl, setLogoUrl] = useState('')
  const [calendarUrl, setCalendarUrl] = useState('')
  const [botName, setBotName] = useState('Assistant')
  const [conversationId, setConversationId] = useState<string>('')
  const [user, setUser] = useState<User | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [isBusinessClosed, setIsBusinessClosed] = useState(false)
  const [notifiedClosed, setNotifiedClosed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

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
      const stored = localStorage.getItem('conversation_id')
      if (stored) {
        setConversationId(stored)
      } else {
        const newId = crypto.randomUUID()
        localStorage.setItem('conversation_id', newId)
        setConversationId(newId)
      }
    }
  }, [])

  const sendMessage = async (optionalInput?: string, weekday?: string) => {
    const userMessage = optionalInput || input
    if (!userMessage.trim()) return

    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }])
    setInput('')

    if (step === 0) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Can I ask for your name?',
          buttons: ['Yes', 'No'],
        },
      ])
      setStep(1)
      return
    }

    if (step === 1) {
      if (userMessage.toLowerCase() === 'yes') {
        setMessages((prev) => [...prev, { sender: 'bot', text: 'What is your name?' }])
        setStep(2)
      } else {
        const followUpMessages = [{ sender: 'bot', text: 'No problem! Feel free to ask anything.' }]
        if (isBusinessClosed && !notifiedClosed) {
          followUpMessages.push({
            sender: 'bot',
            text: 'Our office is currently closed right now, but I’m here to help you anyway!',
          })
          setNotifiedClosed(true)
        }
        setMessages((prev) => [...prev, ...followUpMessages])
        setStep(99)
      }
      return
    }

    if (step === 2) {
      setName(userMessage)
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Thanks! Can I have your email?' }])
      setStep(3)
      return
    }

    if (step === 3) {
      setEmail(userMessage)
      const postLeadMessages = [{ sender: 'bot', text: 'Thanks! Feel free to ask anything now.' }]
      if (isBusinessClosed && !notifiedClosed) {
        postLeadMessages.push({
          sender: 'bot',
          text: 'Our office is currently closed right now, but I’m here to help you anyway!',
        })
        setNotifiedClosed(true)
      }
      setMessages((prev) => [...prev, ...postLeadMessages])

      console.log("📤 Sending lead to /api/lead:", {
        bot_id: botId,
        name,
        email: userMessage,
      })

      await axios.post('/api/lead', {
        bot_id: botId,
        name,
        email: userMessage,
      })

      setStep(99)
      return
    }

    if (userMessage.toLowerCase().includes('book') && calendarUrl) {
      const isIframe = calendarUrl.includes('calendly.com') || calendarUrl.includes('tidio') || calendarUrl.includes('hubspot')
      if (isIframe) {
        setMessages((prev) => [...prev, { sender: 'bot', text: 'You can book here:', iframe: calendarUrl }])
      } else {
        setMessages((prev) => [...prev, { sender: 'bot', text: 'You can book using this link:', link: calendarUrl }])
      }
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

      const res = await axios.post(
        '/api/chat',
        {
          question: userMessage,
          user_id: botId,
          name,
          email,
          history: formattedHistory,
          user_auth_id: user?.id || null,
          conversation_id: conversationId,
          is_after_hours: isBusinessClosed,
          weekday,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const aiResponse = res.data?.answer || 'Sorry, I couldn’t find an answer.'
      setMessages((prev) => [...prev, { sender: 'bot', text: aiResponse }])
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => [...prev, { 
        sender: 'bot', 
        text: 'Sorry, I encountered an error. Please try again.' 
      }])
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
    name,
    email,
    messagesEndRef,
    isTyping,
  }
}