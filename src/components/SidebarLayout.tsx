'use client';

import { useState } from 'react';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'summary' | 'conversations'>('dashboard');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div
        className={`fixed z-40 inset-y-0 left-0 bg-white shadow-lg w-64 p-6 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0`}
      >
        <h2 className="text-lg font-bold mb-4">📋 Menu</h2>
        <ul className="space-y-4">
          <li>
            <button onClick={() => setView('dashboard')} className="text-blue-600 hover:underline">
              🧭 Dashboard
            </button>
          </li>
          <li>
            <button onClick={() => setView('summary')} className="text-blue-600 hover:underline">
              📌 Daily Summary
            </button>
          </li>
          <li>
            <button onClick={() => setView('conversations')} className="text-blue-600 hover:underline">
              💬 Conversations
            </button>
          </li>
        </ul>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Top Nav */}
        <div className="bg-[#003366] text-white p-4 flex items-center justify-between">
          <button className="lg:hidden text-white text-2xl" onClick={() => setIsOpen(!isOpen)}>
            ☰
          </button>
          <h1 className="text-xl font-semibold">AI Bot Dashboard</h1>
        </div>

        <div className="p-6">
          {view === 'dashboard' && <>{children}</>}
          {view === 'summary' && <div>📌 This is your daily AI summary (we'll connect this soon).</div>}
          {view === 'conversations' && <div>💬 Visitor conversations will appear here (we'll integrate later).</div>}
        </div>
      </div>
    </div>
  );
}
