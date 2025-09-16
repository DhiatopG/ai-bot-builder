import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// GET /api/calendar/status?userId=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "missing_userId" }, { status: 400 });

  const { data, error } = await supabase
    .from("integrations_calendar")
    .select("refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });

  const connected = !!data?.refresh_token;
  const expiresAt = data?.expires_at ?? null;

  return NextResponse.json({ connected, expiresAt });
}
