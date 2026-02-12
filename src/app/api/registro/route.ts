import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'asiento_registro_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en .env.local (Supabase → Settings → API → service_role)' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const categoria = body.categoria;
    const validCategories = ['autoridad', 'docente', 'invitado', 'estudiante'];
    if (!nombre || !validCategories.includes(categoria)) {
      return NextResponse.json(
        { error: 'Nombre y categoría válidos son requeridos' },
        { status: 400 }
      );
    }

    const token = crypto.randomUUID();
    const supabase = createSupabaseServer();

    // Validación ultra-estricta de nombre único (insensible a mayúsculas/minúsculas)
    const { count } = await supabase
      .from('registros')
      .select('id', { count: 'exact', head: true })
      .ilike('nombre', nombre);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Este nombre ya se encuentra registrado. Por favor, añade un segundo apellido para diferenciarte.' },
        { status: 400 }
      );
    }

    // Generar código de acceso único (6 caracteres alfanuméricos)
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from('registros')
      .insert({ nombre, categoria, token, codigo_acceso: accessCode })
      .select('id, nombre, categoria, token, codigo_acceso')
      .single();

    if (error) {
      console.error('Error creating registro:', error);
      return NextResponse.json({ error: 'Error al registrarse' }, { status: 500 });
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return NextResponse.json({
      id: data.id,
      nombre: data.nombre,
      categoria: data.categoria,
      codigo_acceso: data.codigo_acceso,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
