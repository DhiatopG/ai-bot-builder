// src/lib/google/calendar.ts
import type { SupabaseClient } from "@supabase/supabase-js";
type Supa = SupabaseClient<any, "public", any>;

export type IntegrationRow = {
  user_id: string;
  calendar_id: string;           // e.g. 'primary'
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;     // unix seconds
};

function coerceIntegrationRow(row: any): IntegrationRow | null {
  if (!row) return null;
  let expires: number | null = null;
  if (typeof row.expires_at === "number") expires = row.expires_at;
  else if (row.expires_at != null) {
    const n = Number(row.expires_at);
    expires = Number.isFinite(n) ? n : null;
  }
  return {
    user_id: String(row.user_id),
    calendar_id: String(row.calendar_id ?? "primary"),
    access_token: row.access_token ?? null,
    refresh_token: row.refresh_token ?? null,
    expires_at: expires,
  };
}

async function refreshIfNeeded(
  supabase: Supa,
  integ: IntegrationRow
): Promise<IntegrationRow | null> {
  const now = Math.floor(Date.now() / 1000);
  const soon = now + 60;
  if (!integ.access_token || !integ.expires_at || integ.expires_at <= soon) {
    if (!integ.refresh_token) return null;

    const form = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integ.refresh_token,
      grant_type: "refresh_token",
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });

    const j = await resp.json();
    if (!resp.ok || !j.access_token) return null;

    const expires_at = Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600);

    await supabase
      .from("integrations_calendar")
      .update({ access_token: j.access_token, expires_at })
      .eq("user_id", integ.user_id)
      .eq("calendar_id", integ.calendar_id);

    return { ...integ, access_token: j.access_token, expires_at };
  }
  return integ;
}

export async function insertGoogleEvent(opts: {
  supabase: Supa;
  botId: string;
  appointment: { id: string; startISO: string; endISO: string };
  invitee_name: string;
  invitee_email: string;
  timezone: string;
}) {
  const { supabase, botId, appointment, invitee_name, invitee_email, timezone } = opts;

  // --- Find bot owner robustly (your table only has user_id) ---
  let ownerId: string | null = null;

  // Try selecting both (works if owner_user_id exists)
  const botTry = await supabase
    .from("bots")
    .select("owner_user_id, user_id")
    .eq("id", botId)
    .maybeSingle();

  if (botTry.error && /owner_user_id/i.test(botTry.error.message || "")) {
    // Fallback: select only user_id (your schema)
    const botFallback = await supabase
      .from("bots")
      .select("user_id")
      .eq("id", botId)
      .maybeSingle();
    ownerId = (botFallback.data as any)?.user_id ?? null;
  } else {
    ownerId =
      (botTry.data as any)?.owner_user_id ??
      (botTry.data as any)?.user_id ??
      null;
  }

  if (!ownerId) return { skipped: "no_owner" as const };

  // --- Find owner’s Google integration ---
  const { data: integRaw } = await supabase
    .from("integrations_calendar")
    .select("user_id, calendar_id, access_token, refresh_token, expires_at")
    .eq("user_id", ownerId)
    .eq("calendar_id", "primary")
    .maybeSingle();

  const integ = coerceIntegrationRow(integRaw);
  if (!integ) return { skipped: "no_integration" as const };

  // --- Ensure valid token (refresh if needed) ---
  const usable = await refreshIfNeeded(supabase, integ);
  if (!usable?.access_token) return { skipped: "no_access_token" as const };

  // --- Create event on Google ---
  const body = {
    summary: `Appointment with ${invitee_name}`,
    description:
      `Booked via your app\n` +
      `Invitee: ${invitee_name} <${invitee_email}>\n` +
      `Appointment ID: ${appointment.id}\n` +
      `Bot ID: ${botId}`,
    start: { dateTime: appointment.startISO, timeZone: timezone || "UTC" },
    end:   { dateTime: appointment.endISO,   timeZone: timezone || "UTC" },
    extendedProperties: { private: { appointment_id: appointment.id, bot_id: botId } },
  };

  const resp = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${usable.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const j = await resp.json().catch(() => ({}));
  if (!resp.ok || !j?.id) {
    return { error: "google_insert_failed" as const, status: resp.status, detail: j?.error ?? j };
  }

  return { eventId: j.id as string, calendarId: "primary" };
}
