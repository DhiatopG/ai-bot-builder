'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

interface Conversation {
  question: string;
  created_at: string;
}

export default function DailySummaryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<{ question: string; count: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const loadSummaryForDate = useCallback(async (date: string) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('conversations')
      .select('question, created_at')
      .eq('user_id', session?.user?.email || '')
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
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user?.email) {
      router.replace('/login');
      return;
    }
    loadSummaryForDate(selectedDate);
  }, [status, session, selectedDate, loadSummaryForDate, router]);

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
    <div className="p-6">
      <button onClick={() => router.back()} className="text-white hover:text-gray-400 mb-4">
        <X size={24} />
      </button>

      <h1 className="text-2xl font-bold mb-4">Daily Summary</h1>

      <label className="block mb-2 text-sm text-gray-400">Choose date:</label>
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
