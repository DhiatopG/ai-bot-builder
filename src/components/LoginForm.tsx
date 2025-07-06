'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'

export default function LoginForm() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/dashboard`,
      },
    })
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    if (!email || !password) {
      setError('Email and password are required')
      setLoading(false)
      return
    }

    let authResult

    if (isLogin) {
      authResult = await supabase.auth.signInWithPassword({ email, password })
    } else {
      authResult = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } }
      })

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (user && !userError) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle()

        if (!existing) {
          await supabase.from('users').insert({
            email: user.email,
            name: user.user_metadata?.name || user.email,
            auth_id: user.id,
          })
        }
      }
    }

    const { error: authError } = authResult
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    await supabase.auth.getSession()
    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md space-y-6">
      <h1 className="text-3xl font-bold text-center text-[#003366]">AI Assistant</h1>

      <div className="space-y-4">
        {!isLogin && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-2 border border-gray-300 rounded-md"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-2 border border-gray-300 rounded-md"
        />
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-[#003366] text-white px-4 py-2 rounded-md w-full"
          disabled={loading}
        >
          {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
        </button>
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-blue-600 hover:underline"
        >
          {isLogin ? 'Need an account? Sign up' : 'Already have an account? Log in'}
        </button>
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          className="w-full mt-4 bg-red-600 text-white py-2 rounded"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
