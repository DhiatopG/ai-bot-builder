// src/lib/chat/cancel/helpers.ts

// Detect a CTA button payload like "cancel_appt:<UUID>"
export function looksLikeCancelCTA(text: string) {
  return /^cancel_appt:/i.test(String(text || '').trim());
}

export function parseCancelId(text: string) {
  const m = String(text || '').trim().match(/^cancel_appt:([a-f0-9-]{8,})/i);
  return m ? m[1] : null;
}

export function userWantsCancel(text: string) {
  const t = String(text || '').toLowerCase();
  return /(cancel|annul|إلغاء|الغاء|can't come|cannot come|can not come|i need to cancel|i want to cancel|cancel my (?:visit|appointment|appt))/i.test(
    t
  );
}

// Build API base from env/headers (server only)
export function apiBaseFromEnv(req: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = (req.headers as any).get?.('host');
  const proto = (req.headers as any).get?.('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : '';
}

// Turn appointments into CTA buttons
export function formatCancelCtas(appts: Array<{ id: string; starts_at: string }>) {
  return appts.map((a) => {
    const when = new Date(a.starts_at);
    const dd = when.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const hh = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { id: `cancel_appt:${a.id}`, label: `Cancel ${dd} ${hh}` };
  });
}

// Basic phone detector used in the flow
export function looksLikePhone(s?: string) {
  return /\+?\d[\d\s().-]{5,}/.test(String(s || ''));
}
