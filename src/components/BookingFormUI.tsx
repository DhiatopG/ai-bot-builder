"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { format, addMinutes, startOfDay } from "date-fns";
import { Calendar, Clock, User, CheckCircle, ArrowLeft } from "lucide-react";
import "react-day-picker/dist/style.css";

/* ---------- public types you can import elsewhere ---------- */

export type BookingStep = "date" | "time" | "details" | "success";

export interface BookingPayload {
  bot_id?: string;
  conversation_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  /** ISO date, e.g. 2025-09-10 */
  date: string;
  /** 24h "HH:mm" */
  time: string;
  duration: number;
  timezone: string;
}

export interface BusinessHours {
  /** "09:00" */
  start: string;
  /** "17:00" */
  end: string;
  /** e.g. 30 */
  intervalMinutes: number;
}

/* ---------- component props (hook points for your logic) ---------- */

interface BookingFormProps {
  botId?: string;
  conversationId?: string;
  defaultDuration?: number;
  isEmbedded?: boolean;

  /**
   * Optional: generate/override raw time slots for a given date & timezone.
   * Return an array like ["09:00","09:30","10:00",...].
   * If omitted, we auto-generate slots or call /api/availability.
   */
  loadTimeSlots?: (args: {
    date: Date;
    timezone: string;
    botId?: string;
    conversationId?: string;
  }) => Promise<string[]>;

  /**
   * Optional: mark full days as NOT bookable.
   * Return an array of Date objects that will be disabled for the visible month.
   * If omitted, we call /api/availability for month-level disabled days.
   */
  loadDisabledDays?: (args: {
    visibleMonthStart: Date;
    visibleMonthEnd: Date;
    timezone: string;
    botId?: string;
  }) => Promise<Date[]>;

  /**
   * Optional: handle submission to your backend.
   * If omitted, we POST to /api/create-event by default.
   */
  onSubmit?: (payload: BookingPayload) => Promise<
    | { ok: true; appointmentId?: string }
    | { ok: false; error: string }
  >;

  /**
   * Optional: change default generation window.
   */
  businessHours?: BusinessHours;

  /**
   * Optional static list to disable (e.g., holidays). Merged with loadDisabledDays().
   */
  extraDisabledDays?: Date[];

  /** Optional initial values for convenience */
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
}

/* ---------- inner types ---------- */

interface FormData {
  date: Date | null;
  time: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
}

/* ================================================================== */

