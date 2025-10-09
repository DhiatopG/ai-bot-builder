import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /api/appointments/find-upcoming-by-email
 * Body: { botId: string, email: string, debug?: boolean }
 * Always returns 200 with { ok: true/false, ... }
 */
export async function POST(req: NextRequest) {
  try {
    const { botId, email, debug } = await req.json();
    if (!botId || !email) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 200 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    );

    const normEmail = String(email).trim().toLowerCase();

    // --- DEBUG: return last 5 rows for this bot/email (no filters) ---
    if (debug === true) {
      const { data: rows, error: dbgErr } = await supabase
        .from("appointments")
        .select("*")
        .eq("bot_id", botId)
        .eq("invitee_email", normEmail)
        .order("start_time", { ascending: false })
        .limit(5);

      if (dbgErr) {
        return NextResponse.json({ ok: false, error: dbgErr.message }, { status: 200 });
      }
      return NextResponse.json({ ok: true, debug: { rows } }, { status: 200 });
    }

    // Be flexible on status names
    const ALLOWED_STATUSES = ["confirmed", "booked", "accepted"];

    // Soonest FUTURE appointment for bot + email with an allowed status
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        external_event_id,
        start_time,
        end_time,
        status
      `)
      .eq("bot_id", botId)
      .eq("invitee_email", normEmail)
      .in("status", ALLOWED_STATUSES)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }
    if (!data) {
      // Not found → still 200 so the client code is simple
      return NextResponse.json({ ok: false, error: "no_upcoming_match" }, { status: 200 });
    }

    const startISO: string | null =
      (data as any).start_time ?? (data as any).start_at ?? (data as any).start ?? null;

    const endISO: string | null =
      (data as any).end_time ?? (data as any).end_at ?? (data as any).end ?? null;

    let durationMin = 30;
    if (startISO && endISO) {
      const ms = +new Date(endISO) - +new Date(startISO);
      if (Number.isFinite(ms) && ms > 0) durationMin = Math.round(ms / 60000);
    }

    const eventId = (data as any).external_event_id || (data as any).id;

    return NextResponse.json(
      { ok: true, appointment: { eventId, startISO, durationMin } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "server_error" }, { status: 200 });
  }
}

// Optional: cleaner message if someone opens this URL directly
export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: "use POST" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
}
