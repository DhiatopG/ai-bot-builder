/// <reference lib="dom" />
'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { supabase } from '@/lib/supabase/browser'
import type { User } from '@supabase/supabase-js'

interface ChatLogicProps {
  botId: string
}

export default function ChatLogic({ botId }: ChatLogicProps) {
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

      // Modified block starts here
      console.log("📤 Sending lead to /api/lead:", {
        bot_id: botId,
        name,
        email: userMessage,
      });

      await axios.post('/api/lead', {
        bot_id: botId,
        name,
        email: userMessage,
      })  
      // Modified block ends here

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
  }

  if (!visible) {
    return (
      <div
        className="fixed bottom-5 right-5 flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-lg cursor-pointer max-w-xs z-50"
        onClick={() => setVisible(true)}
      >
        <div className="text-sm text-gray-800">Hi! How can I help you?</div>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Bot Logo"
            className="w-10 h-10 rounded-full border border-gray-300"
          />
        ) : (
          <button className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg">
            💬
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 w-full max-w-sm h-[80vh] bg-white shadow-xl rounded-2xl flex flex-col overflow-hidden z-50">
      <div className="bg-green-600 text-white px-4 py-3 text-base font-bold flex justify-between items-center">
        <div className="flex items-center gap-2">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Bot Logo"
              className="w-6 h-6 rounded-full border border-white"
            />
          )}
          {botName}
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-white text-xl hover:text-gray-200"
        >
          ×
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white">
        {messages.map((msg, idx) => (
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
              className={`px-4 py-2 rounded-xl text-sm whitespace-pre-wrap max-w-[75%] ${
                msg.sender === 'bot' ? 'bg-gray-100 text-black' : 'bg-green-600 text-white'
              }`}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: msg.text.replace(
                    /(https?:\/\/[^\s<>"')\]]+)/g,
                    (rawUrl) => {
                      const cleanedUrl = rawUrl.replace(/[.)\],]+$/, '')
                      return `<a href="${cleanedUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${cleanedUrl}</a>`
                    }
                  ),
                }}
              ></div>
              {msg.iframe && (
                <iframe
                  src={msg.iframe}
                  width="100%"
                  height="300"
                  style={{ border: 'none', marginTop: '10px', borderRadius: '8px' }}
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
              {msg.buttons && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.buttons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(btn)}
                      className="bg-gray-200 text-sm px-3 py-1 rounded-full hover:bg-gray-300"
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-3 bg-white flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage()
          }}
          placeholder="Type your message..."
          className="flex-1 p-2 rounded-full border border-gray-300 text-sm outline-none"
        />
        <button
          onClick={() => sendMessage()}
          className="bg-green-600 text-white px-4 py-2 rounded-full text-sm"
        >
          Send
        </button>
      </div>
    </div>
  )
}