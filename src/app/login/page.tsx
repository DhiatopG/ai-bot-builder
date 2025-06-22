'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signup' | 'login'>('login')

  const handleAuth = async () => {
    if (mode === 'signup') {
      const res = await fetch('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await res.json()
      if (!result.success) {
        setError(result.message)
        return
      }
    }

    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/dashboard',
      redirect: true,
    })

    if (!result || result.error) {
      setError('Login failed')
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm space-y-4">
        <h2 className="text-xl font-semibold text-center">{mode === 'login' ? 'Login' : 'Sign Up'}</h2>
        <input
          type="email"
          placeholder="Email"
          className="w-full border border-gray-300 px-4 py-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border border-gray-300 px-4 py-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={handleAuth}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          {mode === 'login' ? 'Login' : 'Sign Up'}
        </button>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            className="w-full bg-black text-white py-2 rounded"
          >
            Continue with GitHub
          </button>
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
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
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
