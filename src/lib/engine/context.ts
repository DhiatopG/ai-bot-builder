import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type BizContext = {
  botId: string;
  businessName: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  hoursText?: string;
  isOpenNow: boolean;

  offers: string[];
  services: string[];

  bookingProvider: 'iframe' | 'link' | 'none';
  bookingUrl?: string;
  bookingIframe?: string;
  mapsUrl?: string;
};

// --- helpers for calendar embedding
function addParam(u: URL, key: string, val: string) {
  if (!u.searchParams.has(key)) u.searchParams.set(key, val);
}

function toEmbedUrl(raw: string, hostDomain: string) {
  try {
    const u = new URL(raw);
    if (u.hostname.includes('calendly.com')) {
      addParam(u, 'embed_domain', hostDomain || 'localhost');
      addParam(u, 'embed_type', 'Inline');
      return u.toString();
    }
    if (/(^|\.)cal\.com$|tidycal\.com|youcanbook\.me|hubspot\.(com|net)\/meetings|acuityscheduling\.com|as\.me/i
      .test(u.host + u.pathname)
    ) {
      addParam(u, 'embed', 'true');
      return u.toString();
    }
    if (/calendar\.google\.com|google\.[^/]+\/bookings|microsoft\.com\/bookings|vcita\.com/i.test(u.host + u.pathname)) {
      return raw + '#NO_EMBED';
    }
    return raw;
  } catch {
    return raw;
  }
}

async function canEmbed(url: string): Promise<boolean> {
  try {
    if (/#NO_EMBED$/.test(url)) return false;
    const tryOnce = async (method: 'HEAD' | 'GET') => {
      const r = await fetch(url, { method, redirect: 'manual' });
      const xfo = (r.headers.get('x-frame-options') || '').toLowerCase();
      const csp = (r.headers.get('content-security-policy') || '').toLowerCase();
      if (xfo && xfo !== 'allow') return false;
      if (csp.includes('frame-ancestors')) {
        const m = /frame-ancestors\s([^;]+)/.exec(csp)?.[1] || '';
        if (m.includes("'none'")) return false;
        if (!m.includes('*')) return false;
      }
      return true;
    };
    const h = await tryOnce('HEAD');
    if (h) return true;
    return await tryOnce('GET');
  } catch {
    return false;
  }
}

export async function loadBizContext({
  botId,
  isAfterHours,
  originHost,
}: {
  botId: string;
  isAfterHours: boolean;
  originHost: string;
}): Promise<BizContext> {
  const supabase = await createServerClient();
  const admin = await createAdminClient();

  const { data: bot } = await supabase
    .from('bots')
    .select('id, description, tone, calendar_url')
    .eq('id', botId)
    .single();

  const { data: info } = await admin
    .from('bot_info')
    .select(`
      contact_email,
      contact_phone,
      contact_form_url,
      location,
      offer_1_title, offer_1_url,
      offer_2_title, offer_2_url,
      offer_3_title, offer_3_url,
      offer_4_title, offer_4_url,
      offer_5_title, offer_5_url
    `)
    .eq('bot_id', botId)
    .maybeSingle();

  const bookingRaw = bot?.calendar_url?.trim() || '';
  const normalized = bookingRaw ? toEmbedUrl(bookingRaw, originHost) : '';

  const mapsUrl = info?.location
    ? `https://maps.google.com/?q=${encodeURIComponent(info.location)}`
    : undefined;

  const bookingProvider: BizContext['bookingProvider'] =
    normalized
      ? (/#NO_EMBED$/.test(normalized) ? 'link' : 'iframe')
      : 'none';

  const bookingIframe = bookingProvider === 'iframe' ? normalized : undefined;
  const bookingUrl = bookingProvider === 'link' ? normalized.replace(/#NO_EMBED$/, '') : bookingRaw || undefined;

  // You can later compute true opening hours. For now we trust `isAfterHours` boolean from API.
  const isOpenNow = !isAfterHours;

  // Basic offers/services (you can expand later from DB)
  const offers: string[] = [
    info?.offer_1_title, info?.offer_2_title, info?.offer_3_title, info?.offer_4_title, info?.offer_5_title
  ].filter(Boolean) as string[];

  const services: string[] = ['cleaning', 'filling', 'crown', 'braces'];

  // verify iframe allowed
  let finalBookingProvider = bookingProvider;
  if (bookingProvider === 'iframe' && bookingIframe) {
    const ok = await canEmbed(bookingIframe);
    if (!ok) finalBookingProvider = 'link';
  }

  return {
    botId,
    businessName: 'Dental Clinic',
    description: bot?.description || '',
    address: info?.location || '',
    phone: info?.contact_phone || '',
    email: info?.contact_email || '',
    hoursText: 'Mon–Fri 9–17',
    isOpenNow,
    offers,
    services,
    bookingProvider: finalBookingProvider,
    bookingUrl,
    bookingIframe,
    mapsUrl
  };
}
