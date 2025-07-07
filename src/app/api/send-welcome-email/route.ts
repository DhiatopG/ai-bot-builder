import { NextResponse } from 'next/server'
import { ServerClient } from 'postmark' // ✅ Correct import

const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_API_TOKEN!)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
        <h1 style="font-size:28px;">🎉 Welcome to <span style="color:#6366f1;">in60second</span>, ${email}!</h1>
        <p style="font-size:16px;">
          You made it. You're officially inside the only place where <strong>speed meets power</strong>—where AI does the heavy lifting while you take the credit.
        </p>
        <p style="font-size:16px;">
          No fluff. No waiting. Your dashboard is live and ready to make things happen <em>right now</em>.
        </p>
        <a href="https://in60second.net/dashboard" 
          style="display:inline-block;margin-top:20px;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
          🚀 Go to Your Dashboard
        </a>
        <hr style="margin:40px 0;border:none;border-top:1px solid #eee;">
        <p style="font-size:14px;color:#555;">
          Got questions? Hit reply or email <a href="mailto:support@in60second.net">support@in60second.net</a> anytime. We're real people and we’ve got your back.
        </p>
        <p style="font-size:12px;color:#aaa;">
          in60second — Where Ideas Don’t Wait.
        </p>
      </div>
    `

    await postmarkClient.sendEmail({
      From: 'support@in60second.net', // ✅ Must be verified sender
      To: email,
      Subject: '🎉 Welcome to in60second!',
      HtmlBody: html,
      MessageStream: 'outbound',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('❌ Email send failed:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
