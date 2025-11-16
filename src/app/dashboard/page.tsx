'use client'

import {
  Home,
  Bot,
  Users,
  Upload,
  BarChart3,
  Settings,
  HelpCircle,
  Menu,
  X,
  LogOut,
  Calendar,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/client'
import toast from 'react-hot-toast'
import { useProtectedPage } from '@/hooks/useProtectedPage'

// NEW: monthly appointments stat component
import AllAppointmentsSuccessStat from '@/components/AllAppointmentsSuccessStat'

// NEW: mount the first-login tour
import FirstLoginTour from '@/components/onboarding/FirstLoginTour'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading } = useProtectedPage()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [bots, setBots] = useState<any[]>([])

  // ------- helpers for profile card -------
  const { displayName, displayEmail, initials } = useMemo(() => {
    const email = user?.email ?? ''
    const meta: any = (user?.user_metadata as any) || {}

    // Try common Google fields that Supabase fills
    const nameFromMeta =
      meta.full_name ||
      meta.name ||
      [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim()

    const fallbackName = email ? email.split('@')[0] : ''
    const finalName = (nameFromMeta || fallbackName || '').toString()

    // Build initials from name → else from email username → else "--"
    const derivedInitials = (() => {
      const n = finalName.trim()
      if (n) {
        const parts = n.split(/\s+/).slice(0, 2)
return parts.map((p: string) => p[0]?.toUpperCase() ?? '').join('') || '--'
      }
      if (email) {
        const u = email.split('@')[0]
        return u.slice(0, 2).toUpperCase()
      }
      return '--'
    })()

    return {
      displayName: finalName || '—',
      displayEmail: email || '—',
      initials: derivedInitials,
    }
  }, [user])

  // Load user's bots
  useEffect(() => {
    if (!user) return

    const loadBots = async () => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('user_id', user.id)

      if (!error) setBots(data || [])
    }
    loadBots()
  }, [user])

  if (loading) {
    return <div className="p-8">Loading your dashboard...</div>
  }

  const handleDelete = async (botId: string) => {
    const confirmed = confirm('Are you sure you want to delete this bot?')
    if (!confirmed) return

    const res = await fetch('/api/delete-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_id: botId }),
    })

    if (res.ok) {
      setBots((prev) => prev.filter((b) => b.id !== botId))
    }
  }

  const handleLogout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Added tour keys per item so we can attach data-tour
  const navItems = [
    { icon: Home,  label: 'Dashboard',    path: '/dashboard',                 tourKey: 'nav-dashboard' },
    { icon: Bot,   label: 'Bots',         path: '/dashboard/bots',            useLink: true, tourKey: 'nav-bots' },
    { icon: Users, label: 'Leads',        path: '/dashboard/leads',           tourKey: 'nav-leads' },
    { icon: Upload,label: 'Upload',       path: '/dashboard/upload',          useLink: true, tourKey: 'nav-upload' }, // used as "Knowledge"
    { icon: BarChart3, label: 'Analytics', path: '/dashboard',                tourKey: 'nav-analytics' },
    { icon: Bot,   label: 'Integrations', path: '/dashboard/integrations',    tourKey: 'nav-integrations' },
    { icon: Settings, label: 'Settings',  path: '/dashboard/settings',        useLink: true, tourKey: 'nav-settings' },
    { icon: Calendar, label: 'Calendar',  path: '/dashboard/calendar',        useLink: true, tourKey: 'nav-calendar' },
{ icon: HelpCircle, label: 'Help', path: '/dashboard/help', useLink: true, tourKey: 'nav-help' },
  ]

  return (
    <div className="min-h-screen flex bg-white">
      {/* Mount the tour globally once */}
      <FirstLoginTour />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#002D62] text-white flex flex-col transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-[#003875] flex items-center justify-between">
          <h1 className="text-xl font-bold">BotBuilder Pro</h1>
          <button
            className="lg:hidden text-white hover:text-gray-300"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item, i) => (
              <li key={i}>
                {item.useLink ? (
                  <Link
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-[#003875] hover:text-white transition-colors"
                    data-tour={item.tourKey}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      router.push(item.path)
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-[#003875] hover:text-white transition-colors"
                    data-tour={item.tourKey}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Profile + Logout */}
        <div className="p-4 border-t border-[#003875]">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-[#1E90FF] rounded-full flex items-center justify-center text-sm font-medium">
              {initials}
            </div>
            <div>
              {/* These come from Google via Supabase (openid/email/profile) */}
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-gray-400">{displayEmail}</p>
            </div>
          </div>
          <button
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-[#003875] hover:text-white transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:ml-0">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 lg:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden text-[#002D62] hover:text-[#1E90FF]"
              >
                <Menu size={24} />
              </button>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[#002D62]">
                  Dashboard
                </h1>
                <p className="text-sm lg:text-base text-[#708090] mt-1">
                  Manage your AI chatbots and monitor performance
                </p>
              </div>
            </div>
            <div className="flex items-center">
              {/* NEW: Replay tour button (added, nothing else changed) */}
              <button
                onClick={() => (window as any)?.replayIn60Tour?.()}
                className="border border-[#1E90FF] text-[#1E90FF] px-3 lg:px-4 py-2 rounded-lg text-sm lg:text-base hover:bg-[#EAF4FF] transition-colors mr-2"
                title="Replay onboarding tour"
              >
                Replay tour
              </button>

              <button
                onClick={() => router.push('/dashboard/create')}
                className="bg-[#1E90FF] text-white px-3 lg:px-6 py-2 lg:py-3 rounded-lg text-sm lg:text-base hover:bg-[#1873CC] transition-colors"
                data-tour="btn-create-bot"
              >
                Create New Bot
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-100">
              <p className="text-xs lg:text-sm text-[#708090] mb-1">Total Bots</p>
              <div className="text-xl lg:text-2xl font-bold text-[#002D62]">{bots.length}</div>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-100">
              <p className="text-xs lg:text-sm text-[#708090] mb-1">Active Conversations</p>
              <div className="text-xl lg:text-2xl font-bold text-[#002D62]">--</div>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-100">
              <p className="text-xs lg:text-sm text-[#708090] mb-1">Messages Today</p>
              <div className="text-xl lg:text-2xl font-bold text-[#002D62]">--</div>
            </div>

            <Link href="/dashboard/appointments" className="block">
              <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
                <p className="text-xs lg:text-sm text-[#708090] mb-1">
                  Appointment Success (This Month)
                </p>
                <div className="text-xl lg:text-2xl font-bold text-[#002D62]">
                  {/* Monthly bookings across all bots */}
                  <AllAppointmentsSuccessStat botIds={bots.map(b => b.id)} />
                </div>
              </div>
            </Link>
          </div>

          <div className="mb-4 lg:mb-6">
            <h2 className="text-xl lg:text-2xl font-bold text-[#002D62] mb-2">
              Your Bots
            </h2>
            <p className="text-sm lg:text-base text-[#708090]">
              Manage and monitor your AI chatbots
            </p>
          </div>

          {bots.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center text-[#708090]">
              No bots created yet.
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {bots.map((bot) => (
                <li key={bot.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow">
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">{bot.bot_name}</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Created{' '}
                    {new Date(bot.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <label className="block text-xs text-gray-500 mb-1">Embed Script</label>
                  <div className="relative mb-4">
                    <input
                      readOnly
                      value={`<script src="https://in60second.net/embed.js" data-user="${bot.id}" defer></script>`}
                      className="w-full text-xs border rounded px-3 py-2 pr-10 bg-gray-50 text-gray-700 font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `<script src="https://in60second.net/embed.js" data-user="${bot.id}" defer></script>`
                        )
                        toast.success('✅ Embed script copied to clipboard!')
                      }}
                      className="absolute top-1/2 right-2 transform -translate-y-1/2 text-[11px] px-2 py-[2px] bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/bots/${bot.id}/edit`)}
                      className="px-4 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(bot.id)}
                      className="px-4 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/bots/${bot.id}/test`)}
                      className="px-4 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                    >
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  )
}
