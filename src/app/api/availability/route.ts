// /src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// ---- RUNTIME / CACHING ----
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- TYPES ----
type Busy = { start: string; end: string }; // ISO UTC strings
type IncludedStatus = "pending" | "confirmed" | "rescheduled";
type ApptRow = {
  starts_at: string | null;
  ends_at: string | null;
  status: IncludedStatus | string | null;
};

// ---- CONSTANTS ----
const DEFAULT_TZ = "Africa/Tunis";
const DEFAULT_DURATION_MIN = 30;
const INCLUDED_STATUSES: IncludedStatus[] = ["pending", "confirmed", "rescheduled"];

// If your UI uses a fixed grid, keep 30m (or 15m). You can make this configurable via ?step=15
const DEFAULT_STEP_MIN = 30; // step for generating grid if you rely on fallback
const DEFAULT_OPEN = "09:00";  // fallback working hours if you don't have your own source
const DEFAULT_CLOSE = "17:00"; // fallback working hours if you don't have your own source

// QUICK bounds on allowed duration
function clampDuration(v: string | null, fallback = DEFAULT_DURATION_MIN) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.round(n);
  return Math.min(180, Math.max(5, i)); // 5–180 minutes
}

// ---- TIME HELPERS (TZ-light; assumes Africa/Tunis = UTC+01:00, no DST) ----
function offsetMinutesForTZ(tz: string): number {
  // Africa/Tunis is effectively UTC+01:00 (no DST)
  if ((tz || "").toLowerCase() === "africa/tunis") return 60;
  // Fallback: UTC
  return 0;
}

function parseHHMM(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((x) => parseInt(x, 10));
  return { h: Number.isFinite(hh) ? hh : 0, m: Number.isFinite(mm) ? mm : 0 };
}

// Build a UTC Date that corresponds to the given local wall time in the provided tz offset.
// If tz = +60 minutes (Africa/Tunis), "2025-10-02 09:00" local → 08:00 UTC.
function localToUTC(dateStr: string, hhmm: string, offsetMin: number): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const { h, m } = parseHHMM(hhmm);
  const asUTC = Date.UTC(y, (mo || 1) - 1, d || 1, h, m, 0, 0);
  const utcMs = asUTC - offsetMin * 60_000; // subtract local offset to reach UTC
  const dUtc = new Date(utcMs);
  dUtc.setSeconds(0, 0);
  return dUtc;
}

function toISO(d: Date) {
  const x = new Date(d);
  x.setSeconds(0, 0);
  return x.toISOString();
}

function halfOpenOverlap(a1: Date, a2: Date, b1: Date, b2: Date) {
  // [start, end)
  return a1 < b2 && b1 < a2;
}

// ---- MERGE RANGES ----
function mergeBusy(busy: Busy[]): Busy[] {
  if (!busy.length) return [];
  const sorted = [...busy].sort((a, b) => a.start.localeCompare(b.start));
  const out: Busy[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push({ ...r });
      continue;
    }
    const lastEnd = new Date(last.end).getTime();
    const curStart = new Date(r.start).getTime();
    const curEnd = new Date(r.end).getTime();
    if (curStart <= lastEnd) {
      if (curEnd > lastEnd) last.end = r.end;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

// ---- SIMPLE SLOT GENERATOR (used only if you don't already have your own) ----
function generateSlotsHHMM(openHHMM: string, closeHHMM: string, stepMin: number): string[] {
  const { h: oh, m: om } = parseHHMM(openHHMM);
  const { h: ch, m: cm } = parseHHMM(closeHHMM);
  const startMin = oh * 60 + om;
  const endMin = ch * 60 + cm;

  if (endMin <= startMin) return []; // invalid window
  const out: string[] = [];
  for (let t = startMin; t + stepMin <= endMin; t += stepMin) {
    const hh = Math.floor(t / 60);
    const mm = t % 60;
    out.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}

// ---- ROUTE ----
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const botId = url.searchParams.get("botId") || "";
    const dateStr = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const tz = url.searchParams.get("tz") || DEFAULT_TZ;
    const durationMin = clampDuration(url.searchParams.get("duration"), DEFAULT_DURATION_MIN);
    const stepMin = clampDuration(url.searchParams.get("step"), DEFAULT_STEP_MIN);
    const debug = url.searchParams.get("debug") === "1";

    if (!botId) {
      return NextResponse.json({ error: "botId required" }, { status: 400 });
    }

    // ---- SLOT SOURCE (KEEP YOUR CURRENT LOGIC IF YOU HAVE IT) ----
    // If you already create ["HH:MM", ...] elsewhere (e.g., reading bot hours),
    // just replace the next line with that function call.
    const slotsHHMM: string[] = generateSlotsHHMM(DEFAULT_OPEN, DEFAULT_CLOSE, stepMin);

    // ---- DAY WINDOW IN LOCAL, COMPARE IN UTC ----
    const offsetMin = offsetMinutesForTZ(tz);
    // local midnight → UTC
    const dayStartUTC = localToUTC(dateStr, "00:00", offsetMin);
    // local end (exclusive) → UTC ; use 24:00 as end
    const dayEndUTC = localToUTC(dateStr, "24:00", offsetMin);
    const dayStartISO = toISO(dayStartUTC);
    const dayEndISO = toISO(dayEndUTC);

    // ---- LOAD DB BUSY WINDOWS ----
    // FIX #1: await the client (your wrapper returns a Promise)
    const supabase = await createServerClient();

    const { data: appts, error: dberr } = await supabase
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("bot_id", botId)
      .in("status", INCLUDED_STATUSES as string[])
      // overlap with the day window (half-open)
      .filter("starts_at", "lt", dayEndISO)
      .filter("ends_at", "gt", dayStartISO);

    if (dberr) {
      return NextResponse.json(
        { error: dberr.message },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    // FIX #2: add explicit param types to avoid implicit any
    const dbBusyRaw: Busy[] = ((appts || []) as ApptRow[])
      .filter((r: ApptRow) => !!r.starts_at && !!r.ends_at)
      .map((r: ApptRow) => ({
        start: toISO(new Date(r.starts_at as string)),
        end: toISO(new Date(r.ends_at as string)),
      }));

    const dbBusy = mergeBusy(dbBusyRaw);

    // ---- FILTER SLOTS AGAINST BUSY (HALF-OPEN) ----
    const filtered = slotsHHMM.filter((hhmm: string) => {
      const sUTC = localToUTC(dateStr, hhmm, offsetMin);
      const eUTC = new Date(sUTC.getTime() + durationMin * 60_000);
      for (const b of dbBusy) {
        const bS = new Date(b.start);
        const bE = new Date(b.end);
        if (halfOpenOverlap(sUTC, eUTC, bS, bE)) return false;
      }
      return true;
    });

    // ---- RESPONSE ----
    const body: Record<string, any> = {
      slots: filtered, // keep the simple ["HH:MM"] your UI expects
    };

    if (debug) {
      body.included_statuses = INCLUDED_STATUSES;
      body.db_busy = dbBusy;
      body.day_window_local = { start: `${dateStr} 00:00`, end: `${dateStr} 24:00`, tz };
      body.day_window_utc = { start: dayStartISO, end: dayEndISO };
      body.duration_min = durationMin;
      body.step_min = stepMin;
    }

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
