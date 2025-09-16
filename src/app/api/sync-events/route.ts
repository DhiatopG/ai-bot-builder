import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}
const nowEpoch = () => Math.floor(Date.now() / 1000);

type BodyIn = {
  botId?: string; bot_id?: string; userId?: string;
  // Optional fallback window (days) if we don't find any DB updates for this bot
  lookbackDays?: number; // default 30
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BodyIn;
    const botId      = body.botId ?? body.bot_id ?? null;
    const userIdDir  = body.userId ?? null;
    const lookback   = Math.max(1, Math.min(90, body.lookbackDays ?? 30)); // 1..90 days

    if (!botId && !userIdDir) {
      return NextResponse.json({ error: "botId or userId required" }, { status: 400 });
    }

    const sb = admin();

    // ---- resolve owner user id ----
    let ownerUserId = userIdDir;
    if (!ownerUserId) {
      const { data: botRow, error: botErr } = await sb.from("bots").select("user_id").eq("id", botId).single();
      if (botErr || !botRow) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
      ownerUserId = botRow.user_id as string;
    }

    // ---- load integration (primary), prefer google ----
    const { data: icRows, error: icErr } = await sb
      .from("integrations_calendar")
      .select("*")
      .eq("user_id", ownerUserId)
      .eq("calendar_id", "primary")
      .order("provider", { ascending: true })
      .order("connected_at", { ascending: false });

    if (icErr || !icRows?.length) {
      return NextResponse.json({ error: "No calendar connection (primary)" }, { status: 400 });
    }

    const ic = icRows.find(r => r.provider === "google" && r.access_token) ?? icRows[0];
    if (!ic.access_token) return NextResponse.json({ error: "No access_token for calendar" }, { status: 400 });

    // ---- token hygiene (Google) ----
    let accessToken = ic.access_token as string;
    if (ic.provider === "google") {
      const expiresAt = Number(ic.expires_at || 0);
      if (expiresAt && nowEpoch() > (expiresAt - 120) && ic.refresh_token) {
        const refreshed = await refreshGoogleToken(ic.refresh_token);
        if (!refreshed.ok) return NextResponse.json({ error: "Failed to refresh Google token", details: refreshed.error }, { status: 401 });
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
    } else {
      return NextResponse.json({ error: `Sync for provider ${ic.provider} not implemented` }, { status: 400 });
    }

    // ---- choose an updatedMin without adding any new tables/columns ----
    // We look at our own appointments (most recent updated_at for this bot & provider),
    // and sync changes since a few minutes before that. If none, look back N days.
    let updatedMinISO: string;
    if (botId) {
      const { data: lastRow } = await sb
        .from("appointments")
        .select("updated_at")
        .eq("bot_id", botId)
        .eq("provider", ic.provider)
        .eq("external_calendar_id", ic.calendar_id ?? "primary")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRow?.updated_at) {
        const t = new Date(lastRow.updated_at).getTime() - 5 * 60 * 1000; // -5 min safety
        updatedMinISO = new Date(t).toISOString();
      } else {
        updatedMinISO = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString();
      }
    } else {
      updatedMinISO = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString();
    }

    // ---- fetch changes from Google (incremental by updatedMin) ----
    // We include showDeleted to see cancellations; singleEvents to expand recurrences.
    let url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("maxResults", "2500");
    url.searchParams.set("orderBy", "updated");
    url.searchParams.set("updatedMin", updatedMinISO);

    let totalUpserts = 0;
    let totalCancelled = 0;

    while (true) {
      const gRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const gJson = await gRes.json();
      if (!gRes.ok) {
        return NextResponse.json({ error: "Google list error", details: gJson }, { status: gRes.status });
      }

      const items = (gJson.items ?? []) as any[];

      for (const ev of items) {
        const providerEventId = ev.id as string;
        const status = ev.status as string; // "confirmed", "cancelled", etc.

        if (status === "cancelled") {
          // mark our row cancelled if we have it
          const q = sb.from("appointments")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("external_event_id", providerEventId);
          if (botId) q.eq("bot_id", botId);
          await q;
          totalCancelled++;
          continue;
        }

        // extract start/end (support all-day events with .date)
        const startISO = ev.start?.dateTime ?? (ev.start?.date ? ev.start.date + "T00:00:00.000Z" : null);
        const endISO   = ev.end?.dateTime   ?? (ev.end?.date   ? ev.end.date   + "T00:00:00.000Z" : null);
        const tz       = ev.start?.timeZone ?? ev.end?.timeZone ?? "UTC";
        const summary  = ev.summary ?? "";
        const description = ev.description ?? "";
        const htmlLink = ev.htmlLink as string | undefined;
        const meetLink = (ev.hangoutLink as string | undefined) ?? ev?.conferenceData?.entryPoints?.[0]?.uri;

        if (!startISO || !endISO) continue; // skip malformed

        const insertRow: any = {
          bot_id: botId,
          provider: "google",
          status: "confirmed",
          starts_at: new Date(startISO).toISOString(),
          ends_at:   new Date(endISO).toISOString(),
          timezone: tz,
          external_event_id: providerEventId,
          external_calendar_id: ic.calendar_id ?? "primary",
          metadata: {
            ...((ev.attendees?.length && { attendees: ev.attendees }) || {}),
            htmlLink,
            hangoutLink: meetLink,
            summary,
            description,
            synced_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        };

        // If we can infer invitee from attendees, set invitee_email/name (optional)
        const invitee = Array.isArray(ev.attendees) ? ev.attendees.find((a: any) => a?.email && !a?.self) : null;
        if (invitee?.email) insertRow.invitee_email = invitee.email;
        if (invitee?.displayName) insertRow.invitee_name = invitee.displayName;

        // upsert by (bot_id, external_event_id)
        const { error: upErr } = await sb
          .from("appointments")
          .upsert(insertRow, { onConflict: "bot_id,external_event_id" });

        if (!upErr) totalUpserts++;
      }

      if (!gJson.nextPageToken) break;
      url.searchParams.set("pageToken", gJson.nextPageToken);
    }

    return NextResponse.json({
      ok: true,
      provider: ic.provider,
      updatedMin: updatedMinISO,
      upserts: totalUpserts,
      cancelled: totalCancelled,
    });
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
