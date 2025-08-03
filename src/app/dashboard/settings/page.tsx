'use client'

import { useState } from 'react'
import {
  User,
  Trash2,
} from 'lucide-react'
import AccountSettings from './components/AccountSettings';
import PersonalizationSettings from './components/PersonalizationSettings';
import BillingSettings from './components/BillingSettings';
import ConfirmationModal from './components/ConfirmationModal';

export default function SettingsPage() {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleDeleteAccount = () => {
    console.log('Account deleted')
    setShowDeleteModal(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="mt-2 text-gray-600 text-base">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-10">
        {/* Account Settings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Account Settings</h2>
          </div>
          <div className="p-6">
            <AccountSettings />
          </div>
        </div>

        {/* Personalization */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Personalization</h2>
          </div>
          <div className="p-6">
            <PersonalizationSettings />
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Billing & Subscription</h2>
          </div>
          <div className="p-6">
            <BillingSettings />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm">
          <div className="px-6 py-5 border-b border-red-200 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">Danger Zone</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Delete Account</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed."
        confirmText="Delete Account"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />
    </div>
  )
}
