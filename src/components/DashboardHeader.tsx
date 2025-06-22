'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DashboardHeader() {
  const router = useRouter();

  return (
    <header className="bg-[#003366] text-white p-4 shadow">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">AI Bot Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard/leads')}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            View Leads
          </button>
          <button
            onClick={() => signOut()}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
