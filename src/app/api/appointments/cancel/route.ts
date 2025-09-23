// src/app/api/appointments/cancel/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// === ENV ===
// Required
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Optional but strongly recommended for token refresh (Google)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

type BodyIn = {
  botId?: string;        // prefer this
  bot_id?: string;       // allow snake_case
  userId?: string;       // direct user cancel (fallback path)
  eventId: string;       // Google/Microsoft event.id (you store as external_event_id)
};

type IntegrationRow = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft" | string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at?: number | null;     // seconds since epoch (common)
  expiry_date?: string | null;    // ISO string (some schemas)
  calendar_id?: string | null;    // e.g. 'primary' or concrete calendar id
  connected_at?: string | null;
};

// --- helpers ---------------------------------------------------------

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function extractExpirySeconds(row: IntegrationRow): number | null {
  if (typeof row.expires_at === "number" && !Number.isNaN(row.expires_at)) return row.expires_at;
  if (row.expiry_date) {
    const t = Math.floor(new Date(row.expiry_date).getTime() / 1000);
    if (t > 0) return t;
  }
  return null;
}

function isExpiredSoon(row: IntegrationRow, skewSeconds = 60): boolean {
  const exp = extractExpirySeconds(row);
  if (!exp) return false;
  return exp <= (nowEpochSeconds() + skewSeconds);
}

async function refreshGoogleToken(
  sb: ReturnType<typeof admin>,
  ic: IntegrationRow
): Promise<{ accessToken: string; expiresAt?: number } | null> {
  // Need client credentials + refresh_token
  if (!ic.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;

  const form = new URLSearchParams();
  form.set("client_id", GOOGLE_CLIENT_ID);
  form.set("client_secret", GOOGLE_CLIENT_SECRET);
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", ic.refresh_token);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!res.ok) return null;

  const j = await res.json().catch(() => ({} as any));
  const newAccess = j.access_token as string | undefined;
  const expiresIn = typeof j.expires_in === "number" ? j.expires_in : undefined;
  if (!newAccess) return null;

  const newExpiresAt = expiresIn ? nowEpochSeconds() + expiresIn : undefined;

  // Persist back to integrations_calendar
  await sb
    .from("integrations_calendar")
    .update({
      access_token: newAccess,
      expires_at: newExpiresAt ?? null,
      expiry_date: newExpiresAt ? new Date(newExpiresAt * 1000).toISOString() : null,
      connected_at: new Date().toISOString(),
    })
    .eq("id", ic.id);

  return { accessToken: newAccess, expiresAt: newExpiresAt };
}

// ---- Discriminated unions to keep TS happy -------------------------
type GoogleDeleteOK   = { kind: "ok" };
type GoogleDeleteRetry = { kind: "retry"; status: number };
type GoogleDeleteErr  = { kind: "error"; status: number; details: any };
type GoogleDeleteResult = GoogleDeleteOK | GoogleDeleteRetry | GoogleDeleteErr;

async function googleDeleteEvent(
  calendarId: string,
  eventId: string,
  accessToken: string
): Promise<GoogleDeleteResult> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
    eventId
  )}?sendUpdates=all`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 204 No Content on success. 410 Gone when already deleted.
  if (res.ok || res.status === 410) return { kind: "ok" };
  if (res.status === 401) return { kind: "retry", status: 401 };

  const details = await res.json().catch(async () => {
    const text = await res.text().catch(() => "");
    return text || {};
  });

  return { kind: "error", status: res.status, details };
}

type MsDeleteOK  = { kind: "ok" };
type MsDeleteErr = { kind: "error"; status: number; details: any };
type MsDeleteResult = MsDeleteOK | MsDeleteErr;

async function microsoftDeleteEvent(
  eventId: string,
  accessToken: string
): Promise<MsDeleteResult> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 204 success; 404 treat as already gone (ok)
  if (res.ok || res.status === 404) return { kind: "ok" };

  const details = await res.json().catch(async () => {
    const text = await res.text().catch(() => "");
    return text || {};
  });

  return { kind: "error", status: res.status, details };
}

// --------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BodyIn;
    const botId = body.botId ?? body.bot_id ?? null;
    const userIdDirect = body.userId ?? null;
    const eventId = (body.eventId || "").trim();

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }
    if (!botId && !userIdDirect) {
      return NextResponse.json({ error: "botId or userId required" }, { status: 400 });
    }

    const sb = admin();

    // 1) Resolve owner user id (from bot if needed)
    let ownerUserId = userIdDirect;
    if (!ownerUserId) {
      const { data: botRow, error: botErr } = await sb
        .from("bots")
        .select("user_id")
        .eq("id", botId)
        .single();

      if (botErr || !botRow) {
        return NextResponse.json({ error: "Bot not found" }, { status: 404 });
      }
      ownerUserId = botRow.user_id as string;
    }

    // 2) Load calendar integration rows for owner. Prefer Google.
    const { data: icRows, error: icErr } = await sb
      .from("integrations_calendar")
      .select("*")
      .eq("user_id", ownerUserId)
      .order("provider", { ascending: true })
      .order("connected_at", { ascending: false });

    if (icErr || !icRows?.length) {
      return NextResponse.json({ error: "No calendar connection for user" }, { status: 400 });
    }

    const preferred =
      icRows.find((r: IntegrationRow) => r.provider === "google" && r.access_token) ??
      (icRows[0] as IntegrationRow);

    if (!preferred?.access_token) {
      return NextResponse.json({ error: "No access_token for calendar" }, { status: 400 });
    }

    const provider = preferred.provider;
    const calendarId = preferred.calendar_id?.trim() || "primary";

    // 3) Provider-specific delete (Google w/ refresh; Microsoft basic)
    if (provider === "google") {
      let accessToken = preferred.access_token;

      // If token is near expiry and we have a refresh token + creds, proactively refresh
      if (isExpiredSoon(preferred) && preferred.refresh_token && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        const refreshed = await refreshGoogleToken(sb, preferred);
        if (refreshed?.accessToken) {
          accessToken = refreshed.accessToken;
        }
      }

      // Try delete
      let del = await googleDeleteEvent(calendarId, eventId, accessToken);

      // If unauthorized, try refresh once then retry delete
      if (del.kind === "retry" && preferred.refresh_token && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        const refreshed = await refreshGoogleToken(sb, preferred);
        if (refreshed?.accessToken) {
          del = await googleDeleteEvent(calendarId, eventId, refreshed.accessToken);
        }
      }

      if (del.kind !== "ok") {
        // Not ok and not handled
        const status = del.kind === "error" ? del.status : 401;
        const details = del.kind === "error" ? del.details : null;
        return NextResponse.json({ error: "Google delete failed", details }, { status });
      }
    } else if (provider === "microsoft") {
      const del = await microsoftDeleteEvent(eventId, preferred.access_token!);
      if (del.kind !== "ok") {
        return NextResponse.json(
          { error: "Microsoft delete failed", details: del.details },
          { status: del.status }
        );
      }
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    // 4) Mark as cancelled in DB
    const updated_at = new Date().toISOString();
    if (botId) {
      await sb
        .from("appointments")
        .update({ status: "cancelled", updated_at })
        .eq("bot_id", botId)
        .eq("external_event_id", eventId);
    } else {
      // If only userId was provided, fall back by event id only
      await sb
        .from("appointments")
        .update({ status: "cancelled", updated_at })
        .eq("external_event_id", eventId);
    }

    return NextResponse.json({ ok: true, event_id: eventId });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unhandled error", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
