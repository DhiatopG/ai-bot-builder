import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Google OAuth client (only needed if you also want to refresh here)
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}
const nowEpoch = () => Math.floor(Date.now() / 1000);

type BodyIn = {
  botId?: string; bot_id?: string; userId?: string;
  eventId: string;                         // provider event id (== external_event_id)
  startISO?: string; endISO?: string;     // preferred
  start?: string;   end?: string;         // accepted
  timezone?: string; timeZone?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BodyIn;

    const botId     = body.botId ?? body.bot_id ?? null;
    const userIdDir = body.userId ?? null;
    const eventId   = body.eventId;
    const timezone  = body.timezone ?? body.timeZone ?? "UTC";
    const startISO  = body.startISO ?? body.start ?? null;
    const endISO    = body.endISO   ?? body.end   ?? null;

    if (!eventId)  return NextResponse.json({ error: "eventId required" }, { status: 400 });
    if (!startISO || !endISO)
      return NextResponse.json({ error: "startISO/endISO (or start/end) required" }, { status: 400 });
    if (!botId && !userIdDir)
      return NextResponse.json({ error: "botId or userId required" }, { status: 400 });

    const sb = admin();

    // ---- resolve owner user id (bot -> owner) ----
    let ownerUserId = userIdDir;
    if (!ownerUserId) {
      const { data: botRow, error: botErr } = await sb
        .from("bots")
        .select("user_id")
        .eq("id", botId)
        .single();
      if (botErr || !botRow) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
      ownerUserId = botRow.user_id as string;
    }

    // ---- load calendar integration (primary) ----
    const { data: icRows, error: icErr } = await sb
      .from("integrations_calendar")
      .select("*")
      .eq("user_id", ownerUserId)
      .eq("calendar_id", "primary")
      .order("provider", { ascending: true })
      .order("connected_at", { ascending: false });

    if (icErr || !icRows?.length)
      return NextResponse.json({ error: "No calendar connection (primary)" }, { status: 400 });

    const ic = icRows.find(r => r.provider === "google" && r.access_token) ?? icRows[0];
    if (!ic.access_token)
      return NextResponse.json({ error: "No access_token for calendar" }, { status: 400 });

    // ---- refresh Google token if near expiry ----
    let accessToken = ic.access_token as string;
    if (ic.provider === "google") {
      const expiresAt = Number(ic.expires_at || 0);
      if (expiresAt && nowEpoch() > (expiresAt - 120) && ic.refresh_token) {
        const refreshed = await refreshGoogleToken(ic.refresh_token);
        if (!refreshed.ok)
          return NextResponse.json({ error: "Failed to refresh Google token", details: refreshed.error }, { status: 401 });
        accessToken = refreshed.access_token!;
        await sb.from("integrations_calendar")
          .update({
            access_token: refreshed.access_token,
            token_type:   refreshed.token_type ?? ic.token_type,
            expires_at:   refreshed.expires_at,
            updated_at:   new Date().toISOString(),
          })
          .eq("id", ic.id);
      }
    }

    // ---- PATCH event on provider ----
    if (ic.provider === "google") {
      const gRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            start: { dateTime: startISO, timeZone: timezone },
            end:   { dateTime: endISO,   timeZone: timezone },
          }),
        }
      );
      const gJson = await gRes.json().catch(() => ({}));
      if (!gRes.ok)
        return NextResponse.json({ error: "Google API error", details: gJson }, { status: gRes.status });
    } else if (ic.provider === "microsoft") {
      const mRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            start: { dateTime: startISO, timeZone: timezone },
            end:   { dateTime: endISO,   timeZone: timezone },
          }),
        }
      );
      if (!mRes.ok) {
        const mJson = await mRes.json().catch(() => ({}));
        return NextResponse.json({ error: "Microsoft Graph error", details: mJson }, { status: mRes.status });
      }
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${ic.provider}` }, { status: 400 });
    }

    // ---- update appointments row ----
    const updateFields: any = {
      starts_at: new Date(startISO).toISOString(),
      ends_at:   new Date(endISO).toISOString(),
      timezone,
      status: "rescheduled",
      updated_at: new Date().toISOString(),
    };

    if (botId) {
      await sb
        .from("appointments")
        .update(updateFields)
        .eq("bot_id", botId)
        .eq("external_event_id", eventId);
    } else {
      await sb
        .from("appointments")
        .update(updateFields)
        .eq("external_event_id", eventId);
    }

    return NextResponse.json({ ok: true, event_id: eventId, startISO, endISO, timezone });
  } catch (e: any) {
    return NextResponse.json({ error: "Unhandled error", details: String(e?.message ?? e) }, { status: 500 });
  }
}

// ---- Google token refresh helper ----
async function refreshGoogleToken(refreshToken: string): Promise<{
  ok: boolean; access_token?: string; token_type?: string; expires_at?: number; error?: any;
}> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json };

  const expires_in = Number(json.expires_in ?? 0);
  const expires_at = Math.floor(Date.now() / 1000) + (isNaN(expires_in) ? 0 : expires_in);
  return { ok: true, access_token: json.access_token, token_type: json.token_type, expires_at };
}
