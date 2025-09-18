// /src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type ApptRow = {
  starts_at: string | null; // ISO
  ends_at: string | null;   // ISO
  status: string | null;
};

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

function clampDuration(v: string | null, fallback = 30) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.round(n);
  return Math.min(180, Math.max(5, i)); // 5–180
}

function parseHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 };
}

function atDateTime(dateStr: string, hhmm: string) {
  const d = new Date(`${dateStr}T00:00:00Z`); // anchor in Z then set H/M
  const { h, m } = parseHHMM(hhmm);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60000);
}

function fmtHHMM(d: Date) {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes()
  ).padStart(2, "0")}`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function ymd(d: Date) {
  // format YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const botId = url.searchParams.get("botId") || "";
    const scope = (url.searchParams.get("scope") || "").toLowerCase();

    // Accept both names: 'timezone' or 'tz'
    const tz =
      url.searchParams.get("timezone") ||
      url.searchParams.get("tz") ||
      "UTC";

    if (!botId) {
      return NextResponse.json(
        { error: "Missing botId" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // =========================
    // MODE A: Month grid (scope=days)
    // =========================
    if (scope === "days") {
      const monthStart = url.searchParams.get("monthStart"); // YYYY-MM-DD
      const monthEnd   = url.searchParams.get("monthEnd");   // YYYY-MM-DD
      const duration   = clampDuration(url.searchParams.get("duration"), 30);

      if (!monthStart || !monthEnd || !tz) {
        return NextResponse.json(
          { error: "Missing botId, monthStart, monthEnd, or timezone/tz" },
          { status: 400 }
        );
      }

      // Pull all appointments in the month window
      const isoStart = new Date(`${monthStart}T00:00:00.000Z`).toISOString();
      const isoEnd   = new Date(`${monthEnd}T23:59:59.999Z`).toISOString();

      const { data: appts, error } = await supabase
        .from("appointments")
        .select("starts_at, ends_at, status")
        .eq("bot_id", botId)
        .in("status", ["confirmed", "rescheduled"])
        .gte("starts_at", isoStart)
        .lte("starts_at", isoEnd);

      if (error) {
        console.error("[availability days] DB error:", error.message);
      }

      // Build a map of busy windows per day
      const busyByDay = new Map<string, Array<{ start: Date; end: Date }>>();
      for (const a of appts ?? []) {
        if (!a.starts_at || !a.ends_at) continue;
        const s = new Date(a.starts_at);
        const e = new Date(a.ends_at);
        const dayKey = ymd(s);
        const list = busyByDay.get(dayKey) ?? [];
        list.push({ start: s, end: e });
        busyByDay.set(dayKey, list);
      }

      // Walk each day in [monthStart, monthEnd] and see if at least one slot is free
      const days: string[] = [];
      let p = new Date(`${monthStart}T00:00:00Z`);
      const endGuard = new Date(`${monthEnd}T00:00:00Z`);

      while (p <= endGuard) {
        const dayKey = ymd(p);

        // Generate raw slots for this day
        const dayStart = atDateTime(dayKey, DEFAULT_START);
        const dayEnd   = atDateTime(dayKey, DEFAULT_END);

        let hasFree = false;
        const busy = busyByDay.get(dayKey) ?? [];

        // Walk slots until we find at least one not overlapping
        for (let t = new Date(dayStart); t < dayEnd; t = addMinutes(t, duration)) {
          const start = new Date(t);
          const end = addMinutes(start, duration);
          if (end > dayEnd) break;

          let collides = false;
          for (const w of busy) {
            if (overlaps(start, end, w.start, w.end)) {
              collides = true;
              break;
            }
          }
          if (!collides) {
            hasFree = true;
            break;
          }
        }

        if (hasFree) days.push(dayKey);
        // next day
        p = addMinutes(p, 24 * 60);
      }

      return NextResponse.json({
        bot_id: botId,
        timezone: tz,
        month_start: monthStart,
        month_end: monthEnd,
        available_days: days, // e.g. ["2025-09-01","2025-09-02",...]
      });
    }

    // =========================
    // MODE B: Single day (default)
    // =========================
    const date = url.searchParams.get("date") || ""; // YYYY-MM-DD
    const duration = clampDuration(url.searchParams.get("duration"), 30);

    if (!date) {
      return NextResponse.json(
        { error: "Missing botId or date (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Generate raw slots from default business hours (replace with per-bot hours later)
    const dayStart = atDateTime(date, DEFAULT_START);
    const dayEnd = atDateTime(date, DEFAULT_END);

    const rawSlots: Array<{ start: Date; end: Date; label: string }> = [];
    for (let t = new Date(dayStart); t < dayEnd; t = addMinutes(t, duration)) {
      const start = new Date(t);
      const end = addMinutes(start, duration);
      if (end > dayEnd) break;
      rawSlots.push({ start, end, label: fmtHHMM(start) });
    }

    // Fetch existing appointments for that bot on this date and remove overlaps
    const isoDayStart = new Date(date + "T00:00:00.000Z").toISOString();
    const isoDayEnd = new Date(date + "T23:59:59.999Z").toISOString();

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("bot_id", botId)
      .in("status", ["confirmed", "rescheduled"])
      .gte("starts_at", isoDayStart)
      .lte("starts_at", isoDayEnd);

    if (error) {
      console.error("[availability] DB error:", error.message);
    }

    const busyWindows = (appts ?? [])
      .filter((a: ApptRow) => a.starts_at && a.ends_at)
      .map((a: ApptRow) => ({
        start: new Date(a.starts_at as string),
        end: new Date(a.ends_at as string),
      }));

    const freeSlots = rawSlots.filter(({ start, end }) => {
      for (const w of busyWindows) {
        if (overlaps(start, end, w.start, w.end)) return false;
      }
      return true;
    });

    // (Future) subtract Google/Microsoft busy blocks here before returning

    const slots = freeSlots.map((s) => s.label);

    return NextResponse.json({
      bot_id: botId,
      date,
      timezone: tz,
      slot_duration_min: duration,
      slots, // e.g. ["09:00","09:30",...]
    });
  } catch (e: any) {
    console.error("[availability] fatal:", e?.message || e);
    return NextResponse.json(
      { error: "Failed to compute availability" },
      { status: 500 }
    );
  }
}
