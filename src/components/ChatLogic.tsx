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
  const [isTyping, setIsTyping] = useState(false) // Added typing indicator state
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
      const { data } = await supabase.from('bots').select('logo_url, calendar_url, bot_name').eq('id', botId).single()
      setLogoUrl(data?.logo_url || '')
      setCalendarUrl(data?.calendar_url || '')
      setBotName(data?.bot_name || 'Assistant')
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

  const sendMessage = async (optionalInput?: string) => {
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
        setMessages((prev) => [...prev, { sender: 'bot', text: 'No problem! Feel free to ask anything.' }])
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
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Thanks! Feel free to ask anything now.' }])

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

    // Prepare for API call
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
    isTyping, // Added to return values
  }
}