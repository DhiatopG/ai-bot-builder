'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'
import {
  ExternalLink,
  Zap,
  Settings,
  Database,
  Grid3X3,
  X
} from 'lucide-react'

const integrations = [
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect your bots to 5,000+ apps and automate workflows without coding.',
    icon: Zap,
    color: 'bg-orange-500',
    status: 'Available',
    features: ['Trigger automations', 'Multi-step workflows', '5000+ app connections'],
    buttonText: 'Connect Zapier'
  },
  {
    id: 'make',
    name: 'Make',
    description: 'Build complex automation scenarios with visual workflow builder.',
    icon: Settings,
    color: 'bg-purple-500',
    status: 'Available',
    features: ['Visual workflow builder', 'Advanced logic', 'Real-time execution'],
    buttonText: 'Connect Make'
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Store and manage your bot data in flexible, spreadsheet-database hybrid.',
    icon: Grid3X3,
    color: 'bg-yellow-500',
    status: 'Available',
    features: ['Flexible database', 'Rich field types', 'Collaboration tools'],
    buttonText: 'Connect Airtable'
  },
  {
    id: 'nocodb',
    name: 'NocoDB',
    description: 'Open source Airtable alternative for managing your bot data and workflows.',
    icon: Database,
    color: 'bg-green-500',
    status: 'Available',
    features: ['Open source', 'Self-hosted option', 'REST & GraphQL APIs'],
    buttonText: 'Connect NocoDB'
  }
]

export default function IntegrationsPage() {
  const router = useRouter()

  useEffect(() => {
    const fetchBots = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) return

      await supabase
        .from('bots')
        .select('*')
        .eq('user_id', user.id)
    }

    fetchBots()
  }, [])

  return (
    <div className="flex-1 bg-gray-50 min-h-screen">
      <div className="p-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
            <p className="text-gray-600">Connect your bots with external services and databases</p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Browse All Integrations
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Integrations</p>
                <p className="text-2xl font-bold text-gray-900">4</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Settings className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Workflows</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Data Sources</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <ExternalLink className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">API Calls Today</p>
                <p className="text-2xl font-bold text-gray-900">1,247</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {integrations.map((integration) => {
            const Icon = integration.icon
            return (
              <div
                key={integration.id}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`p-3 ${integration.color} rounded-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-xl font-semibold text-gray-900">{integration.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                          {integration.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-4">{integration.description}</p>

                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Key Features:</h4>
                    <ul className="space-y-1">
                      {integration.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex space-x-3">
                    {integration.id === 'airtable' ? (
                      <Link
                        href="/dashboard/integrations/airtable"
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
                      >
                        {integration.buttonText}
                      </Link>
                    ) : integration.id === 'make' ? (
                      <Link
                        href="/dashboard/integrations/make"
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
                      >
                        {integration.buttonText}
                      </Link>
                    ) : integration.id === 'zapier' ? (
                      <Link
                        href="/dashboard/integrations/zapier"
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
                      >
                        {integration.buttonText}
                      </Link>
                    ) : (
                      <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                        {integration.buttonText}
                      </button>
                    )}
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}