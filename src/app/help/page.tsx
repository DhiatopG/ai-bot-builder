'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LifeBuoy,
  Calendar,
  Bot,
  Clock,
  Plug,
  Wallet,
  Shield,
  Bug,
  Search,
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
} from 'lucide-react';

/**
 * Color system aligned to your SaaS:
 * - Navy (titles, strong text):  #002D62
 * - Primary (buttons, accents):  #1E90FF
 * - Primary hover:               #1873CC
 * - Muted surface / tint:        #EAF4FF
 * - Secondary text:              #708090
 */
const NAVY = '#002D62';
const PRIMARY = '#1E90FF';
const PRIMARY_HOVER = '#1873CC';
const MUTED = '#EAF4FF';
const SECONDARY = '#708090';

// ---------------- Types ----------------
type Category = {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  blurb: string;
};

type Article = {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  updatedAt: string; // ISO date
  popularity?: number;
  content: string[];
  faqs?: string[];
};

type Vote = 'yes' | 'no';
type HelpfulMap = Record<string, Vote>;

// -------------- Data --------------
const CATEGORIES: Category[] = [
  { id: 'getting-started', label: 'Getting Started', icon: LifeBuoy, blurb: 'Start here—connect calendar and make your first booking.' },
  { id: 'calendar', label: 'Calendar & Booking', icon: Calendar, blurb: 'Google setup, reschedule & cancel.' },
  { id: 'chatbot', label: 'Chatbot & Voice', icon: Bot, blurb: 'Website widget, prompts, and optional voice agent.' },
  { id: 'hours', label: 'Working Hours', icon: Clock, blurb: 'Open days, breaks, timezone behavior.' },
  { id: 'integrations', label: 'Integrations', icon: Plug, blurb: 'Airtable, Zapier, Make, webhooks.' },
  { id: 'billing', label: 'Billing & Plans', icon: Wallet, blurb: 'LTD terms, upgrades, receipts.' },
  { id: 'trust', label: 'Privacy & Trust', icon: Shield, blurb: 'Data handling, consent, compliance basics.' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: Bug, blurb: 'Fix common issues fast.' },
];

