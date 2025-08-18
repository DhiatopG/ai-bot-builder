import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // ensure a server runtime

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });
    }

    // TODO: send an email (Resend/Postmark/SES). For now, just log and succeed.
    console.log('CONTACT:', { name, email, message });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('CONTACT ERROR', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

// Handy GET so you can test in the browser
export function GET() {
  return NextResponse.json({ ok: true, status: 'contact endpoint live' });
}
