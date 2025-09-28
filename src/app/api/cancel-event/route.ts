// src/app/api/cancel-event/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role must not run on edge
export const runtime = "nodejs";

// --- ENV ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

type BodyIn = {
  botId?: string;           // preferred for public/UI calls
  bot_id?: string;          // alias
  userId?: string;          // admin/dashboard flow
  eventId?: string;         // provider event id (Google/Microsoft)
  code?: string;            // alias for eventId (lets UI pass a "code")
};

export async function POST(req: Request) {
  try {
    let body: BodyIn;
    try {
      body = (await req.json()) as BodyIn;
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: "invalid_json", details: String(e?.message ?? e) },
        { status: 400 }
      );
    }

    const botId = body.botId ?? body.bot_id ?? null;
    const userIdDir = body.userId ?? null;
    const eventId = body.eventId ?? body.code ?? null; // accept "code" as alias

    if (!eventId) {
      return NextResponse.json(
        {
          ok: false,
          error: "eventId required",
          hint: "Provide eventId (or code). If you only have email/phone, call /api/appointments/cancel-by-email instead.",
        },
        { status: 400 }
      );
    }
    if (!botId && !userIdDir) {
      return NextResponse.json(
        {
          ok: false,
          error: "botId or userId required",
          hint: "Send botId for public UI calls; userId is for admin/dashboard only.",
        },
        { status: 400 }
      );
    }

    const sb = admin();

    // Resolve owner user id (who connected the calendar)
    let ownerUserId = userIdDir;
    if (!ownerUserId) {
      const { data: botRow, error: botErr } = await sb
        .from("bots")
        .select("user_id")
        .eq("id", botId)
        .single();

      if (botErr || !botRow) {
        return NextResponse.json(
          { ok: false, error: "bot_not_found", details: botErr?.message },
          { status: 404 }
        );
      }
      ownerUserId = botRow.user_id as string;
    }

    // Load calendar connection (prefer Google on "primary")
    const { data: icRows, error: icErr } = await sb
      .from("integrations_calendar")
      .select("*")
      .eq("user_id", ownerUserId)
      .eq("calendar_id", "primary")
      .order("provider", { ascending: true })
      .order("connected_at", { ascending: false });

    if (icErr) {
      return NextResponse.json(
        { ok: false, error: "calendar_lookup_failed", details: icErr.message },
        { status: 500 }
      );
    }
    if (!icRows?.length) {
      return NextResponse.json(
        { ok: false, error: "no_calendar_connection", hint: "Connect a primary calendar first." },
        { status: 400 }
      );
    }

    const ic = icRows.find((r) => r.provider === "google" && r.access_token) ?? icRows[0];
    if (!ic?.access_token) {
      return NextResponse.json(
        { ok: false, error: "no_access_token", hint: "Re-connect calendar to refresh tokens." },
        { status: 400 }
      );
    }

    // --- Provider delete ---
    if (ic.provider === "google") {
      const resDel = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
          eventId
        )}?sendUpdates=all`,
        { method: "DELETE", headers: { Authorization: `Bearer ${ic.access_token}` } }
      );

      if (!resDel.ok && resDel.status !== 410 /* gone */) {
        let j: any = null;
        try {
          j = await resDel.json();
        } catch (err: any) {
          j = { parseError: String(err?.message ?? err) };
        }
        return NextResponse.json(
          { ok: false, error: "google_delete_failed", details: j },
          { status: resDel.status }
        );
      }
    } else if (ic.provider === "microsoft") {
      const resDel = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${ic.access_token}` } }
      );

      if (!resDel.ok && resDel.status !== 404 /* not found */) {
        let j: any = null;
        try {
          j = await resDel.json();
        } catch (err: any) {
          j = { parseError: String(err?.message ?? err) };
        }
        return NextResponse.json(
          { ok: false, error: "microsoft_delete_failed", details: j },
          { status: resDel.status }
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "unsupported_provider", provider: ic.provider },
        { status: 400 }
      );
    }

    // --- Mark as cancelled in DB (best-effort) ---
    const nowISO = new Date().toISOString();
    if (botId) {
      await sb
        .from("appointments")
        .update({ status: "cancelled", updated_at: nowISO })
        .eq("bot_id", botId)
        .eq("external_event_id", eventId);
    } else {
      await sb
        .from("appointments")
        .update({ status: "cancelled", updated_at: nowISO })
        .eq("external_event_id", eventId);
    }

    return NextResponse.json({ ok: true, event_id: eventId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "unhandled_error", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
