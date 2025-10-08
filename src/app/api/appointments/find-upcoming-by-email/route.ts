import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /api/appointments/find-upcoming-by-email
 * Body: { botId: string, email: string }
 * Returns: { ok: true, appointment: { eventId, startISO, durationMin } } | { ok: false, error }
 */
export async function POST(req: NextRequest) {
  try {
    const { botId, email } = await req.json();
    if (!botId || !email) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // use your secure server key/helper
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    );

    const normEmail = String(email).trim().toLowerCase();

    // Select only common columns that are likely to exist in your schema.
    // If your column names differ, adjust here (e.g., start_at vs start_time).
    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        external_event_id,
        start_time,
        end_time,
        status,
        invitee_email,
        bot_id
      `
      )
      .eq("bot_id", botId)
      .eq("invitee_email", normEmail)
      .eq("status", "confirmed")
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "no_upcoming_match" }, { status: 404 });
    }

    // Compute duration if possible; otherwise default to 30 minutes.
    const startISO: string =
      (data as any).start_time ??
      (data as any).start_at ??
      (data as any).start ??
      null;

    const endISO: string =
      (data as any).end_time ??
      (data as any).end_at ??
      (data as any).end ??
      null;

    let durationMin = 30;
    if (startISO && endISO) {
      const ms = +new Date(endISO) - +new Date(startISO);
      if (Number.isFinite(ms) && ms > 0) durationMin = Math.round(ms / 60000);
    }

    const eventId = (data as any).external_event_id || (data as any).id;

    return NextResponse.json({
      ok: true,
      appointment: {
        eventId,
        startISO: startISO ?? null,
        durationMin,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server_error" },
      { status: 500 }
    );
  }
}
