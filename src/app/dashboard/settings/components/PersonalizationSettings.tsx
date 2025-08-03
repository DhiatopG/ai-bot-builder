'use client'

import { useEffect, useState } from 'react'
import { Palette, Globe, Calendar } from 'lucide-react'
import { supabase } from '@/lib/client'

export default function PersonalizationSettings() {
  const [theme, setTheme] = useState('system')
  const [language, setLanguage] = useState('en')
  const [dateFormat, setDateFormat] = useState('dd/mm/yyyy')
  const [saving, setSaving] = useState(false)

  const themes = ['light', 'dark', 'system']
  const languages = ['en', 'fr', 'ar', 'es', 'de']
  const dateFormats = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd', 'dd-mm-yyyy']

  useEffect(() => {
    const fetchPreferences = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from('users')
        .select('theme, language, date_format')
        .eq('email', user.email)
        .maybeSingle()

      if (data) {
        if (data.theme) setTheme(data.theme)
        if (data.language) setLanguage(data.language)
        if (data.date_format) setDateFormat(data.date_format)
      }
    }

    fetchPreferences()
  }, [])

  const handleSave = async () => {
    setSaving(true)

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    await supabase
      .from('users')
      .update({
        theme,
        language,
        date_format: dateFormat
      })
      .eq('email', user.email)

    setSaving(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Palette className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Personalization</h3>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
          <div className="flex gap-3">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 border rounded ${
                  theme === t
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full border px-4 py-2 rounded"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Date Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            Date Format
          </label>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="w-full border px-4 py-2 rounded"
          >
            {dateFormats.map((df) => (
              <option key={df} value={df}>
                {df.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end pt-4 border-t mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
