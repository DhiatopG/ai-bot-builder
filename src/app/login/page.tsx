'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signup' | 'login'>('login')
  const router = useRouter()

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Email and password required')
      return
    }

    let result
    if (mode === 'signup') {
      result = await supabase.auth.signUp({ email, password })
    } else {
      result = await supabase.auth.signInWithPassword({ email, password })
    }

    if (result.error) {
      setError(result.error.message)
      return
    }

    router.replace('/dashboard')
  }

  const handleGitHubLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://in60second.net/dashboard',
      },
    })
    if (error) {
      setError(error.message)
    }
  }

  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute top-6 left-6">
        <Image src="/logo.png" alt="In60second Logo" width={160} height={50} />
      </div>

      <div className="flex items-center justify-center min-h-screen px-4 pt-20 pb-10">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border">
          <h2 className="text-2xl font-semibold text-center text-[#003366] mb-4">
            {mode === 'login' ? 'Login to In60second' : 'Create your account'}
          </h2>
          <input
            type="email"
            placeholder="Email"
            className="w-full border border-gray-300 px-4 py-2 rounded mb-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full border border-gray-300 px-4 py-2 rounded mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={handleAuth}
            className="w-full bg-[#1F51FF] hover:bg-blue-700 text-white py-2 rounded mb-4"
          >
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
          <div className="flex flex-col gap-2 mb-4">
            <button
              onClick={handleGitHubLogin}
              className="w-full bg-black text-white py-2 rounded"
            >
              Continue with GitHub
            </button>
            <button
              onClick={() => alert('🔒 Google login not yet connected to Supabase')}
              className="w-full bg-red-600 text-white py-2 rounded"
            >
              Continue with Google
            </button>
          </div>
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-sm text-center text-blue-600"
          >
            {mode === 'login' ? 'No account? Sign Up' : 'Have an account? Login'}
          </button>
          {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
        </div>
      </div>

      <footer className="bg-[#003366] text-white text-center py-6 mt-10">
        <p>© 2025 In60second</p>
        <p className="mt-2">
          <Link href="/about" className="underline">About</Link> |{' '}
          <Link href="/contact" className="underline">Contact</Link> |{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link> |{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  )
}
