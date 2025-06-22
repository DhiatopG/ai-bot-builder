import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { userId, botName, businessInfo, qaPairs } = await req.json();

  const { data, error } = await supabase
    .from("bots")
    .insert([{ user_id: userId, bot_name: botName, business_info: businessInfo, qa_pairs: qaPairs }]);

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
