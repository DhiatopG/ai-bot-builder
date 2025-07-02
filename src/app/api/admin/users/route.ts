import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

async function createSupabase() {
  const cookieStore = await cookies();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (key) => cookieStore.get(key)?.value ?? '',
      set: async (key, value, options) => {
        cookieStore.set({ name: key, value, ...options });
      },
      remove: async (key, options) => {
        cookieStore.delete({ name: key, ...options });
      },
    },
  });
}

export async function GET() {
  const supabase = await createSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('session user email:', user?.email);

  if (!user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: adminUser, error } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single();

  if (error || adminUser?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*');

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  return NextResponse.json({
    users,
    currentEmail: user.email,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: adminUser, error } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single();

  if (error || adminUser?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { email, role } = body;

  if (!email || !role) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ role })
    .eq('email', email);

  if (updateError) {
    return NextResponse.json(
      { success: false, message: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
