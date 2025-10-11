// src/lib/chat/kb/coverage.ts
import { normalizeChunks, filterChunks, kbHasConfidentCoverage } from '../utils/rag';

// Stopwords kept small so overlap focuses on meaning
const STOP = new Set([
  'the','a','an','and','or','for','to','in','of','on','with','at','by','from',
  'about','into','over','after','before','is','are','was','were','be','been',
  'being','this','that','these','those','it','as','we','you','they','i'
]);

// Service/intent synonyms to catch phrasing differences
const SYNONYMS: Record<string, string[]> = {
  cleaning: ['clean','cleaning','scale','scaling','polish','prophy','deep clean','deep cleaning'],
  whitening: ['whiten','whitening','bleach','brighten','zoom'],
  braces: ['braces','invisalign','aligner','aligners','orthodontic','orthodontics','orthodontist'],
  implants: ['implant','implants','dental implant'],
  rootcanal: ['root canal','endodontic','endodontics','endodontist'],
  crown: ['crown','crowns','cap','caps'],
  veneer: ['veneer','veneers'],
  extraction: ['extraction','extractions','pull tooth','remove tooth','pulled tooth'],
  emergency: ['emergency','urgent','toothache','broken tooth','chipped tooth','swollen','bleeding','same-day'],
  hours: ['hours','open','close','opening','closing','today'],
  pricing: ['price','pricing','cost','fee','fees','how much','quote','estimate'],
  insurance: ['insurance','insure','in-network','out of network','delta','metlife','ppo','hmo'],
  location: ['where','address','location','near','map','directions','direction']
};

function toks(s: string) {
  return String(s || '')
    .toLowerCase()
    .match(/[a-z][a-z0-9'-]{1,}/g)
    ?.filter((w) => !STOP.has(w)) ?? [];
}

function hasPhrase(hay: string, needle: string) {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i').test(hay);
}

function synonymHitCount(q: string, doc: string) {
  let hits = 0;
  for (const syns of Object.values(SYNONYMS)) {
    // count one per group to avoid over-weighting
    if (syns.some((term) => hasPhrase(q, term)) && syns.some((term) => hasPhrase(doc, term))) {
      hits++;
    }
  }
  return hits;
}

export function kbCoversQuestion(
  q: string,
  kbText: string,
  chunks: { text: string; score?: number }[]
) {
  // 1) Respect your existing RAG confidence first
  const normalized = normalizeChunks(chunks as any);
  const filtered = filterChunks(normalized, { max: 5 });
  if (kbHasConfidentCoverage(filtered, 0.72, 400)) return true;

  const qTrim = String(q || '').trim();
  if (!qTrim) return false;

  // 2) Fast paths for structured queries if KB contains those fields
  const asksHours = /\b(hour|open|close|opening|closing|today)\b/i.test(qTrim);
  const asksLocation = /\b(where|address|location|near|map|direction)\b/i.test(qTrim);
  const asksContact = /\b(email|phone|call|contact|reach)\b/i.test(qTrim);

  if (asksHours && /\bhours?\b/i.test(kbText)) return true;
  if (asksLocation && /\b(address|location|map|directions?)\b/i.test(kbText)) return true;
  if (asksContact && /\b(email|phone|contact)\b/i.test(kbText)) return true;

  // 3) Synonym matches (question ↔ KB)
  const synHitsFull = synonymHitCount(qTrim, kbText);
  if (synHitsFull > 0) return true;

  // 4) Token overlap with dynamic threshold (short Q needs fewer matches)
  const qTokens = toks(qTrim);
  if (qTokens.length === 0) return false;
  const kbTokens = new Set(toks(kbText));
  const overlap = qTokens.filter((t) => kbTokens.has(t)).length;

  // Scale threshold: 2 for short queries, ~35% of tokens for longer ones (cap at 6)
  const overlapThreshold = qTokens.length < 6 ? 2 : Math.min(6, Math.ceil(qTokens.length * 0.35));

  // 5) Chunk-level rescue: if any chunk has good overlap OR a synonym hit, count as covered
  const chunkCovered = (filtered || []).some((c) => {
    const ctoks = toks(c.text || '');
    const set = new Set(ctoks);
    const ov = qTokens.filter((t) => set.has(t)).length;
    const syn = synonymHitCount(qTrim, c.text || '');
    // slightly lower per-chunk threshold; short queries need at least 1
    const perChunkThresh = qTokens.length < 6 ? 1 : Math.min(4, Math.ceil(qTokens.length * 0.3));
    return ov >= perChunkThresh || syn > 0;
  });

  // 6) Final decision
  if (chunkCovered) return true;

  // Keep your original coarse fallback as a last resort (helps very short Qs with one strong chunk)
  const ragHitLen = (filtered || []).reduce((a, c) => a + (c?.text?.length || 0), 0);
  const coarseCovered = overlap >= overlapThreshold || ragHitLen > 200;

  return coarseCovered;
}
