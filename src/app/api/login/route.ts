import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  console.log('EMAIL:', email)
  console.log('PASSWORD:', password)

  if (email === 'dlmarketing43@gmail.com' && password === '123456') {
    return NextResponse.json({
      success: true,
      id: 'demo-user-id',
      email: 'dlmarketing43@gmail.com',
      name: 'Demo User',
    })
  }

  console.log('❌ INVALID LOGIN')
  return NextResponse.json({ success: false }, { status: 401 })
}
