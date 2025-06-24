import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const body = await req.json()
  const { leadName, leadEmail, botOwnerEmail } = body

  if (!leadEmail || !botOwnerEmail) {
    return new Response(JSON.stringify({ error: 'Missing lead or owner email' }), { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: 'In60Second Assistant <support@in60second.net>',
    to: [botOwnerEmail],
    subject: '🚨 New Lead from Your Assistant',
    html: `
      <p>You received a new lead:</p>
      <ul>
        <li><strong>Name:</strong> ${leadName || 'N/A'}</li>
        <li><strong>Email:</strong> ${leadEmail}</li>
      </ul>
    `,
  })

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