export default function BookingFormUI({
  botId,
  conversationId,
  defaultDuration = 30,
  isEmbedded = false,
  loadTimeSlots,
  loadDisabledDays,
  onSubmit,
  businessHours = { start: "09:00", end: "17:00", intervalMinutes: 30 },
  extraDisabledDays = [],
  initialName = "",
  initialEmail = "",
  initialPhone = "",
}: BookingFormProps) {
  const sp = useSearchParams();
  const botIdFromUrl = sp?.get("botId") ?? undefined;
  const conversationIdFromUrl = sp?.get("conversationId") ?? undefined;
  const embeddedFromUrl = sp?.get("embed") === "1";

  // Resolve runtime values (props take priority, then URL)
  const resolvedBotId = useMemo(
    () => botId ?? botIdFromUrl,
    [botId, botIdFromUrl]
  );
  const resolvedConversationId = useMemo(
    () => conversationId ?? conversationIdFromUrl,
    [conversationId, conversationIdFromUrl]
  );
  const resolvedIsEmbedded = useMemo(
    () => isEmbedded || embeddedFromUrl,
    [isEmbedded, embeddedFromUrl]
  );

  const [currentStep, setCurrentStep] = useState<BookingStep>("date");
  const [timezone, setTimezone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // date grid + availability
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfDay(new Date()));
  const [disabledDays, setDisabledDays] = useState<Date[]>(extraDisabledDays);
  const [disabledLoading, setDisabledLoading] = useState(false);

  // time slots for a selected day
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [timesLoading, setTimesLoading] = useState(false);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    date: null,
    time: "",
    name: initialName,
    email: initialEmail,
    phone: initialPhone,
    notes: "",
  });

  /* ---------- timezone ---------- */
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  /* ---------- helpers ---------- */

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = "Full name is required";
    if (!formData.email.trim()) e.email = "Email is required";
    else if (!isValidEmail(formData.email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const parseHHMM = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
    return { h, m };
  };

  // local fallback generator (only used if availability API isn't reachable)
  const defaultGenerateSlotsLocal = (d: Date) => {
    const { h: sh, m: sm } = parseHHMM(businessHours.start);
    const { h: eh, m: em } = parseHHMM(businessHours.end);
    const start = new Date(d);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(d);
    end.setHours(eh, em, 0, 0);

    const out: string[] = [];
    for (let t = start; t < end; t = addMinutes(t, businessHours.intervalMinutes)) {
      out.push(
        `${String(t.getHours()).padStart(2, "0")}:${String(
          t.getMinutes()
        ).padStart(2, "0")}`
      );
    }
    return out;
  };

  /* ---------- DEFAULT dynamic providers (if you don't pass custom hooks) ---------- */

  async function defaultLoadTimeSlots(args: {
    date: Date;
    timezone: string;
    botId?: string;
    conversationId?: string;
  }): Promise<string[]> {
    const d = args.date.toISOString().slice(0, 10); // yyyy-mm-dd
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const url = new URL("/api/availability", base || "http://localhost");
      url.searchParams.set("scope", "times");
      url.searchParams.set("date", d);
      url.searchParams.set("tz", args.timezone);
      if (args.botId) url.searchParams.set("botId", args.botId);
      if (args.conversationId) url.searchParams.set("conversationId", args.conversationId);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load availability");
      return (json?.slots ?? []) as string[];
    } catch {
      // soft-fallback to local grid
      return defaultGenerateSlotsLocal(args.date);
    }
  }

  async function defaultLoadDisabledDays(args: {
    visibleMonthStart: Date;
    visibleMonthEnd: Date;
    timezone: string;
    botId?: string;
  }): Promise<Date[]> {
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const url = new URL("/api/availability", base || "http://localhost");
      url.searchParams.set("scope", "days");
      url.searchParams.set(
        "monthStart",
        args.visibleMonthStart.toISOString().slice(0, 10)
      );
      url.searchParams.set(
        "monthEnd",
        args.visibleMonthEnd.toISOString().slice(0, 10)
      );
      url.searchParams.set("tz", args.timezone);
      if (args.botId) url.searchParams.set("botId", args.botId);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load days");
      // API returns ["yyyy-mm-dd"] → convert to Date at midnight UTC (safe for day-only disable)
      return (json?.disabledDays ?? []).map(
        (s: string) => new Date(`${s}T00:00:00Z`)
      );
    } catch {
      // fall back to whatever static extraDisabledDays were passed
      return extraDisabledDays;
    }
  }

  // Choose provided hooks or built-in defaults
  const effectiveLoadTimeSlots = loadTimeSlots ?? defaultLoadTimeSlots;
  const effectiveLoadDisabledDays = loadDisabledDays ?? defaultLoadDisabledDays;

  /* ---------- month-level disabled days (hook to your API) ---------- */
  useEffect(() => {
    let cancelled = false;
    const start = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      1
    );
    const end = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0
    );

    (async () => {
      try {
        setDisabledLoading(true);
        // If no dynamic provider and no extras, skip
        if (!effectiveLoadDisabledDays && extraDisabledDays.length === 0) return;
        const res = effectiveLoadDisabledDays
          ? await effectiveLoadDisabledDays({
              visibleMonthStart: start,
              visibleMonthEnd: end,
              timezone,
              botId: resolvedBotId,
            })
          : extraDisabledDays;
        if (!cancelled) setDisabledDays([...extraDisabledDays, ...(res ?? [])]);
      } catch {
        // keep current disabledDays on failure
      } finally {
        if (!cancelled) setDisabledLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth, timezone, resolvedBotId]);

  /* ---------- day-level time slots (hook to your API) ---------- */
  useEffect(() => {
    if (!formData.date) return;
    let cancelled = false;

    (async () => {
      try {
        setTimesLoading(true);
        const slots = await effectiveLoadTimeSlots({
          date: formData.date!,
          timezone,
          botId: resolvedBotId,
          conversationId: resolvedConversationId,
        });
        if (!cancelled) {
          setTimeSlots(slots);
          // if previously selected time is no longer present → clear it
          if (formData.time && !slots.includes(formData.time)) {
            setFormData((p) => ({ ...p, time: "" }));
          }
        }
      } catch {
        if (!cancelled) {
          setTimeSlots([]);
          setFormData((p) => ({ ...p, time: "" }));
        }
      } finally {
        if (!cancelled) setTimesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.date, timezone, resolvedBotId, resolvedConversationId]);

  /* ---------- step handlers ---------- */

  const handleSelectDate = (date?: Date) => {
    if (!date) return;
    setFormData((p) => ({ ...p, date, time: "" }));
    setCurrentStep("time");
  };

  const handleSelectTime = (t: string) => {
    setFormData((p) => ({ ...p, time: t }));
    setCurrentStep("details");
  };

  const handleInput = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: "" }));
  };

  const handleBack = () => {
    setSubmitError(null);
    if (currentStep === "time") setCurrentStep("date");
    else if (currentStep === "details") setCurrentStep("time");
    else if (currentStep === "success") setCurrentStep("details");
  };

  const handleReset = () => {
    setFormData({
      date: null,
      time: "",
      name: initialName,
      email: initialEmail,
      phone: initialPhone,
      notes: "",
    });
    setErrors({});
    setSubmitError(null);
    setCurrentStep("date");
  };

  const canSubmit =
    !!formData.date &&
    !!formData.time &&
    !!formData.name.trim() &&
    isValidEmail(formData.email);

  // Default submitter (if you didn't pass onSubmit): calls /api/create-event
  async function defaultSubmitter(p: BookingPayload): Promise<
    { ok: true; appointmentId?: string } | { ok: false; error: string }
  > {
    try {
      // Build local start/end from date+time, then to ISO strings (UTC).
      const startLocal = new Date(`${p.date}T${p.time}:00`);
      const endLocal = new Date(startLocal.getTime() + p.duration * 60_000);

      const res = await fetch("/api/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: resolvedBotId,
          summary: "Booking",
          description: p.notes ?? "",
          startISO: startLocal.toISOString(),
          endISO: endLocal.toISOString(),
          timezone: p.timezone,
          invitee_name: p.name,
          invitee_email: p.email,
          invitee_phone: p.phone ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { ok: false as const, error: json?.error ?? `HTTP ${res.status}` };
      }
      return { ok: true as const, appointmentId: json?.row?.id };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Network error" };
    }
  }

  const effectiveSubmit = onSubmit ?? defaultSubmitter;

  const doSubmit = async () => {
    if (!validateDetails() || !formData.date) return;

    const payload: BookingPayload = {
      bot_id: resolvedBotId,
      conversation_id: resolvedConversationId || null,
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      notes: formData.notes || null,
      date: format(formData.date, "yyyy-MM-dd"),
      time: formData.time,
      duration: defaultDuration,
      timezone,
    };

    try {
      setSubmitLoading(true);
      setSubmitError(null);

      const res = await effectiveSubmit(payload);
      if (!res.ok) throw new Error(res.error || "Unknown error");

      // notify host if embedded
      if (typeof window !== "undefined") {
        window.parent?.postMessage(
          { type: "booking:created", preview: onSubmit ? false : true },
          "*"
        );
      }
      setCurrentStep("success");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to book. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  /* ---------- UI classes ---------- */

  const containerClass = resolvedIsEmbedded
    ? "min-h-screen p-4 bg-gray-50"
    : "min-h-screen bg-gray-50 py-8 px-4";

  const cardClass = resolvedIsEmbedded
    ? "w-full max-w-md mx-auto bg-white rounded-lg shadow-sm border p-4"
    : "w-full max-w-md mx-auto bg-white rounded-lg shadow-sm border p-6";

  /* ================================================================== */

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        {!resolvedIsEmbedded && (
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Book an Appointment</h1>
            <p className="text-gray-600">Choose your preferred date and time</p>
          </div>
        )}

        {/* Steps indicator */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === "date"
                  ? "bg-blue-600 text-white"
                  : ["time", "details", "success"].includes(currentStep)
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              <Calendar className="w-4 h-4" />
            </div>
            <div
              className={`w-8 h-0.5 ${
                ["time", "details", "success"].includes(currentStep)
                  ? "bg-green-500"
                  : "bg-gray-200"
              }`}
            />
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === "time"
                  ? "bg-blue-600 text-white"
                  : ["details", "success"].includes(currentStep)
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
            <div
              className={`w-8 h-0.5 ${
                ["details", "success"].includes(currentStep)
                  ? "bg-green-500"
                  : "bg-gray-200"
              }`}
            />
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === "details"
                  ? "bg-blue-600 text-white"
                  : currentStep === "success"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* DATE STEP */}
        {currentStep === "date" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 text-center">Select a Date</h2>
            <div className="flex justify-center">
              <DayPicker
                mode="single"
                selected={formData.date || undefined}
                onSelect={handleSelectDate}
                onMonthChange={setVisibleMonth}
                disabled={[
                  { before: startOfDay(new Date()) },
                  ...disabledDays,
                ]}
                className="rdp-custom"
                classNames={{
                  months:
                    "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md",
                  day_selected:
                    "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                  day_today: "bg-gray-100 text-gray-900",
                  day_outside: "text-gray-400 opacity-50",
                  day_disabled: "text-gray-400 opacity-50 line-through",
                  day_hidden: "invisible",
                }}
              />
            </div>
            {disabledLoading && (
              <p className="text-xs text-center text-gray-500">Loading availability…</p>
            )}
          </div>
        )}

        {/* TIME STEP */}
        {currentStep === "time" && formData.date && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>
              <h2 className="text-lg font-semibold text-gray-900">Select Time</h2>
              <div className="w-16" />
            </div>

            <div className="text-center mb-2">
              <p className="text-gray-600">
                {format(formData.date, "EEEE, MMMM d, yyyy")}
              </p>
            </div>

            {timesLoading ? (
              <div className="text-sm text-center text-gray-500">Loading time slots…</div>
            ) : timeSlots.length === 0 ? (
              <div className="text-sm text-center text-gray-500">
                No available times for this date. Please pick another day.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => handleSelectTime(time)}
                    className={`p-3 text-sm rounded-md border transition-colors ${
                      formData.time === time
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-900 border-gray-300 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}

            {timezone && (
              <div className="text-center">
                <p className="text-xs text-gray-500">Timezone: {timezone}</p>
              </div>
            )}
          </div>
        )}

        {/* DETAILS STEP */}
        {currentStep === "details" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>
              <h2 className="text-lg font-semibold text-gray-900">Your Details</h2>
              <div className="w-16" />
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-2">
              <div className="text-sm text-gray-600">
                <div className="font-medium">Selected:</div>
                <div>{formData.date && format(formData.date, "EEEE, MMMM d, yyyy")}</div>
                <div>
                  {formData.time} ({defaultDuration} minutes)
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInput}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Enter your full name"
                />
                {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInput}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.email ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Enter your email address"
                />
                {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone (optional)
                </label>
                <input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInput}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your phone number"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInput}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any additional information..."
                />
              </div>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 -mb-2">{submitError}</div>
            )}

            <button
              onClick={doSubmit}
              disabled={!canSubmit || submitLoading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitLoading ? "Booking…" : "Book Appointment"}
            </button>

            {resolvedIsEmbedded && (
              <div className="text-center">
                <a
                  href={`/book?botId=${resolvedBotId ?? ""}${
                    resolvedConversationId ? `&conversationId=${resolvedConversationId}` : ""
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Open full page
                </a>
              </div>
            )}
          </div>
        )}

        {/* SUCCESS STEP */}
        {currentStep === "success" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900">Booking Confirmed!</h2>
            <p className="text-gray-600">We’ll send confirmation details to your email shortly.</p>

            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <h3 className="font-medium text-gray-900 mb-3">Appointment Details:</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-medium">
                    {formData.date && format(formData.date, "EEEE, MMMM d, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span className="font-medium">{formData.time}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span className="font-medium">{defaultDuration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Timezone:</span>
                  <span className="font-medium">{timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span>Name:</span>
                  <span className="font-medium">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="font-medium">{formData.email}</span>
                </div>
                {formData.phone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span className="font-medium">{formData.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Book Another Appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
