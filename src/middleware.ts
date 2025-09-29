// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from './lib/supabase/server';

const ORIGIN = 'https://www.in60second.net';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- CORS for API routes ---
  if (pathname.startsWith('/api/')) {
    // Preflight
    if (req.method === 'OPTIONS') {
      const res = new NextResponse(null, { status: 204 });
      res.headers.set('Access-Control-Allow-Origin', ORIGIN);
      res.headers.set('Access-Control-Allow-Credentials', 'true');
      res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'content-type, authorization, x-requested-with');
      res.headers.set('Vary', 'Origin');
      return res;
    }
    // Actual API responses still need CORS headers present
    const res = NextResponse.next();
    res.headers.set('Access-Control-Allow-Origin', ORIGIN);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Vary', 'Origin');
    return res;
  }

  // --- Your existing dashboard SSR auth bootstrap ---
  if (pathname.startsWith('/dashboard')) {
    const res = NextResponse.next();
    const supabase = await createServerSupabaseClient();
    await supabase.auth.getSession();
    return res;
  }

  // Everything else
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};