const ARTICLES: Article[] = [
  {
    id: 'quick-start',
    slug: 'quick-start-checklist',
    title: 'Quick Start Checklist (first booking in 5–10 min)',
    categoryId: 'getting-started',
    updatedAt: '2025-10-21',
    popularity: 11,
    content: [
      'Create your account and **add a bot**.',
      'Go to **Settings → Calendar** and **Connect Google**.',
      'Set your availability in **Bots → Manage Hours**.',
      'From **Dashboard → Your Bots**, find your bot card and **Copy the Embed Script**. Paste it right before the closing **</body>** on your site.',
      'Open your site and **book a test appointment**. Confirm it appears in your Google Calendar.',
      '(Optional) Go to **Dashboard → Integrations** to connect **Airtable/Zapier/Make** and capture leads.',
    ],
    faqs: [
      'Don’t see the bubble? See ‘Chat bubble not showing’.',
      'Booking missing? See ‘Booking not appearing in calendar’.',
    ],
  },
  {
    id: 'connect-google-calendar',
    slug: 'connect-google-calendar',
    title: 'Connect Google Calendar (2 minutes)',
    categoryId: 'calendar',
    updatedAt: '2025-10-15',
    popularity: 10,
    content: [
      'Go to **Settings → Calendar** and click **Connect Google**.',
      'Approve permissions (calendar access + basic profile/email).',
      'Choose the booking calendar (usually **primary**).',
      'Book a test from your widget—event should appear almost instantly.',
      'If you see ‘insufficient permissions’, disconnect → refresh → reconnect, then retry.',
    ],
  },
  // Install article updated to match your dashboard embed script UX
  {
    id: 'install-chat-widget',
    slug: 'install-chat-widget',
    title: 'Install the Chat Widget on your website',
    categoryId: 'chatbot',
    updatedAt: '2025-10-15',
    popularity: 9,
    content: [
      'Go to **Dashboard → Your Bots** and locate your bot card.',
      'Under **Embed Script**, click **Copy** to copy the code (for example: `<script src="https://in60second.net/embed.js" data-user="[BOT_ID]" defer></script>`).',
      'Paste it right before the closing **</body>** tag on your site (ensure it loads on all pages where you want the bubble).',
      'Publish and reload—look for the chat bubble at the bottom-right.',
      'If your booking widget supports iframes, we open it inline; otherwise in a new tab.',
    ],
  },
  {
    id: 'set-working-hours',
    slug: 'set-working-hours',
    title: 'Set Working Hours & Breaks',
    categoryId: 'hours',
    updatedAt: '2025-10-15',
    popularity: 7,
    content: [
      'Go to **Bots → Manage Hours**.',
      'Pick open days and set open/close times plus optional breaks.',
      'Click **Save**—new availability applies instantly.',
      'Block personal days directly in your calendar; we merge busy slots automatically.',
    ],
  },
  {
    id: 'book-reschedule-cancel',
    slug: 'book-reschedule-cancel',
    title: 'Book, Reschedule & Cancel – how it works',
    categoryId: 'calendar',
    updatedAt: '2025-10-15',
    popularity: 8,
    content: [
      '**Booking:** bot checks working hours + calendar busy times and offers real slots.',
      '**Reschedule:** bot asks for **name + email** to locate the appointment, then shows new times.',
      '**Cancel:** identity confirmed → event removed in provider calendar and in our DB.',
      'Voice flows: always capture **email** to match events reliably.',
    ],
  },
  {
    id: 'airtable',
    slug: 'send-leads-to-airtable',
    title: 'Send leads to Airtable',
    categoryId: 'integrations',
    updatedAt: '2025-10-15',
    popularity: 6,
    content: [
      'Go to **Dashboard → Integrations → Airtable**, add **API Key**, **Base ID**, **Table Name**.',
      'New leads append as rows with name, email, phone, and captured Q&A.',
      'Use Airtable views/automations for follow-up and status.',
    ],
  },
  {
    id: 'webhooks',
    slug: 'webhooks-zapier-make',
    title: 'Webhooks with Zapier/Make (POST)',
    categoryId: 'integrations',
    updatedAt: '2025-10-15',
    popularity: 6,
    content: [
      'Add your Zapier/Make **webhook URL** in **Dashboard → Integrations**.',
      'We POST JSON like `{ name, email, phone, about, source, created_at }`.',
      'In Zapier/Make, **filter out empty fields** (e.g., skip empty `about`).',
    ],
  },
  {
    id: 'privacy',
    slug: 'privacy-and-consent',
    title: 'Privacy, Consent & Data Handling',
    categoryId: 'trust',
    updatedAt: '2025-10-15',
    popularity: 4,
    content: [
      'We store what’s needed to run your bot and bookings (lead info, appointment data, diagnostic logs).',
      'Request deletion via **support@in60second.net**.',
      'Avoid collecting sensitive PHI in chat unless the patient consents and you require it.',
    ],
  },
  {
    id: 'voicemail',
    slug: 'calls-go-to-voicemail',
    title: 'Cold calls go to voicemail – quick fixes',
    categoryId: 'troubleshooting',
    updatedAt: '2025-10-15',
    popularity: 7,
    content: [
      'Limit attempts per number and avoid back-to-back retries.',
      'Warm up numbers and set proper caller ID (CNAM) where supported.',
      'Keep opening line short; hangups rise when they suspect spam/AI immediately.',
      'Test with a clean number to compare connection rate.',
    ],
  },
  {
    id: 'booking-missing',
    slug: 'booking-not-appearing',
    title: 'Troubleshooting: Booking not appearing in calendar',
    categoryId: 'troubleshooting',
    updatedAt: '2025-10-15',
    popularity: 6,
    content: [
      'Confirm you selected the right **booking calendar** after connect.',
      'Make a fresh test booking; check the correct account (Google).',
      'Re-connect permissions if previously denied; then retry.',
      'Look for conflicting busy blocks in provider calendar.',
    ],
  },
  {
    id: 'bubble-hidden',
    slug: 'chat-bubble-not-showing',
    title: 'Troubleshooting: Chat bubble not showing',
    categoryId: 'troubleshooting',
    updatedAt: '2025-10-15',
    popularity: 6,
    content: [
      'Ensure **embed.js** is pasted before **</body>** and not blocked by a CSP/ad-blocker.',
      'Check your site builder’s custom code area is enabled on **all pages**.',
      'Open the console for errors; republish if recently changed.',
    ],
  },
  {
    id: 'timezone-slots',
    slug: 'timezone-slot-looks-wrong',
    title: 'Troubleshooting: Timezone/slot looks wrong',
    categoryId: 'troubleshooting',
    updatedAt: '2025-10-15',
    popularity: 5,
    content: [
      'Verify your **account timezone** and your practice calendar timezone match expectations.',
      'Re-open widget to refresh slot calculations after changing hours.',
      'Cross-check provider calendar’s timezone and daylight saving setting.',
    ],
  },
  {
    id: 'webhook-not-receiving',
    slug: 'webhook-not-receiving-data',
    title: 'Troubleshooting: Webhook not receiving data (Vapi/Make)',
    categoryId: 'troubleshooting',
    updatedAt: '2025-10-15',
    popularity: 8,
    content: [
      'Hit your webhook URL from a REST client to confirm it returns **200 OK**.',
      'Reduce payload to minimum fields, then add fields back one by one.',
      'Increase Make/Zapier timeout if processing is slow; ensure our sender isn’t being rate-limited.',
      'Double-check filters (e.g., skip when `about` is empty).',
    ],
  },
  {
    id: 'billing-ltd',
    slug: 'lifetime-deal-terms',
    title: 'Billing: Lifetime Deal (LTD) – terms & receipts',
    categoryId: 'billing',
    updatedAt: '2025-10-15',
    popularity: 5,
    content: [
      'One-time payment covers **1 practice location** (fair use).',
      'Includes chat widget, booking, and listed integrations at purchase time.',
      'Add-ons like telephony minutes may bill separately.',
      'We provide setup help and ongoing updates tied to this tier.',
    ],
  },
];

