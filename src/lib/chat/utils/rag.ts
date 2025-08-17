export type RagChunk = {
  text: string;
  score: number;
};

const BOILERPLATE_PATTERNS: RegExp[] = [
  /\bcookie(s)?\b/i,
  /\bprivacy\b/i,
  /\bterms?\b/i,
  /\bnewsletter\b/i,
  /©|\ball rights reserved\b/i,
  /\baccept cookies?\b/i,
  /\bfooter\b/i,
  /\bsite by\b/i,
  /\btracking\b/i,
  /\bmarketing\b/i,
  /\bsubscribe\b/i,
  /\bbook now\b.*(banner|popup)/i,
];

export function isBoilerplate(text: string): boolean {
  const t = String(text || "").slice(0, 4000);
  return BOILERPLATE_PATTERNS.some((re) => re.test(t));
}


export function normalizeChunks(input: any[]): RagChunk[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((c: any) => {
      const text =
        c?.text ??
        c?.content ??
        c?.chunk ??
        (typeof c === "string" ? c : "");
      const score =
        typeof c?.score === "number"
          ? c.score
          : typeof c?.similarity === "number"
          ? c.similarity
          : typeof c?.metadata?.score === "number"
          ? c.metadata.score
          : 0;
      return { text: String(text || ""), score: Number(score || 0) };
    })
    .filter((c) => c.text.trim().length > 0);
}


export function filterChunks(
  chunks: RagChunk[],
  opts: { max?: number; minScore?: number } = {}
): RagChunk[] {
  const { max = 5, minScore = 0 } = opts;
  return (chunks || [])
    .filter((c) => c && !isBoilerplate(c.text) && c.text.trim().length > 0)
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}


export function kbHasConfidentCoverage(
  chunks: RagChunk[],
  minScore: number = 0.72,
  minChars: number = 400
): boolean {
  const strong = (chunks || []).filter((c) => c.score >= minScore);
  const sumLen = strong.reduce((n, c) => n + c.text.length, 0);
  return sumLen >= minChars;
}
