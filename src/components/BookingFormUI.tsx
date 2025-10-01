"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { format, startOfDay } from "date-fns";
import { Calendar, Clock, User, CheckCircle, ArrowLeft } from "lucide-react";
import "react-day-picker/dist/style.css";

/* ---------- public types ---------- */

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

/* ---------- component props ---------- */

interface BookingFormProps {
  botId?: string;
  conversationId?: string;
  defaultDuration?: number;
  isEmbedded?: boolean;

  loadTimeSlots?: (args: {
    date: Date;
    timezone: string;
    botId?: string;
    conversationId?: string;
  }) => Promise<string[]>;

  loadDisabledDays?: (args: {
    visibleMonthStart: Date;
    visibleMonthEnd: Date;
    timezone: string;
    botId?: string;
  }) => Promise<Date[]>;

  onSubmit?: (payload: BookingPayload) => Promise<
    | { ok: true; appointmentId?: string }
    | { ok: false; error: string }
  >;

  extraDisabledDays?: Date[];

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
  extraDisabledDays = [],
  initialName = "",
  initialEmail = "",
  initialPhone = "",
}: BookingFormProps) {
  const sp = useSearchParams();
  const botIdFromUrl = sp?.get("botId") ?? undefined;
  const conversationIdFromUrl = sp?.get("conversationId") ?? undefined;
  const embeddedFromUrl = sp?.get("embed") === "1";

  const modeFromUrl =
    (sp?.get("mode") as "cancel" | "reschedule" | "book" | null) ?? null;
  const prefillEmailFromUrl = sp?.get("email") ?? "";
  const prefillPhoneFromUrl = sp?.get("phone") ?? "";

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

  // Modes
  const [actionMode, setActionMode] = useState<"book" | "cancel" | "reschedule">(
    modeFromUrl ?? "book"
  );

  // Email-only cancel state
  const [cancelEmail, setCancelEmail] = useState<string>(prefillEmailFromUrl);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  // date grid + availability
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfDay(new Date()));
  const [disabledDays, setDisabledDays] = useState<Date[]>(extraDisabledDays);
  const [disabledLoading, setDisabledLoading] = useState(false);

  // time slots
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [timesLoading, setTimesLoading] = useState(false);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    date: null,
    time: "",
    name: initialName,
    email: initialEmail || prefillEmailFromUrl,
    phone: initialPhone || prefillPhoneFromUrl,
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

  const smoothScrollTo = (id: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (modeFromUrl === "cancel") {
      setTimeout(() => smoothScrollTo("cancel-section"), 0);
    } else if (modeFromUrl === "reschedule") {
      setTimeout(() => smoothScrollTo("book-section"), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- auto-resize iframe when embedded ---------- */
  useEffect(() => {
    if (!resolvedIsEmbedded) return;

    const postSize = () => {
      const h = document.documentElement.scrollHeight;
      window.parent?.postMessage({ type: "booking:resize", height: h }, "*");
    };

    postSize();
    const ro = new ResizeObserver(postSize);
    ro.observe(document.documentElement);

    window.addEventListener("load", postSize);
    window.addEventListener("resize", postSize);

    return () => {
      ro.disconnect();
      window.removeEventListener("load", postSize);
      window.removeEventListener("resize", postSize);
    };
  }, [resolvedIsEmbedded, currentStep, timesLoading, disabledLoading, timeSlots.length]);

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
    } catch (err) {
      console.debug("[BookingFormUI] loadTimeSlots failed:", err);
      return [];
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
      return (json?.disabledDays ?? []).map(
        (s: string) => new Date(`${s}T00:00:00Z`)
      );
    } catch (err) {
      console.debug("[BookingFormUI] loadDisabledDays failed:", err);
      return extraDisabledDays;
    }
  }

  const effectiveLoadTimeSlots = loadTimeSlots ?? defaultLoadTimeSlots;
  const effectiveLoadDisabledDays = loadDisabledDays ?? defaultLoadDisabledDays;

  // helper: refresh current date's slots from server
  const refreshDaySlots = async (d: Date) => {
    try {
      setTimesLoading(true);
      const slots = await effectiveLoadTimeSlots({
        date: d,
        timezone,
        botId: resolvedBotId,
        conversationId: resolvedConversationId,
      });
      setTimeSlots(slots);
      setFormData((p) => (p.time && !slots.includes(p.time) ? { ...p, time: "" } : p));
    } catch (err) {
      console.debug("[BookingFormUI] refreshDaySlots failed:", err);
      setTimeSlots([]);
      setFormData((p) => ({ ...p, time: "" }));
    } finally {
      setTimesLoading(false);
    }
  };

  /* ---------- month-level disabled days ---------- */
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
      } catch (err) {
        console.debug("[BookingFormUI] loadDisabledDays failed:", err);
      } finally {
        if (!cancelled) setDisabledLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth, timezone, resolvedBotId]);

  /* ---------- day-level time slots ---------- */
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
          if (formData.time && !slots.includes(formData.time)) {
            setFormData((p) => ({ ...p, time: "" }));
          }
        }
      } catch (err) {
        console.debug("[BookingFormUI] loadTimeSlots failed:", err);
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
    if (actionMode !== "book" && actionMode !== "reschedule") {
      setActionMode("book");
    }
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
      email: initialEmail || prefillEmailFromUrl,
      phone: initialPhone || prefillPhoneFromUrl,
      notes: "",
    });
    setErrors({});
    setSubmitError(null);
    setCurrentStep("date");
    setActionMode("book");
    setCancelEmail(prefillEmailFromUrl);
    setCancelSuccess(null);
    setCancelError(null);
  };

  const canSubmit =
    !!formData.date &&
    !!formData.time &&
    !!formData.name.trim() &&
    isValidEmail(formData.email);

  // Default submitter (booking)
  async function defaultSubmitter(p: BookingPayload): Promise<
    { ok: true; appointmentId?: string } | { ok: false; error: string }
  > {
    try {
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

      // Immediately refresh the same day's server slots so the just-booked time disappears
      if (formData.date) {
        await refreshDaySlots(formData.date);
      }

      if (typeof window !== "undefined") {
        window.parent?.postMessage(
          {
            type:
              actionMode === "reschedule" ? "booking:rescheduled" : "booking:created",
            preview: onSubmit ? false : true,
          },
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

  // Email-only cancel submitter
  async function defaultCancelSubmitter(args: {
    email: string;
  }): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
    try {
      const res = await fetch("/api/appointments/cancel-by-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: resolvedBotId,
          email: args.email?.trim().toLowerCase(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false as const,
          error:
            (json?.error === "no_upcoming_match" && "No upcoming confirmed appointment found for this email.") ||
            json?.error ||
            `HTTP ${res.status}`,
        };
      }
      return { ok: true as const, message: "Canceled successfully" };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Network error" };
    }
  }

  const doCancel = async () => {
    setCancelError(null);
    setCancelSuccess(null);

    if (!cancelEmail || !isValidEmail(cancelEmail)) {
      setCancelError("Please enter the email you used to book.");
      return;
    }

    try {
      setCancelLoading(true);
      const res = await defaultCancelSubmitter({ email: cancelEmail });
      if (!res.ok) throw new Error(res.error);

      // After cancel, refresh slots for the selected day (if any) to show the freed time
      if (formData.date) {
        await refreshDaySlots(formData.date);
      }

      if (typeof window !== "undefined") {
        window.parent?.postMessage({ type: "booking:canceled" }, "*");
      }
      setCancelSuccess("✅ Your appointment has been canceled.");
    } catch (e: any) {
      setCancelError(e?.message || "Failed to cancel. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  /* ---------- UI classes ---------- */

  const containerClass = resolvedIsEmbedded
    ? "min-h-screen p-4 bg-gray-50"
    : "min-h-screen bg-gray-50 py-8 px-4";

  const cardClass = resolvedIsEmbedded
    ? "w-full max-w-md mx-auto bg-white rounded-lg shadow-sm border p-4"
    : "w-full max-w-md mx-auto bg-white rounded-lg shadow-sm border p-6";

  const primaryBtn =
    "px-3 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium";
  const secondaryBtn =
    "px-3 py-2 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200";

  /* ================================================================== */

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        {/* Top CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
          <button
            onClick={() => {
              setActionMode("cancel");
              setTimeout(() => smoothScrollTo("cancel-section"), 0);
            }}
            className={secondaryBtn}
          >
            Cancel Appointment
          </button>
          <button
            onClick={() => {
              setActionMode("reschedule");
              setCurrentStep("date");
              setTimeout(() => smoothScrollTo("book-section"), 0);
            }}
            className={primaryBtn}
          >
            Reschedule Appointment
          </button>
        </div>

        {/* Optional header */}
        {!resolvedIsEmbedded && (
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {actionMode === "reschedule" ? "Reschedule Appointment" : "Book an Appointment"}
            </h1>
            <p className="text-gray-600">
              {actionMode === "reschedule"
                ? "Pick a new date and time that works for you."
                : "Choose your preferred date and time"}
            </p>
          </div>
        )}

        {/* Email-only Cancel Section */}
        <div id="cancel-section" className="mb-6">
          {actionMode === "cancel" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <h2 className="text-lg font-semibold text-red-700">Cancel your appointment</h2>
              <p className="text-sm text-red-700/90">
                Enter the same <strong>email</strong> you used when booking. We’ll cancel your soonest upcoming confirmed appointment.
              </p>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    value={cancelEmail}
                    onChange={(e) => setCancelEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {cancelError && (
                <div className="text-sm text-red-700">{cancelError}</div>
              )}
              {cancelSuccess && (
                <div className="text-sm text-green-700">{cancelSuccess}</div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={doCancel}
                  disabled={cancelLoading}
                  className={primaryBtn}
                >
                  {cancelLoading ? "Canceling…" : "Confirm Cancel"}
                </button>
                <button
                  onClick={() => {
                    setCancelEmail(prefillEmailFromUrl);
                    setCancelError(null);
                    setCancelSuccess(null);
                  }}
                  className="px-3 py-2 rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 text-sm font-medium"
                >
                  Reset
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Trouble canceling?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.parent?.postMessage({ type: "booking:contact" }, "*");
                  }}
                  className="underline"
                >
                  Contact the clinic
                </a>
                .
              </p>
            </div>
          )}
        </div>

        {/* Anchor for booking/reschedule section */}
        <div id="book-section" />

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
            <h2 className="text-lg font-semibold text-gray-900 text-center">
              Select a Date
            </h2>

            {/* Wrap hides horizontal overflow in small iframes */}
            <div className="flex justify-center overflow-x-hidden">
              <DayPicker
                mode="single"
                numberOfMonths={1}
                selected={formData.date || undefined}
                onSelect={handleSelectDate}
                onMonthChange={setVisibleMonth}
                disabled={[{ before: startOfDay(new Date()) }, ...disabledDays]}
                style={
                  resolvedIsEmbedded
                    ? ({
                        "--rdp-cell-size": "34px",
                        "--rdp-caption-font-size": "14px",
                        "--rdp-accent-color": "#2563eb",
                      } as React.CSSProperties)
                    : undefined
                }
                className="rdp-custom"
                classNames={{
                  months:
                    "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button:
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell:
                    "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell:
                    "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
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
              <p className="text-xs text-center text-gray-500">
                Loading availability…
              </p>
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
              <div className="text-sm text-center text-gray-500">
                Loading time slots…
              </div>
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
                <div>
                  {formData.date && format(formData.date, "EEEE, MMMM d, yyyy")}
                </div>
                <div>
                  {formData.time} ({defaultDuration} minutes)
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
              {submitLoading
                ? actionMode === "reschedule"
                  ? "Rescheduling…"
                  : "Booking…"
                : actionMode === "reschedule"
                ? "Confirm Reschedule"
                : "Book Appointment"}
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

            <h2 className="text-xl font-semibold text-gray-900">
              {actionMode === "reschedule" ? "Rescheduled!" : "Booking Confirmed!"}
            </h2>
            <p className="text-gray-600">
              We’ll send confirmation details to your email shortly.
            </p>

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
              {actionMode === "reschedule" ? "Reschedule Again" : "Book Another Appointment"}
            </button>
          </div>
        )}
      </div>

      {/* prevent horizontal scrollbars in narrow iframes + ensure DayPicker fits */}
      <style jsx global>{`
        html,
        body {
          overflow-x: hidden;
        }
        /* Fit DayPicker inside narrow iframes without side scrolling */
        .rdp {
          width: 100%;
          max-width: 360px;
          margin: 0 auto;
        }
        .rdp-months {
          display: block;
        }
        .rdp-table {
          width: 100%;
          table-layout: fixed;
        }
        .rdp-head_cell,
        .rdp-day {
          width: auto;
        }
      `}</style>
    </div>
  );
}
