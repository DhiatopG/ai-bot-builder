import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// POST /api/calendar/disconnect  { userId: string }
export async function POST(req: NextRequest) {
  const { userId } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: "missing_userId" }, { status: 400 });

  const { error } = await supabase
    .from("integrations_calendar")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");

  if (error) {
    return NextResponse.json({ error: "db_delete_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
