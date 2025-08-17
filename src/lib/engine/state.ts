export type Entities = {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
};

export function extractEntities(allTexts: string[]): Entities {
  const joined = (allTexts || []).join('\n');

  const email = joined.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1]?.toLowerCase();
  const phone = joined.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[1]?.replace(/[^\d+]/g, '');

  // naive name heuristic: last answer after bot asked for a name
  const name = (() => {
    const idx = allTexts.findIndex(t => /your name|name please|what'?s your name|what name should i put/i.test(t || ''));
    if (idx >= 0 && allTexts[idx + 1]) {
      return allTexts[idx + 1]
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    return undefined;
  })();

  const service = (() => {
    const s = joined.toLowerCase();
    if (/clean(ing)?/.test(s)) return 'cleaning';
    if (/filling/.test(s)) return 'filling';
    if (/crown/.test(s)) return 'crown';
    if (/brace|aligner|invisalign/.test(s)) return 'orthodontics';
    return undefined;
  })();

  return { name, email, phone, service };
}

export function stepIsSatisfied(key: 'name'|'email'|'phone'|'service', e: Entities) {
  return Boolean(e[key]);
}
