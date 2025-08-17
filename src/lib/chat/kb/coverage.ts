import { normalizeChunks, filterChunks, kbHasConfidentCoverage } from '../utils/rag';

const STOP = new Set(['the','a','an','and','or','for','to','in','of','on','with','at','by','from','about','into','over','after','before','is','are','was','were','be','been','being','this','that','these','those','it','as','we','you','they']);

function toks(s:string){ return String(s||'').toLowerCase().match(/[a-z][a-z0-9'-]{1,}/g)?.filter(w=>!STOP.has(w)) ?? []; }

export function kbCoversQuestion(q: string, kbText: string, chunks: {text:string; score?: number}[]) {
  const normalized = normalizeChunks(chunks as any);
  const filtered = filterChunks(normalized, { max: 5 });
  if (kbHasConfidentCoverage(filtered, 0.72, 400)) return true;
  const qT = toks(q);
  const kbT = new Set(toks(kbText));
  const overlap = qT.filter(t => kbT.has(t)).length;
  const ragHit = (filtered||[]).map(c => (c?.text||'').length).reduce((a,b)=>a+b,0);
  return overlap >= 2 || ragHit > 200;
}
