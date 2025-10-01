// src/app/api/appointments/cancel/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Run on Node (Buffer, fetch, etc.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// === ENV ===
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Optional (Google token refresh)
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

type BodyIn = {
  botId?: string; // prefer this
  bot_id?: string; // allow snake_case
  userId?: string; // optional: direct user cancel
  eventId: string; // accepts appointments.event_id OR external_event_id
};

type IntegrationRow = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft" | string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at?: number | null; // epoch seconds (present in your schema)
  calendar_id?: string | null; // e.g. 'primary' or concrete id
  connected_at?: string | null;
};

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function extractExpirySeconds(row: IntegrationRow): number | null {
  return typeof row.expires_at === "number" && !Number.isNaN(row.expires_at)
    ? row.expires_at
    : null;
}

function isExpiredSoon(row: IntegrationRow, skewSeconds = 60): boolean {
  const exp = extractExpirySeconds(row);
  if (!exp) return false;
  return exp <= nowEpochSeconds() + skewSeconds;
}

/** Decode Google Calendar htmlLink ?eid= (base64url of "eventId calendarId") */
function decodeFromHtmlLink(htmlLink?: string | null): {
  eventId?: string;
  calendarId?: string;
} {
  if (!htmlLink) return {};
  const m = htmlLink.match(/[?&]eid=([^&]+)/);
  if (!m) return {};
  let b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  b64 += "=".repeat(pad);
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const [eventId, calendarId] = decoded.split(" ");
    return { eventId, calendarId };
  } catch {
    return {};
  }
}

