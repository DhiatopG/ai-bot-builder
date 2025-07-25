'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Lead {
  id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/login');
        return;
      }

      setSession(data.session);
      const userEmail = data.session.user.email;
      if (userEmail) {
        fetch('/api/lead', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ user_id: userEmail }),
})
  .then((res) => res.json())
  .then((data) => {
    setLeads(data.leads || []);
    setLoading(false);
  });

      }
    };

    fetchSession();
  }, [router]);

  if (!session) return <p className="p-4 text-red-500">Access denied. Please log in.</p>;

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 max-w-4xl mx-auto relative">
      <button
        onClick={() => router.push('/dashboard')}
        className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-xl font-bold"
      >
        ✕
      </button>

      <h1 className="text-2xl font-bold mb-4">Leads Captured</h1>
      {loading ? (
        <p className="text-gray-600">Loading leads...</p>
      ) : leads.length === 0 ? (
        <p className="text-gray-500">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border-b">Name</th>
                <th className="text-left p-2 border-b">Email</th>
                <th className="text-left p-2 border-b">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{lead.name}</td>
                  <td className="p-2">{lead.email}</td>
                  <td className="p-2 text-sm text-gray-500">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
