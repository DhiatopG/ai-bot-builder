'use client';
import { useEffect, useMemo, useState } from 'react';

export default function AllAppointmentsSuccessStat({ botIds }: { botIds: string[] }) {
  const [n, setN] = useState<number | null>(null);
  const key = useMemo(() => botIds.join(','), [botIds]);

  const { fromISO, toISO } = useMemo(() => {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const to   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    return {
      fromISO: from.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      toISO:   to.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
  }, []);

  useEffect(() => {
    if (!botIds?.length) { setN(0); return; }

    const params = new URLSearchParams();
    params.set('botIds', key);
    params.set('from', fromISO);
    params.set('to',   toISO);

    const url = `/api/appointments/summary?${params.toString()}`;

    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json();
        if (!cancelled) setN(j?.counts?.bookings ?? 0);
      } catch {
        if (!cancelled) setN(0);
      }
    };

    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [key, fromISO, toISO, botIds]);

  return <>{n ?? '—'}</>;
}
