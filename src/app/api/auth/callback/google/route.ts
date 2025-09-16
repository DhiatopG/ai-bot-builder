import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // <- your APP user id
  if (!code || !state) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const redirectUri = `${process.env.SITE_URL}/api/auth/callback/google`;

  try {
    // 1) exchange code -> tokens
    const body = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "authorization_code",
      code,
      redirect_uri:  redirectUri,
    });

    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokRes.ok) {
      const detail = await tokRes.text();
      console.error("[callback] token_exchange_failed:", detail);
      return NextResponse.json({ error: "token_exchange_failed", detail }, { status: 400 });
    }

    const tok = await tokRes.json() as { access_token: string; refresh_token?: string; expires_in: number };
    const expires_at = Math.floor(Date.now() / 1000) + (tok.expires_in ?? 0);

    // 2) upsert (service role bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("integrations_calendar")
      .upsert(
        {
          user_id: state,             // APP user id (public.users.id)
          provider: "google",
          access_token: tok.access_token,
          refresh_token: tok.refresh_token ?? null,
          expires_at,
        },
        { onConflict: "user_id,provider" }
      );

    if (error) {
      console.error("[callback] db_upsert_failed:", error.message);
      return NextResponse.json({ error: "db_upsert_failed", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[callback] crash:", e);
    return NextResponse.json({ error: "callback_crash", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
