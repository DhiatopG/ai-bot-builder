'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/client'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Lock, Github, Chrome, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signup' | 'login'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleAuth = async () => {
    if (!supabase) {
      setError('Authentication service not available')
      return
    }

    if (!email || !password) {
      setError('Email and password required')
      return
    }

    if (mode === 'signup') {
      const signUpResult = await supabase.auth.signUp({ email, password })

      if (signUpResult.error) {
        setError(signUpResult.error.message)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setError('Session not ready after signup. Please try logging in.')
        return
      }

      router.replace('/dashboard')
    } else {
      const result = await supabase.auth.signInWithPassword({ email, password })

      if (result.error) {
        setError(result.error.message)
        return
      }

      router.replace('/dashboard')
    }
  }

  const insertUserIfNotExists = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()

      if (!existing) {
        await fetch('/api/users/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.user_metadata.full_name || user.user_metadata.name,
            auth_id: user.id,
          }),
        })
      }
    }
  }

  const handleGitHubLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000/auth/callback'
            : 'https://in60second.net/auth/callback',
      },
    })

    if (!error) await insertUserIfNotExists()
    if (error) setError(error.message)
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000/auth/callback'
            : 'https://in60second.net/auth/callback',
      },
    })

    if (!error) await insertUserIfNotExists()
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Image src="/logo.png" alt="in60second Logo" width={64} height={64} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">in60second</h1>
          <p className="text-gray-600">
            {mode === 'login' ? 'Sign in to your AI workspace' : 'Create your AI workspace'}
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAuth()
            }}
            className="space-y-6"
          >
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            {/* Auth Button */}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              {mode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogleLogin}
              className="flex items-center justify-center py-3 border border-gray-300 rounded-lg text-gray-700 text-sm hover:bg-gray-50 transition"
            >
              <Chrome className="h-5 w-5 text-red-500 mr-2" />
              Google
            </button>
            <button
              onClick={handleGitHubLogin}
              className="flex items-center justify-center py-3 border border-gray-300 rounded-lg text-gray-700 text-sm hover:bg-gray-50 transition"
            >
              <Github className="h-5 w-5 text-black mr-2" />
              GitHub
            </button>
          </div>

          {/* Toggle Auth Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {mode === 'login' ? 'No account? Sign up for free' : 'Already have an account? Login'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="text-blue-600 hover:text-blue-700">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
