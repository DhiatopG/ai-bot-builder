'use client';

import { useEffect, useState } from 'react';

interface Conversation {
  id: string;
  bot_id: string;
  user_id: string;
  lead_name: string;
  lead_email: string;
  question: string;
  answer: string;
  created_at: string;
}

export default function ConversationViewer({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const fetchConversations = async () => {
      const res = await fetch(`/api/conversations?user_id=${userId}`);
      const data = await res.json();
      setConversations(data || []);
    };

    if (userId) {
      fetchConversations();
    }
  }, [userId]);

  return (
    <div className="bg-white border rounded-lg shadow-md p-6">
      <h2 className="text-lg font-bold mb-4">User Conversations</h2>
      {conversations.length === 0 ? (
        <p className="text-gray-500">No conversations found.</p>
      ) : (
        <ul className="space-y-4">
          {conversations.map((conv) => (
            <li key={conv.id} className="bg-gray-50 p-4 rounded shadow-sm">
              <p className="text-sm text-gray-800">
                <strong>{conv.lead_name}:</strong> {conv.question}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <strong>Bot:</strong> {conv.answer}
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