async function refreshGoogleToken(
  sb: ReturnType<typeof admin>,
  ic: IntegrationRow
): Promise<{ accessToken: string; expiresAt?: number } | null> {
  if (!ic.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
    return null;

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

  const j = (await res.json().catch(() => ({}))) as any;
  const newAccess = j.access_token as string | undefined;
  const expiresIn =
    typeof j.expires_in === "number" ? (j.expires_in as number) : undefined;
  if (!newAccess) return null;

  const newExpiresAt = expiresIn ? nowEpochSeconds() + expiresIn : undefined;

  // NOTE: your schema has expires_at (epoch). No expiry_date column.
  await sb
    .from("integrations_calendar")
    .update({
      access_token: newAccess,
      expires_at: newExpiresAt ?? null,
      connected_at: new Date().toISOString(),
    })
    .eq("id", ic.id);

  return { accessToken: newAccess, expiresAt: newExpiresAt };
}

// ---- Provider calls -------------------------------------------------
type GoogleDeleteOK = { kind: "ok" };
type GoogleDeleteRetry = { kind: "retry"; status: number };
type GoogleDeleteErr = { kind: "error"; status: number; details: any };
type GoogleDeleteResult = GoogleDeleteOK | GoogleDeleteRetry | GoogleDeleteErr;

async function googleDeleteEvent(
  calendarId: string,
  eventId: string,
  accessToken: string
): Promise<GoogleDeleteResult> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;

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

type MsDeleteOK = { kind: "ok" };
type MsDeleteErr = { kind: "error"; status: number; details: any };
type MsDeleteResult = MsDeleteOK | MsDeleteErr;

async function microsoftDeleteEvent(
  eventId: string,
  accessToken: string
): Promise<MsDeleteResult> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

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
    const rawEventId = (body.eventId || "").trim();

    if (!rawEventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }
    if (!botId && !userIdDirect) {
      return NextResponse.json(
        { error: "botId or userId required" },
        { status: 400 }
      );
    }

    const sb = admin();

    // 0) Resolve appointment (accept internal or external ids)
    const apptQuery = sb
      .from("appointments")
      .select(
        "id, bot_id, provider, status, event_id, external_event_id, external_calendar_id, metadata"
      )
      .or(`external_event_id.eq.${rawEventId},event_id.eq.${rawEventId}`)
      .limit(1);

    const { data: apptScoped, error: apptScopedErr } = botId
      ? await apptQuery.eq("bot_id", botId).maybeSingle()
      : await apptQuery.maybeSingle();

    const appt = apptScoped as
      | {
          id: string;
          bot_id: string;
          provider: string | null;
          status: string;
          event_id: string | null;
          external_event_id: string | null;
          external_calendar_id: string | null;
          metadata?: any;
        }
      | null;

    if (apptScopedErr || !appt) {
      return NextResponse.json(
        { error: "Appointment not found for given eventId/botId" },
        { status: 404 }
      );
    }

    // Idempotent: already cancelled
    if (appt.status === "cancelled") {
      return NextResponse.json({
        ok: true,
        mode: "already_cancelled",
        appointmentId: appt.id,
        event_id: appt.external_event_id ?? appt.event_id ?? rawEventId,
      });
    }

    // Decode possible Google ids from htmlLink (fallback)
    const htmlLink: string | undefined = appt?.metadata?.htmlLink;
    const decoded = decodeFromHtmlLink(htmlLink);

    // Normalize provider from appointment
    const providerNorm = (appt.provider || "").toLowerCase();
    const isGoogle =
      providerNorm === "google" || providerNorm === "google_calendar";
    const isMicrosoft =
      providerNorm === "microsoft" || providerNorm === "microsoft_calendar";

    // 1) Resolve owner user id (from bot if needed)
    let ownerUserId = userIdDirect;
    if (!ownerUserId) {
      const { data: botRow, error: botErr } = await sb
        .from("bots")
        .select("user_id")
        .eq("id", appt.bot_id)
        .single();
      if (botErr || !botRow) {
        return NextResponse.json({ error: "Bot not found" }, { status: 404 });
      }
      ownerUserId = botRow.user_id as string;
    }

    // 2) Load calendar integrations for owner; select by appointment’s provider
    const { data: icRows, error: icErr } = await sb
      .from("integrations_calendar")
      .select("*")
      .eq("user_id", ownerUserId)
      .order("provider", { ascending: true })
      .order("connected_at", { ascending: false });

    if (icErr || !icRows?.length) {
      return NextResponse.json(
        { error: "No calendar connection for user" },
        { status: 400 }
      );
    }

    const integrations = icRows as IntegrationRow[];
    const pick = (prov: "google" | "microsoft") =>
      integrations.find(
        (r) => r.provider === prov && r.access_token
      ) as IntegrationRow | undefined;

    const chosen =
      (isGoogle && pick("google")) ||
      (isMicrosoft && pick("microsoft")) ||
      integrations.find((r) => r.access_token) ||
      null;

    if (!chosen?.access_token) {
      return NextResponse.json(
        { error: "No access_token for calendar" },
        { status: 400 }
      );
    }

    // Build final event/calendar identifiers
    const externalEventId =
      appt.external_event_id || decoded.eventId || appt.event_id || rawEventId;

    const looksValidCal = (cid?: string | null) =>
      !!cid && cid.length >= 8 && cid.includes("@");

    let calendarId =
      (looksValidCal(appt.external_calendar_id)
        ? appt.external_calendar_id!
        : null) ||
      (looksValidCal(chosen.calendar_id) ? chosen.calendar_id! : null) ||
      "primary";

    // 3) Provider delete
    if (chosen.provider === "google") {
      if (!externalEventId) {
        return NextResponse.json(
          { error: "Missing external_event_id for Google cancel" },
          { status: 400 }
        );
      }

      let accessToken = chosen.access_token!;

      // Refresh if near expiry
      if (
        isExpiredSoon(chosen) &&
        chosen.refresh_token &&
        GOOGLE_CLIENT_ID &&
        GOOGLE_CLIENT_SECRET
      ) {
        const refreshed = await refreshGoogleToken(sb, chosen);
        if (refreshed?.accessToken) accessToken = refreshed.accessToken;
      }

      // Attempt 1: current calendarId
      let del = await googleDeleteEvent(calendarId, externalEventId, accessToken);

      // If unauthorized, try one refresh then retry
      if (
        del.kind === "retry" &&
        chosen.refresh_token &&
        GOOGLE_CLIENT_ID &&
        GOOGLE_CLIENT_SECRET
      ) {
        const refreshed = await refreshGoogleToken(sb, chosen);
        if (refreshed?.accessToken) {
          del = await googleDeleteEvent(
            calendarId,
            externalEventId,
            refreshed.accessToken
          );
        }
      }

      // If not found, try 'primary' as a small fallback
      if (del.kind === "error") {
        const reason =
          (del.details?.error?.errors?.[0]?.reason as string | undefined) ||
          "";
        if (reason === "notFound" && calendarId !== "primary") {
          const second = await googleDeleteEvent(
            "primary",
            externalEventId,
            accessToken
          );
          if (second.kind === "ok") {
            calendarId = "primary";
            del = second;
          }
        }
      }

      if (del.kind !== "ok") {
        const status = del.kind === "error" ? del.status : 401;
        const details = del.kind === "error" ? del.details : null;
        return NextResponse.json(
          {
            error: "Google delete failed",
            details,
            attempted: { calendarId, eventId: externalEventId },
          },
          { status }
        );
      }
    } else if (chosen.provider === "microsoft") {
      const del = await microsoftDeleteEvent(externalEventId, chosen.access_token!);
      if (del.kind !== "ok") {
        return NextResponse.json(
          { error: "Microsoft delete failed", details: del.details },
          { status: del.status }
        );
      }
    } else {
      return NextResponse.json(
        { error: `Unsupported provider: ${chosen.provider}` },
        { status: 400 }
      );
    }

    // 4) Mark this appointment cancelled (idempotent)
    const updated_at = new Date().toISOString();
    const { error: updErr } = await admin()
      .from("appointments")
      .update({
        status: "cancelled",
        external_calendar_id: calendarId, // self-heal the correct calendar
        updated_at,
      })
      .eq("id", appt.id);

    if (updErr) {
      // Provider delete succeeded but DB update failed — still OK
      return NextResponse.json({
        ok: true,
        event_id: externalEventId,
        dbUpdate: "failed",
      });
    }

    return NextResponse.json({
      ok: true,
      provider: chosen.provider,
      appointmentId: appt.id,
      event_id: externalEventId,
      calendarId,
      mode: "provider",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unhandled error", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
