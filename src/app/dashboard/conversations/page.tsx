'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Conversation {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export default function ConversationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user?.email) {
      router.replace('/login');
      return;
    }

    fetch(`/api/conversations?user_id=${session.user.email}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setConversations(data);
        }
      });
  }, [status, session, router]);

  if (status === 'loading') {
    return <p className="p-6">Loading session...</p>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Visitor Conversations</h1>

      {conversations.length === 0 ? (
        <p className="text-gray-500">No conversations yet.</p>
      ) : (
        <ul className="space-y-4">
          {conversations.map((conv) => (
            <li key={conv.id} className="bg-white p-4 rounded shadow">
              <p className="text-gray-800">
                <strong>Q:</strong> {conv.question}
              </p>
              <p className="text-gray-600 mt-2">
                <strong>A:</strong> {conv.answer}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(conv.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
