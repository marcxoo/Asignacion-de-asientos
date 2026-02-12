import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'asiento_registro_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(request: NextRequest) {
    try {
        const { code, template_id } = await request.json();

        if (!code || typeof code !== 'string' || !template_id) {
            return NextResponse.json({ error: 'Código y ID de evento requeridos' }, { status: 400 });
        }

        const supabase = createSupabaseServer();
        const normalizedCode = code.trim().toUpperCase();

        const { data, error } = await supabase
            .from('registros')
            .select('id, nombre, categoria, token, codigo_acceso')
            .eq('codigo_acceso', normalizedCode)
            .eq('template_id', template_id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Código inválido o no encontrado' }, { status: 401 });
        }

        // Set auth cookie
        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, data.token, {
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
            codigo_acceso: data.codigo_acceso
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
