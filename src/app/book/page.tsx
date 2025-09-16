// src/app/book/page.tsx
"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import BookingFormUI, { BookingPayload } from "@/components/BookingFormUI";

/** Parse "duration" from the querystring; default 30min, clamp 5..180 */
function parseDuration(s: string | null): number {
  const n = Number(s);
  if (!Number.isFinite(n)) return 30;
  const i = Math.round(n);
  return Math.min(180, Math.max(5, i));
}

/** Build "YYYY-MM-DDTHH:mm:00" from date ("YYYY-MM-DD") and time ("HH:mm") */
function toLocalISO(date: string, time: string) {
  return `${date}T${time}:00`;
}

/** Add minutes to "HH:mm" */
function addMinutesHHMM(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const total = h * 60 + m + minutes;
  const hh = Math.floor((total + 24 * 60) % (24 * 60) / 60)
    .toString()
    .padStart(2, "0");
  const mm = ((total + 24 * 60) % (24 * 60) % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function BookingPageInner() {
  const sp = useSearchParams();

  const botId = sp.get("botId") || undefined;
  const conversationId = sp.get("conversationId") || undefined;
  const defaultDuration = parseDuration(sp.get("duration"));
  const isEmbedded = ["1", "true", "yes"].includes(
    (sp.get("embed") || "").toLowerCase()
  );

  // ---- availability hook (dynamic) ----
  const loadTimeSlots = useMemo(() => {
    return async ({
      date,
      timezone,
      botId,
    }: {
      date: Date;
      timezone: string;
      botId?: string;
      conversationId?: string;
    }): Promise<string[]> => {
      const d = date.toISOString().slice(0, 10); // YYYY-MM-DD
      const url = `/api/availability?botId=${encodeURIComponent(
        botId || ""
      )}&date=${d}&tz=${encodeURIComponent(timezone)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json().catch(() => ({}));
      return Array.isArray(json?.slots) ? json.slots : [];
    };
  }, []);

  // ---- submit hook (creates event via your API) ----
  const onSubmit = useMemo(() => {
    return async (payload: BookingPayload) => {
      // start/end in local-naive + send separate timezone (Google API accepts this)
      const startISO = toLocalISO(payload.date, payload.time);
      const endISO = toLocalISO(
        payload.date,
        addMinutesHHMM(payload.time, payload.duration)
      );

      const body = {
        botId: botId || payload.bot_id,
        summary: "Booking",
        description: payload.notes ?? "",
        startISO,
        endISO,
        timezone: payload.timezone,
        invitee_name: payload.name,
        invitee_email: payload.email,
        invitee_phone: payload.phone ?? undefined,
      };

      const res = await fetch("/api/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false as const, error: err?.error || "Failed to create event" };
      }
      return { ok: true as const };
    };
  }, [botId]);

  return (
    <BookingFormUI
      botId={botId}
      conversationId={conversationId}
      defaultDuration={defaultDuration}
      isEmbedded={isEmbedded}
      loadTimeSlots={loadTimeSlots}
      onSubmit={onSubmit}
      // (optional) if you add a /api/availability-days endpoint, pass loadDisabledDays here
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading booking form…</div>}>
      <BookingPageInner />
    </Suspense>
  );
}