// -------------- Helpers --------------
const normalize = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const includes = (hay: string, needle: string) => normalize(hay).includes(normalize(needle));

function useHashSelection(defaultSlug = ''): [string, (v: string) => void] {
  const [slug, setSlug] = useState(defaultSlug);
  useEffect(() => {
    const apply = () => {
      const h = (typeof window !== 'undefined' && (window as any).location.hash) || '';
      setSlug(h.replace('#', ''));
    };
    apply();
    if (typeof window !== 'undefined') {
      const handler = () => apply();
      window.addEventListener('hashchange', handler);
      return () => window.removeEventListener('hashchange', handler);
    }
  }, []);
  return [slug, setSlug];
}

// -------------- Component --------------
export default function HelpPage() {
  const router = useRouter();

  const [query, setQuery] = useState<string>('');
  const [activeCat, setActiveCat] = useState<string>('getting-started');
  const [helpfulMap, setHelpfulMap] = useState<HelpfulMap>({});
  const [hashSlug, setHashSlug] = useHashSelection('');

  const filtered = useMemo(() => {
    const q = normalize(query);
    const list = ARTICLES.filter(
      (a) =>
        (activeCat ? a.categoryId === activeCat : true) &&
        (q ? includes(a.title, q) || a.content.some((p) => includes(p, q)) : true)
    );
    const score = (a: Article) => {
      const t = includes(a.title, query) ? 2 : 0;
      return t * 1000 + (a.popularity || 0);
    };
    return [...list].sort(
      (x, y) => score(y) - score(x) || (y.updatedAt || '').localeCompare(x.updatedAt || '')
    );
  }, [query, activeCat]);

  const selected: Article =
    ARTICLES.find((a) => a.slug === (hashSlug || filtered[0]?.slug || '')) ||
    filtered[0] ||
    ARTICLES[0];

  const onOpenArticle = (slug: string) => {
    if (typeof window !== 'undefined') {
      (window as any).location.hash = slug;
      setHashSlug(slug);
    }
  };

  const selectedCategory = CATEGORIES.find((c) => c.id === activeCat);

  return (
  <div className="mx-auto w-full max-w-6xl px-4 py-8">
    {/* Header (with Back to Dashboard) */}
    <div className="mb-6 flex items-center justify-between">
      {/* Left: title */}
      <div className="flex items-center gap-3">
        <LifeBuoy className="h-7 w-7" color={PRIMARY} />
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: NAVY }}>
          Help Center
        </h1>
        <span
          className="ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-xs"
          style={{ backgroundColor: MUTED, borderColor: PRIMARY, color: NAVY }}
        >
          MVP
        </span>
      </div>

      {/* Right: back button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        style={{ color: '#fff', backgroundColor: PRIMARY, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PRIMARY_HOVER)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PRIMARY)}
        title="Back to Dashboard"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Dashboard
      </button>
    </div>

    {/* ...the rest of your page stays unchanged... */}


      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 opacity-60" color={PRIMARY} />
          <input
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="Search: calendar, widget, webhook, hours…"
            className="w-full rounded-md border px-10 py-2 text-sm outline-none"
            style={{ borderColor: '#E5E7EB' }}
          />
        </div>
        <div className="mt-2 text-sm" style={{ color: SECONDARY }}>
          Tip: try “Google”, “Airtable”, or “timezone”.
        </div>
      </div>

      {/* Categories */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map(({ id, label, icon: Icon, blurb }) => (
          <div
            key={id}
            onClick={() => setActiveCat(id)}
            className="cursor-pointer rounded-xl border p-4 transition"
            style={{
              borderColor: activeCat === id ? PRIMARY : '#E5E7EB',
              boxShadow: activeCat === id ? `0 0 0 3px ${PRIMARY}22` : 'none',
            }}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" color={activeCat === id ? PRIMARY : NAVY} />
              <div className="font-medium" style={{ color: NAVY }}>
                {label}
              </div>
            </div>
            <div className="pt-1 text-sm" style={{ color: SECONDARY }}>
              {blurb}
            </div>
          </div>
        ))}
      </div>

      {/* Body: list + article */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* List */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border" style={{ borderColor: '#E5E7EB' }}>
            <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
              <div className="text-base font-medium" style={{ color: NAVY }}>
                {selectedCategory?.label || 'Articles'}
              </div>
              <div className="text-xs" style={{ color: SECONDARY }}>
                {filtered.length} article{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="p-2">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onOpenArticle(a.slug)}
                  className="w-full rounded-xl p-3 text-left transition"
                  style={{
                    backgroundColor: selected?.id === a.id ? MUTED : '#ffffff',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (selected?.id !== a.id) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = selected?.id === a.id ? MUTED : '#ffffff';
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium leading-tight" style={{ color: NAVY }}>
                      {a.title}
                    </div>
                    <span
                      className="rounded px-2 py-0.5 text-[11px] border"
                      style={{ borderColor: '#E5E7EB', color: SECONDARY, backgroundColor: '#fff' }}
                    >
                      {a.updatedAt}
                    </span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: SECONDARY }}>
                    {CATEGORIES.find((c) => c.id === a.categoryId)?.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Article */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                style={{ color: NAVY }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Back to Dashboard"
                aria-label="Back to Dashboard"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="text-lg font-semibold leading-tight" style={{ color: NAVY }}>
                  {selected.title}
                </div>
                <div className="text-xs" style={{ color: SECONDARY }}>
                  Updated {selected.updatedAt}
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="space-y-2">
                {selected.content.map((p, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed"
                    style={{ color: NAVY }}
                    dangerouslySetInnerHTML={{
                      __html: p.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${NAVY}">$1</strong>`),
                    }}
                  />
                ))}
              </div>

              {!!selected.faqs?.length && (
                <div className="rounded-xl border p-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#ffffff' }}>
                  <div className="mb-2 text-sm font-medium" style={{ color: NAVY }}>
                    FAQs / Common issues
                  </div>
                  <ul className="list-disc pl-5 text-sm" style={{ color: SECONDARY }}>
                    {selected.faqs.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Helpful? */}
              <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: '#E5E7EB' }}>
                <div className="text-sm font-medium" style={{ color: NAVY }}>
                  Was this article helpful?
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHelpfulMap((m) => ({ ...m, [selected.id]: 'yes' }))}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    style={{
                      borderColor: helpfulMap[selected.id] === 'yes' ? PRIMARY : '#E5E7EB',
                      backgroundColor: helpfulMap[selected.id] === 'yes' ? PRIMARY : '#ffffff',
                      color: helpfulMap[selected.id] === 'yes' ? '#ffffff' : NAVY,
                    }}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Yes
                  </button>
                  <button
                    onClick={() => setHelpfulMap((m) => ({ ...m, [selected.id]: 'no' }))}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    style={{
                      borderColor: helpfulMap[selected.id] === 'no' ? PRIMARY : '#E5E7EB',
                      backgroundColor: helpfulMap[selected.id] === 'no' ? PRIMARY : '#ffffff',
                      color: helpfulMap[selected.id] === 'no' ? '#ffffff' : NAVY,
                    }}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    No
                  </button>
                </div>
              </div>

              {/* Need more help */}
              <div className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: MUTED }}>
                <div className="text-sm" style={{ color: NAVY }}>
                  Still stuck? Email <span className="font-medium">support@in60second.net</span>
                </div>
                <a
                  className="inline-flex items-center gap-2 text-sm underline"
                  href="mailto:support@in60second.net"
                  style={{ color: PRIMARY }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = PRIMARY_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = PRIMARY)}
                >
                  Contact support <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {/* No public signup/free-trial CTA here because user is already inside the dashboard */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
