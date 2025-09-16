// /src/app/api/book/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { insertGoogleEvent } from "@/lib/google/calendar";

/** ---------- types ---------- */
type Body = {
  bot_id?: string;
  conversation_id?: string | null;
  invitee_name: string;
  invitee_email: string;
  invitee_phone?: string | null;
  note?: string | null;
  date?: string; time?: string; duration?: number; timezone?: string;
  startISO?: string; endISO?: string;
};

/** ---------- helpers ---------- */
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}
const iso=(d:Date)=>new Date(d.getTime()).toISOString();
const toLocal=(date:string,hhmm:string)=>new Date(`${date}T${hhmm}:00`);
function clampDuration(n:unknown,fallback=30){const x=Number(n);if(!Number.isFinite(x))return fallback;const i=Math.round(x);return Math.min(180,Math.max(5,i));}

function shouldDebug(req: Request){
  const u=new URL(req.url); const qp=u.searchParams.get("debug"); const hdr=req.headers.get("x-debug");
  return process.env.DEBUG_BOOK==="1"||qp==="1"||qp==="true"||hdr==="1"||hdr==="true";
}
function j(res:any,status:number,rid:string){return NextResponse.json(res,{status,headers:{"x-correlation-id":rid}});}
function bad(msg:string,rid:string,debug:boolean,extra?:Record<string,any>){return j({error:msg,...(debug?extra:{})},400,rid);}
const redactEmail=(s?:string|null)=>!s?null:((n,d)=>(d?`${n.slice(0,2)}***@${d}`:"***"))(...(s.split("@") as [string,string]));
const redactPhone=(s?:string|null)=>!s?null:`***${s.slice(-2)}`;
const sanitizeBody=(b:Partial<Body>)=>({...b,invitee_email:redactEmail(b.invitee_email),invitee_phone:redactPhone(b.invitee_phone),note:b.note?"[redacted]":null});

/** ---------- GET: helper message ---------- */
export function GET(req: Request) {
  const u = new URL(req.url);
  const exampleBot = u.searchParams.get("botId") || "YOUR_BOT_ID";
  const start = new Date(Date.now()+60*60*1000);
  const end   = new Date(start.getTime()+30*60*1000);
  return NextResponse.json({
    error: "method_not_allowed",
    expected: "POST /api/book",
    example: {
      url: "/api/book",
      body: {
        bot_id: exampleBot,
        invitee_name: "Guest",
        invitee_email: "guest@example.com",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        timezone: "UTC"
      }
    }
  }, { status: 405 });
}

/** ---------- POST: create appointment ---------- */
export async function POST(req: Request) {
  const rid = randomUUID();
  const t0 = Date.now();
  const debug = shouldDebug(req);

  try {
    const supabase = admin();

    // Precheck (diagnostic)
    let precheck:any = null;
    try {
      const pc = await supabase.from("appointments").select("id", { head: true, count: "exact" }).limit(0);
      precheck = pc.error ? { ok:false, code: pc.error.code, message: pc.error.message } : { ok:true, role:"service" };
    } catch (e:any) {
      precheck = { ok:false, ex: e?.message };
    }

    let body: Body;
    try { body = (await req.json()) as Body; }
    catch (e:any) { return bad("invalid_json", rid, debug, { detail: e?.message, precheck }); }

    const { bot_id, conversation_id, invitee_name, invitee_email, invitee_phone=null, note=null,
            date, time, duration, timezone="UTC", startISO, endISO } = body;

    if (!bot_id) return bad("Missing bot_id", rid, debug, { payload: sanitizeBody(body), precheck });
    if (!UUID_RE.test(bot_id)) return bad("Invalid bot_id", rid, debug, { payload: sanitizeBody(body), precheck });
    if (!invitee_name?.trim()) return bad("Missing invitee_name", rid, debug, { payload: sanitizeBody(body), precheck });
    if (!invitee_email?.trim()) return bad("Missing invitee_email", rid, debug, { payload: sanitizeBody(body), precheck });

    // (Optional) validate conversation belongs to bot
    let convId:string|null=null;
    if (typeof conversation_id==="string" && UUID_RE.test(conversation_id)) {
      const c = await supabase.from("conversations").select("id,bot_id").eq("id", conversation_id).limit(1);
      if (!c.error && c.data?.length && c.data[0].bot_id===bot_id) convId = c.data[0].id;
    }

    // Derive times
    const dur = clampDuration(duration,30);
    let starts_atISO:string, ends_atISO:string;
    if (startISO && endISO) { starts_atISO=new Date(startISO).toISOString(); ends_atISO=new Date(endISO).toISOString(); }
    else {
      if (!date || !time) return bad("Provide either startISO/endISO or date+time(+duration)", rid, debug, { payload: sanitizeBody(body), precheck });
      const start = toLocal(date,time); const end = new Date(start.getTime()+dur*60000);
      starts_atISO = iso(start); ends_atISO = iso(end);
    }

    // Conflict check
    const q = await supabase
      .from("appointments")
      .select("id")
      .eq("bot_id", bot_id)
      .in("status", ["confirmed","rescheduled"])
      .lt("starts_at", ends_atISO)
      .gt("ends_at", starts_atISO)
      .limit(1);

    if (q.error) return j({ error:"conflict_query_failed", ...(debug?{ detail:q.error.message, code:q.error.code, precheck }:{}) }, 500, rid);
    if (q.data && q.data.length>0) return j({ error:"slot_taken", ...(debug?{ precheck }:{}) }, 409, rid);

    // Insert
    const ins = await supabase
      .from("appointments")
      .insert({
        bot_id,
        starts_at: starts_atISO,
        ends_at: ends_atISO,
        timezone,
        status: "confirmed",
        provider: "custom",
        invitee_name,
        invitee_email,
        invitee_phone,
        notes: note,
        ...(convId ? { conversation_id: convId } : {}),
      })
      .select("id, starts_at, ends_at")
      .single();

    if (ins.error) {
      return j({
        error: "insert_failed",
        ...(debug ? { detail: ins.error.message, code: ins.error.code, hint: ins.error.hint, stage: "appointments.insert", payload: sanitizeBody(body), precheck } : {}),
      }, 500, rid);
    }

    // === NEW: push to Google Calendar (best-effort) ===
    try {
      const g = await insertGoogleEvent({
        supabase,
        botId: bot_id,
        appointment: { id: ins.data!.id, startISO: starts_atISO, endISO: ends_atISO },
        invitee_name,
        invitee_email,
        timezone,
      });

      if ((g as any)?.eventId) {
        await supabase
          .from("appointments")
          .update({
            provider: "google",
            external_event_id: (g as any).eventId,
            external_calendar_id: (g as any).calendarId || "primary",
          })
          .eq("id", ins.data!.id);
      } else if (debug) {
        console.log("[google-sync] skipped/failed", g);
      }
    } catch (e) {
      if (debug) console.error("[google-sync] exception", e);
    }

    const dt = Date.now()-t0;
    if (debug) console.log(`[book][${rid}] OK ${dt}ms`, { bot_id, starts_atISO, ends_atISO, convId_present: !!convId, precheck });

    return j({
      appointment_id: ins.data!.id,
      status: "confirmed",
      startISO: starts_atISO,
      endISO: ends_atISO,
      timezone,
      provider: "custom", // may be overwritten to 'google' in DB if sync succeeded
      rid,
      ...(debug?{ precheck }:{}),
    }, 201, rid);

  } catch (e:any) {
    return j({ error: "fatal", detail: e?.message ?? String(e) }, 500, rid);
  }
}
