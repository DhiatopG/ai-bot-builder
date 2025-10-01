// src/app/api/bots/set-timezone/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  const { botId, timezone } = await req.json().catch(() => ({}));
  if (!botId || !timezone) {
    return NextResponse.json({ ok: false, error: "botId and timezone required" }, { status: 400 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { error } = await sb.from("bots").update({ default_timezone: timezone }).eq("id", botId).limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
