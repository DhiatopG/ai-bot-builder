import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient()

  const body = await req.json()
  const { airtable_api_key, airtable_base_id, airtable_table_name } = body

  const { error } = await supabase
    .from('bots')
    .update({
      airtable_api_key,
      airtable_base_id,
      airtable_table_name,
    })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
