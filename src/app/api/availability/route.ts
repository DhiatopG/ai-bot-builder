// /src/app/api/availability/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type ApptRow = {
  starts_at: string; // ISO
  ends_at: string;   // ISO
  status: string;
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
  const d = new Date(`${dateStr}T00:00:00`);
  const { h, m } = parseHHMM(hhmm);
  d.setHours(h, m, 0, 0);
  return d;
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60000);
}

function fmtHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const botId = url.searchParams.get("botId") || "";
    const date = url.searchParams.get("date") || ""; // YYYY-MM-DD
    const tz =
      url.searchParams.get("timezone") ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";
    const duration = clampDuration(url.searchParams.get("duration"), 30);

    if (!botId || !date) {
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
    const supabase = await createServerClient();

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
        start: new Date(a.starts_at),
        end: new Date(a.ends_at),
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
