'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (!isLogin) {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const result = await res.json();

      if (!result.success) {
        setError(result.message || 'Signup failed');
        setLoading(false);
        return;
      }
    }

    const loginRes = await signIn('credentials', {
      redirect: false,
      email,
      password,
      callbackUrl: '/dashboard',
    });

    if (loginRes?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/dashboard');
    }

    setLoading(false);
  };

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
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-[#003366] text-white py-2 rounded-md hover:bg-[#002244]"
        >
          {loading
            ? 'Please wait...'
            : isLogin
            ? 'Login with Email'
            : 'Create Account'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      <div className="text-center text-sm text-gray-500">
        {isLogin ? (
          <>
            Don’t have an account?{' '}
            <button
              onClick={() => setIsLogin(false)}
              className="text-[#00BFFF] underline"
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              onClick={() => setIsLogin(true)}
              className="text-[#00BFFF] underline"
            >
              Log in
            </button>
          </>
        )}
      </div>

      <div className="text-center text-sm text-gray-400">— or —</div>

      <button
        onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
        className="w-full bg-black text-white py-2 rounded-md hover:bg-gray-900"
      >
        Continue with GitHub
      </button>
    </div>
  );
}
