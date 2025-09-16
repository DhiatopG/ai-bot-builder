import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Google OAuth client for refresh
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}
const nowEpoch = () => Math.floor(Date.now() / 1000);

type BodyIn = {
  botId?: string;         // preferred
  bot_id?: string;        // accepted
  userId?: string;        // also accepted (direct)
  summary?: string;
  description?: string;
  startISO?: string;      // preferred
  endISO?: string;        // preferred
  start?: string;         // accepted
  end?: string;           // accepted
  timezone?: string;      // preferred
  timeZone?: string;      // accepted
  invitee_name?: string;
  invitee_email?: string;
  invitee_phone?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BodyIn;

    // ---- normalize input ----
    const botId      = body.botId ?? body.bot_id ?? null;
    const userIdDirect = body.userId ?? null;
    const timezone   = body.timezone ?? body.timeZone ?? "UTC";
    const summary    = body.summary ?? "Booking";
    const description= body.description ?? "";
    const startISO   = body.startISO ?? body.start ?? null;
    const endISO     = body.endISO   ?? body.end   ?? null;

    if (!startISO || !endISO) {
      return NextResponse.json({ error: "startISO/endISO (or start/end) required" }, { status: 400 });
    }
    if (!botId && !userIdDirect) {
      return NextResponse.json({ error: "botId or userId required" }, { status: 400 });
    }

    const sb = admin();

    // ---- map bot -> owner user_id (unless userId directly provided) ----
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

    // ---- load calendar integration row (primary, prefer google) ----
    const { data: icRows, error: icErr } = await sb
      .from("integrations_calendar")
      .select("*")
      .eq("user_id", ownerUserId)
      .eq("calendar_id", "primary")
      .order("provider", { ascending: true }) // 'google' < 'microsoft'
      .order("connected_at", { ascending: false });

    if (icErr || !icRows || icRows.length === 0) {
      return NextResponse.json({ error: "No calendar connection for this user (primary)" }, { status: 400 });
    }

    // pick a row that has tokens (prefer a Google row with access_token)
    const ic = icRows.find(r => r.provider === "google" && r.access_token) ?? icRows[0];
    if (!ic.access_token) {
      return NextResponse.json({ error: "No access_token found for calendar" }, { status: 400 });
    }

    // ---- refresh token if needed (Google) ----
    let accessToken = ic.access_token as string;
    if (ic.provider === "google") {
      const expiresAt = Number(ic.expires_at || 0);
      if (expiresAt && nowEpoch() > (expiresAt - 120) && ic.refresh_token) {
        const refreshed = await refreshGoogleToken(ic.refresh_token);
        if (!refreshed.ok) {
          return NextResponse.json({ error: "Failed to refresh Google token", details: refreshed.error }, { status: 401 });
        }
        accessToken = refreshed.access_token!;
        // store new tokens
        await sb.from("integrations_calendar")
          .update({
            access_token: refreshed.access_token,
            expires_at:   refreshed.expires_at,
            token_type:   refreshed.token_type ?? ic.token_type,
            updated_at:   new Date().toISOString(),
          })
          .eq("id", ic.id);
      }
    } else if (ic.provider === "microsoft") {
      // OPTIONAL: add MS refresh flow if you need it
    }

    // ---- preflight: verify the slot is free (Google FreeBusy) ----
    if (ic.provider === "google") {
      const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: startISO,
          timeMax: endISO,
          timeZone: timezone,
          items: [{ id: "primary" }],
        }),
      });
      const fbJson = await fbRes.json().catch(() => ({}));
      if (!fbRes.ok) {
        return NextResponse.json({ error: "FreeBusy error", details: fbJson }, { status: fbRes.status });
      }
      const busy = fbJson?.calendars?.primary?.busy ?? [];
      if (Array.isArray(busy) && busy.length > 0) {
        // at least one overlapping interval
        return NextResponse.json({ error: "Slot already taken", code: "TIME_CONFLICT", busy }, { status: 409 });
      }
    }

    // ---- create event on provider ----
    let createdEventId: string | null = null;
    let htmlLink: string | undefined;
    let meetLink: string | undefined;

    if (ic.provider === "google") {
      const payload: any = {
        summary,
        description,
        start: { dateTime: startISO, timeZone: timezone },
        end:   { dateTime: endISO,   timeZone: timezone },
      };

      // Add attendee if provided
      if (body.invitee_email) payload.attendees = [{ email: body.invitee_email }];

      // Auto-create a Google Meet link
      payload.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      };

      const gRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const gJson = await gRes.json();
      if (!gRes.ok) {
        return NextResponse.json({ error: "Google API error", details: gJson }, { status: gRes.status });
      }
      createdEventId = gJson.id as string;
      htmlLink = gJson.htmlLink as string | undefined;
      meetLink = (gJson.hangoutLink as string | undefined) ?? gJson?.conferenceData?.entryPoints?.[0]?.uri;
    } else if (ic.provider === "microsoft") {
      // Minimal example (Graph)
      const payload = {
        subject: summary,
        body: { contentType: "HTML", content: description ?? "" },
        start: { dateTime: startISO, timeZone: timezone },
        end:   { dateTime: endISO,   timeZone: timezone },
        attendees: body.invitee_email ? [{ emailAddress: { address: body.invitee_email }, type: "required" }] : [],
      };
      const mRes = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const mJson = await mRes.json();
      if (!mRes.ok) {
        return NextResponse.json({ error: "Microsoft Graph error", details: mJson }, { status: mRes.status });
      }
      createdEventId = mJson.id as string;
      htmlLink = mJson.webLink as string | undefined;
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${ic.provider}` }, { status: 400 });
    }

    // ---- upsert into appointments (uses your existing columns) ----
    const insertRow = {
      bot_id: botId ?? null,
      provider: ic.provider,
      status: "confirmed",
      invitee_name:  body.invitee_name ?? null,
      invitee_email: body.invitee_email ?? null,
      invitee_phone: body.invitee_phone ?? null,
      starts_at: new Date(startISO).toISOString(),
      ends_at:   new Date(endISO).toISOString(),
      timezone,
      external_event_id: createdEventId,          // works with your unique index
      external_calendar_id: ic.calendar_id ?? "primary",
      metadata: {
        created_via: "bot",
        summary,
        description,
        htmlLink,
        hangoutLink: meetLink,
      } as any,
    };

    const { data: ins, error: insErr } = await sb
      .from("appointments")
      .upsert(insertRow, { onConflict: "bot_id,external_event_id" })
      .select("*")
      .limit(1);

    if (insErr) {
      const { data: ins2, error: insErr2 } = await sb
        .from("appointments")
        .insert(insertRow)
        .select("*")
        .limit(1);
      if (insErr2) {
        return NextResponse.json({ error: "DB insert failed", details: insErr2 }, { status: 500 });
      }
      return NextResponse.json({ ok: true, event_id: createdEventId, row: ins2?.[0] ?? null });
    }

    return NextResponse.json({ ok: true, event_id: createdEventId, row: ins?.[0] ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: "Unhandled error", details: String(e?.message ?? e) }, { status: 500 });
  }
}

// ---- token refresh (Google) ----
async function refreshGoogleToken(refreshToken: string): Promise<{
  ok: boolean;
  access_token?: string;
  token_type?: string;
  expires_at?: number;  // epoch seconds
  error?: any;
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

  // Google returns expires_in (seconds from now)
  const expires_in = Number(json.expires_in ?? 0);
  const expires_at = Math.floor(Date.now() / 1000) + (isNaN(expires_in) ? 0 : expires_in);

  return {
    ok: true,
    access_token: json.access_token,
    token_type: json.token_type,
    expires_at,
  };
}
