'use client'

import { useEffect, useState } from 'react'
import { User, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/client'

export default function AccountSettings() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (user) {
        setEmail(user.email || '')
        setFullName(user.user_metadata?.full_name || '')
      }
    }

    fetchUser()
  }, [])

  const handleSave = async () => {
    setSaving(true)

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    await fetch('/api/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_id: user.id,
        full_name: fullName
      })
    })

    setSaving(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <User className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Account Settings</h3>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-2 border rounded"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-4 py-2 border bg-gray-100 text-gray-500 rounded"
          />
        </div>

        {/* Optional: Change password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 pr-10 border rounded"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
