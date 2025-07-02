'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/browser';
import DeleteBotButton from './DeleteBotButton';
import EditBotButton from './EditBotButton';
import OpenAsUserButton from './OpenAsUserButton';
import BotNoteEditor from './BotNoteEditor';

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type Conversation = {
  id: string;
  user_id: string;
  bot_id: string;
  lead_name: string;
  lead_email: string;
  question: string;
  answer: string;
  created_at: string;
};

type Bot = {
  id: string;
  user_id: string;
  bot_name: string;
  urls: string;
  description: string;
  airtable_api_key: string;
  airtable_base_id: string;
  airtable_table_name: string;
  note: string;
  created_at: string;
};

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessionAndData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setCurrentEmail(user.email);

      // --- Fetch users ---
      const res = await fetch('/api/admin/users', {
        credentials: 'include',
      });

      if (!res.ok) {
        console.error('Error fetching users:', res.status);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      let userData = null;
      try {
        userData = await res.json();
      } catch (err) {
        console.error('Error parsing users response:', err);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (!Array.isArray(userData?.users)) {
        console.error('Invalid users format:', userData);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setUsers(userData.users);
      setCurrentEmail(userData.currentEmail || user.email);

      // --- Fetch conversations ---
      try {
        const convoRes = await fetch('/api/admin/conversations', {
          credentials: 'include',
        });

        if (!convoRes.ok) {
          console.error('Error fetching conversations:', convoRes.status);
        } else {
          const convoData = await convoRes.json();
          if (Array.isArray(convoData)) setConversations(convoData);
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      }

      // --- Fetch bots ---
      try {
        const botsRes = await fetch('/api/admin/bots', {
          credentials: 'include',
        });

        if (!botsRes.ok) {
          console.error('Error fetching bots:', botsRes.status);
        } else {
          const botsData = await botsRes.json();
          if (Array.isArray(botsData)) setBots(botsData);
        }
      } catch (err) {
        console.error('Error loading bots:', err);
      }

      setLoading(false);
    };

    fetchSessionAndData();
  }, []);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!isAdmin) return <p className="p-6 text-red-500">Access Denied</p>;

  async function updateRole(email: string, role: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, role }),
    });

    const res = await fetch('/api/admin/users', {
      credentials: 'include',
    });

    if (!res.ok) return;

    const updated = await res.json();
    if (Array.isArray(updated?.users)) {
      setUsers(updated.users);
    }
  }

  return (
    <div className="p-6 space-y-8 bg-black min-h-screen text-white">
      {/* All Users */}
      <div>
        <h1 className="text-2xl font-bold mb-4">All Users</h1>
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="bg-white p-4 shadow rounded text-black">
              <p>Email: {u.email}</p>
              <p>Name: {u.name}</p>
              <p>Role: {u.role}</p>
              {currentEmail !== u.email && (
                <button
                  type="button"
                  onClick={() =>
                    updateRole(u.email, u.role === 'admin' ? 'user' : 'admin')
                  }
                  className="mt-2 mr-2 px-3 py-1 rounded bg-blue-600 text-white"
                >
                  Make {u.role === 'admin' ? 'User' : 'Admin'}
                </button>
              )}
              <a
                href={`/dashboard/admin/user/${u.id}`}
                className="mt-2 inline-block px-3 py-1 rounded bg-green-600 text-white"
              >
                Open User Dashboard
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* All Conversations */}
      <div>
        <h1 className="text-2xl font-bold mb-4">All Conversations</h1>
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id} className="bg-gray-100 p-4 rounded text-black">
              <p>User ID: {c.user_id}</p>
              <p>Bot: {c.bot_id}</p>
              <p>Q: {c.question}</p>
              <p>A: {c.answer}</p>
              <p>
                Lead: {c.lead_name} - {c.lead_email}
              </p>
              <p className="text-xs text-gray-600">
                {new Date(c.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* All Bots */}
      <div>
        <h1 className="text-2xl font-bold mb-4">All Bots</h1>
        <ul className="space-y-2">
          {bots.map((b) => (
            <li key={b.id} className="bg-gray-100 p-4 rounded text-black">
              <p>User ID: {b.user_id}</p>
              <p>Bot Name: {b.bot_name}</p>
              <p>URLs: {b.urls}</p>
              <p>Knowledge: {b.description}</p>
              <p>API Key: {b.airtable_api_key?.slice(0, 6)}*****</p>
              <p>Base ID: {b.airtable_base_id}</p>
              <p>Table Name: {b.airtable_table_name}</p>
              <p className="text-xs">
                {new Date(b.created_at).toLocaleString()}
              </p>
              <BotNoteEditor id={b.id} initial={b.note || ''} />
              <div className="flex gap-2 mt-2">
                <DeleteBotButton
                  id={b.id}
                  onDelete={() =>
                    setBots(bots.filter((bot) => bot.id !== b.id))
                  }
                />
                <EditBotButton id={b.id} />
                <OpenAsUserButton id={b.id} userId={b.user_id} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
