import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const bot_id = formData.get('bot_id') as string;

  if (!file || !bot_id) {
    return NextResponse.json({ error: 'Missing file or bot_id' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${uuidv4()}-${file.name}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('knowledge-base')
    .upload(filename, buffer, {
      contentType: file.type
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: insertError } = await supabase.from('bot_knowledge_files').insert([
    {
      bot_id,
      file_name: file.name,
      file_path: uploadData?.path,
      file_type: file.type,
      uploaded_at: new Date().toISOString()
    }
  ]);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
