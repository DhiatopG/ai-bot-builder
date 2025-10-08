import { NextRequest, NextResponse } from "next/server";
// Replace with your existing Supabase server client helper
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { botId, email } = await req.json();
    if (!botId || !email) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // use your secure server helper
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    );

    const normEmail = String(email).trim().toLowerCase();

    // Adjust table/column names to your schema
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        external_event_id,
        start_time,
        duration_min,
        status
      `)
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

    const eventId = data.external_event_id || data.id;
    return NextResponse.json({
      ok: true,
      appointment: {
        eventId,
        startISO: data.start_time,
        durationMin: data.duration_min ?? 30
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "server_error" }, { status: 500 });
  }
}
