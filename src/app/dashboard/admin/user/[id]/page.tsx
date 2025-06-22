'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function UserDashboardView() {
  const { id } = useParams();
  const router = useRouter();
  const [bots, setBots] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/user-bots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: id })
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBots(data);
      });
  }, [id]);

  return (
    <div className="p-6 bg-black text-white min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">User Dashboard: {id}</h1>

      <button
        onClick={() => router.push('/dashboard/admin')}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        ← Back to Admin Dashboard
      </button>

      {bots.length === 0 && <p>No bots found for this user</p>}

      <ul className="space-y-2">
        {bots.map((b) => (
          <li key={b.id} className="bg-white text-black p-4 rounded shadow space-y-2">
            <p>Bot Name: {b.bot_name}</p>
            <p>URLs: {b.urls}</p>
            <p>Knowledge: {b.description}</p>
            <p>API: {b.airtable_api_key?.slice(0, 6)}*****</p>
            <p>Base: {b.airtable_base_id}</p>
            <p>Table: {b.airtable_table_name}</p>
            <p className="text-xs">{new Date(b.created_at).toLocaleString()}</p>
            <button
              onClick={() => router.push(`/dashboard/bot/${b.id}?as_user=demo-user`)}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Open as User
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
