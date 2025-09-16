import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

type BodyIn = {
  botId?: string; bot_id?: string; userId?: string;
  eventId: string; // external_event_id on provider
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BodyIn;
    const botId = body.botId ?? body.bot_id ?? null;
    const userIdDir = body.userId ?? null;
    const eventId = body.eventId;

    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
    if (!botId && !userIdDir) return NextResponse.json({ error: "botId or userId required" }, { status: 400 });

    const sb = admin();

    // resolve owner user
    let ownerUserId = userIdDir;
    if (!ownerUserId) {
      const { data: botRow, error: botErr } = await sb.from("bots").select("user_id").eq("id", botId).single();
      if (botErr || !botRow) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
      ownerUserId = botRow.user_id as string;
    }

    // load integration row (primary); prefer google
    const { data: icRows, error: icErr } = await sb
      .from("integrations_calendar")
      .select("*")
      .eq("user_id", ownerUserId)
      .eq("calendar_id", "primary")
      .order("provider", { ascending: true })
      .order("connected_at", { ascending: false });

    if (icErr || !icRows?.length) return NextResponse.json({ error: "No calendar connection (primary)" }, { status: 400 });

    const ic = icRows.find(r => r.provider === "google" && r.access_token) ?? icRows[0];
    if (!ic.access_token) return NextResponse.json({ error: "No access_token for calendar" }, { status: 400 });

    // call provider delete
    if (ic.provider === "google") {
      const resDel = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ic.access_token}` },
      });
      if (!resDel.ok && resDel.status !== 410 /*gone*/) {
        const j = await resDel.json().catch(() => ({}));
        return NextResponse.json({ error: "Google delete failed", details: j }, { status: resDel.status });
      }
    } else if (ic.provider === "microsoft") {
      const resDel = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ic.access_token}` },
      });
      if (!resDel.ok && resDel.status !== 404) {
        const j = await resDel.json().catch(() => ({}));
        return NextResponse.json({ error: "Microsoft delete failed", details: j }, { status: resDel.status });
      }
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${ic.provider}` }, { status: 400 });
    }

    // mark as cancelled in DB (if exists)
    if (botId) {
      await sb
        .from("appointments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("bot_id", botId)
        .eq("external_event_id", eventId);
    } else {
      // in case only userId was provided and multiple bots exist, fallback by event id only
      await sb
        .from("appointments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("external_event_id", eventId);
    }

    return NextResponse.json({ ok: true, event_id: eventId });
  } catch (e: any) {
    return NextResponse.json({ error: "Unhandled error", details: String(e?.message ?? e) }, { status: 500 });
  }
}
