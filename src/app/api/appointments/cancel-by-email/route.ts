// src/app/api/appointments/cancel-by-email/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ratelimit } from "@/lib/rateLimiter";

// Force Node runtime (service role key is not safe on edge)
export const runtime = "nodejs";

// --- ENV (must exist) ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Optional: comma-separated list, e.g. "https://www.in60second.net,https://in60second.net,http://localhost:3000"
const ALLOWED_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- helpers ---
function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}
function normEmail(e?: string | null) {
  return (e ?? "").trim().toLowerCase();
}
function safeISO(d?: string | null) {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function buildAppBase(req: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}
function withCors(res: NextResponse, req: Request) {
  const origin = req.headers.get("origin") || "";
  const allow =
    ALLOWED_ORIGINS.length === 0
      ? "*" // permissive (dev)
      : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] || origin || "*";
  res.headers.set("Access-Control-Allow-Origin", allow);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

// --- types ---
type BodyIn = {
  botId?: string; // required
  email?: string; // required (invitee_email)
  appointmentId?: string; // optional: exact row if belongs to botId+email and is upcoming+confirmed
  startsAt?: string; // optional ISO; exact match against starts_at (UTC)
};

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function POST(req: Request) {
  // ---- Upstash Rate Limit (keyed by botId + client IP) ----
  // We need botId to build the key; parse it minimally from body without fully consuming stream twice.
  let parsed: BodyIn | null = null;
  try {
    parsed = (await req.json()) as BodyIn;
  } catch {
    const res = NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    return withCors(res, req);
  }

  const botId = (parsed.botId || "").trim();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!botId) {
    const res = NextResponse.json({ ok: false, error: "botId required" }, { status: 400 });
    return withCors(res, req);
  }

  const rlKey = `${botId}:${ip}`;
  const { success, limit, remaining, reset } = await ratelimit.limit(rlKey);
  if (!success) {
    const res = NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
    return withCors(res, req);
  }

  // ---- main logic (now that we're allowed) ----
  try {
    const email = normEmail(parsed.email);
    const appointmentId = (parsed.appointmentId || "").trim();
    const startsAtISO = safeISO(parsed.startsAt);

    if (!email) {
      const res = NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
      return withCors(res, req);
    }

    const sb = admin();

    // 1) Choose target appointment
    //    Priority: appointmentId → startsAt → soonest upcoming confirmed
    let row:
      | {
          id: string;
          bot_id: string;
          status: string;
          starts_at: string;
          ends_at: string | null;
          invitee_email: string | null;
          provider: string | null;
          provider_event_id: string | null;
          external_event_id: string | null;
        }
      | null = null;

    if (appointmentId) {
      const { data, error } = await sb
        .from("appointments")
        .select(
          "id, bot_id, status, starts_at, ends_at, invitee_email, provider, provider_event_id, external_event_id"
        )
        .eq("id", appointmentId)
        .eq("bot_id", botId)
        .eq("status", "confirmed")
        .gte("starts_at", new Date().toISOString())
        .ilike("invitee_email", email)
        .maybeSingle();

      if (error) {
        const res = NextResponse.json(
          { ok: false, error: "lookup_failed", details: error.message },
          { status: 500 }
        );
        return withCors(res, req);
      }
      row = data ?? null;
      if (!row) {
        const res = NextResponse.json(
          { ok: false, error: "no_upcoming_match_for_id" },
          { status: 404 }
        );
        return withCors(res, req);
      }
    } else if (startsAtISO) {
      const { data, error } = await sb
        .from("appointments")
        .select(
          "id, bot_id, status, starts_at, ends_at, invitee_email, provider, provider_event_id, external_event_id"
        )
        .eq("bot_id", botId)
        .eq("status", "confirmed")
        .eq("starts_at", startsAtISO)
        .ilike("invitee_email", email)
        .maybeSingle();

      if (error) {
        const res = NextResponse.json(
          { ok: false, error: "lookup_failed", details: error.message },
          { status: 500 }
        );
        return withCors(res, req);
      }
      row = data ?? null;
      if (!row) {
        const res = NextResponse.json(
          { ok: false, error: "no_exact_match_for_startsAt" },
          { status: 404 }
        );
        return withCors(res, req);
      }
    } else {
      const { data, error } = await sb
        .from("appointments")
        .select(
          "id, bot_id, status, starts_at, ends_at, invitee_email, provider, provider_event_id, external_event_id"
        )
        .eq("bot_id", botId)
        .eq("status", "confirmed")
        .gte("starts_at", new Date().toISOString())
        .ilike("invitee_email", email) // case-insensitive exact match
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        const res = NextResponse.json(
          { ok: false, error: "lookup_failed", details: error.message },
          { status: 500 }
        );
        return withCors(res, req);
      }
      row = data ?? null;
      if (!row) {
        const res = NextResponse.json({ ok: false, error: "no_upcoming_match" }, { status: 404 });
        return withCors(res, req);
      }
    }

    // 2) If we have a calendar event id, call the existing cancel endpoint (handles Google/Outlook + DB)
    if (row.external_event_id) {
      const base = buildAppBase(req);
      const cancelRes = await fetch(`${base}/api/appointments/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, eventId: row.external_event_id }),
      });

      if (!cancelRes.ok) {
        let details: any = null;
try {
  details = await cancelRes.json();
} catch (err) {
  // Keep response useful without breaking lint rules
  details = { parseError: String((err as Error)?.message ?? err) };
}
        const res = NextResponse.json(
          { ok: false, error: "provider_cancel_failed", details },
          { status: cancelRes.status }
        );
        return withCors(res, req);
      }

      const res = NextResponse.json({
        ok: true,
        mode: "provider",
        appointmentId: row.id,
        external_event_id: row.external_event_id,
      });
      return withCors(res, req);
    }

    // 3) Fallback: mark as cancelled in DB only (no external id to delete)
    const { error: updErr } = await sb
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updErr) {
      const res = NextResponse.json(
        { ok: false, error: "db_cancel_failed", details: updErr.message },
        { status: 500 }
      );
      return withCors(res, req);
    }

    const res = NextResponse.json({
      ok: true,
      mode: "db_only",
      appointmentId: row.id,
      external_event_id: null,
    });
    return withCors(res, req);
  } catch (e: any) {
    const res = NextResponse.json(
      { ok: false, error: "unhandled", details: String(e?.message ?? e) },
      { status: 500 }
    );
    return withCors(res, req);
  }
}
