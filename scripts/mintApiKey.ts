// scripts/mintApiKey.ts
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PEPPER = process.env.API_TOKEN_PEPPER!
const supa = createClient(url, serviceRole, { auth: { persistSession: false } })

function sha256(raw: string) {
  return createHmac('sha256', PEPPER).update(raw).digest('hex')
}

async function run(workspaceId: string, name = 'Default key') {
  const raw = 'sk_' + randomBytes(24).toString('hex')         // give THIS to the partner (show once)
  const token_hash = sha256(raw)
  const { error } = await supa.from('workspace_api_tokens').insert({ workspace_id: workspaceId, name, token_hash })
  if (error) throw error
  console.log('RAW API KEY (save now):', raw)
}

run(process.argv[2]!).catch((e) => { console.error(e); process.exit(1) })
