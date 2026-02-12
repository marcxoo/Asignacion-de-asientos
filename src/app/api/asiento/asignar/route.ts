import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'asiento_registro_token';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const seatId = typeof body.seat_id === 'string' ? body.seat_id.trim() : '';
    if (!seatId) {
      return NextResponse.json({ error: 'seat_id requerido' }, { status: 400 });
    }

    const supabase = createSupabaseServer();

    const { data: registro } = await supabase
      .from('registros')
      .select('id, nombre, categoria')
      .eq('token', token)
      .single();

    if (!registro) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from('assignments')
      .select('seat_id, registro_id')
      .eq('seat_id', seatId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'El asiento ya está ocupado' },
        { status: 409 }
      );
    }

    // 4. Verificar si el usuario ya tiene OTRO asiento asignado y liberarlo
    await supabase
      .from('assignments')
      .delete()
      .eq('registro_id', registro.id);

    // 5. Asignar el nuevo asiento
    const { error: insertError } = await supabase.from('assignments').insert({
      seat_id: seatId,
      nombre_invitado: registro.nombre,
      categoria: registro.categoria,
      assigned_at: new Date().toISOString(),
      registro_id: registro.id,
    });

    if (insertError) {
      console.error('Error assigning seat:', insertError);
      return NextResponse.json({ error: 'Error al asignar asiento' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
