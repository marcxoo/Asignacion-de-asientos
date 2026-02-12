import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'asiento_registro_token';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(null);
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from('registros')
      .select('id, nombre, categoria, codigo_acceso')
      .eq('token', token)
      .single();

    if (error || !data) {
      return NextResponse.json(null);
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null);
  }
}
