'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { X } from 'lucide-react';

interface Conversation {
  question: string;
  created_at: string;
}

export default function DailySummaryPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<{ question: string; count: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadSummaryForDate = useCallback(async (date: string) => {
    if (!userEmail) return;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('conversations')
      .select('question, created_at')
      .eq('user_id', userEmail)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (error || !data) return;

    const countMap: { [q: string]: number } = {};
    data.forEach((c: Conversation) => {
      const q = c.question.trim();
      countMap[q] = (countMap[q] || 0) + 1;
    });

    const sorted = Object.entries(countMap)
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count);

    setSummary(sorted);
  }, [userEmail, supabase]);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;

      if (!email) {
        router.replace('/login');
        return;
      }

      setUserEmail(email);
      loadSummaryForDate(selectedDate);
    };

    fetchSession();
  }, [selectedDate, loadSummaryForDate, router, supabase.auth]);

  const downloadSummary = () => {
    if (summary.length === 0) return;

    const content = summary.map(item => `${item.question} (${item.count}×)`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-summary-${selectedDate}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 relative min-h-screen bg-white">
      {/* Fixed Close Icon at Top Right */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 right-4 text-black hover:text-gray-600 transition-colors z-50"
        aria-label="Close"
      >
        <X size={28} className="opacity-100" />
      </button>

      <h1 className="text-2xl font-bold mb-4 text-black">Daily Summary</h1>

      <label className="block mb-2 text-sm text-gray-500">Choose date:</label>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="mb-6 p-2 rounded border border-gray-700 bg-black text-white"
      />

      {summary.length === 0 ? (
        <p className="text-gray-500">No questions asked for this day.</p>
      ) : (
        <>
          <ul className="space-y-3 mb-6">
            {summary.map((item, idx) => (
              <li key={idx} className="bg-white p-4 rounded shadow flex justify-between">
                <span className="text-gray-800">{item.question}</span>
                <span className="text-blue-600 font-semibold">{item.count}×</span>
              </li>
            ))}
          </ul>
          <button
            onClick={downloadSummary}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download Summary
          </button>
        </>
      )}
    </div>
  );
}
