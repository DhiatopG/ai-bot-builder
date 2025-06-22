import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  console.log("⚡️ /api/create-bot hit");

  try {
    const body = await req.json();
    console.log("📥 Incoming request body:", JSON.stringify(body, null, 2));

    const { userId, botName, businessInfo, qaPairs } = body;

    const payload = {
      user_id: userId,
      bot_name: botName,
      urls: businessInfo.urls.join(', '),
      description: businessInfo.description,
      custom_qa: qaPairs,
    };

    console.log("🚀 Payload to Supabase:", JSON.stringify(payload, null, 2));

    const { data, error } = await supabase
      .from('bots')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase insert error:", JSON.stringify(error, null, 2));
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ FULL ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
