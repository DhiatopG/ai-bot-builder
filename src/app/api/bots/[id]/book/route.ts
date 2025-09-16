// src/app/api/bots/[id]/book/route.ts
import { NextResponse } from "next/server";

type Params = { params: { id: string } };

export function GET(_req: Request, { params }: Params) {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      expected: "POST",
      example: {
        url: `/api/bots/${params.id}/book`,
        body: {
          invitee_name: "Guest",
          invitee_email: "guest@example.com",
          startISO: "2025-09-15T14:00:00.000Z",
          endISO:   "2025-09-15T14:30:00.000Z",
          timezone: "Europe/Paris",
        },
      },
    },
    { status: 405 }
  );
}

export async function POST(req: Request, { params }: Params) {
  const url = new URL(req.url);
  const origin = url.origin;
  const botId = params.id;

  // read JSON safely
  const raw = await req.text();
  let body: any = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (_err) {
    // Fallback if JSON is invalid; keep lint happy and avoid throwing
    body = {};
  }

  // force bot_id from path
  const payload = { ...body, bot_id: botId };

  // forward to central handler
  const forwardTo = `${origin}/api/book`;
  const resp = await fetch(forwardTo, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-debug": req.headers.get("x-debug") ?? "",
    },
    body: JSON.stringify(payload),
  });

  const ct = resp.headers.get("content-type") || "";
  const status = resp.status;

  if (ct.includes("application/json")) {
    const data = await resp.json();
    return NextResponse.json(data, { status });
  } else {
    const text = await resp.text();
    return new NextResponse(text, { status });
  }
}
