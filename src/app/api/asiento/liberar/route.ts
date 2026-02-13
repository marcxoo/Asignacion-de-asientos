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
      .select('id')
      .eq('token', token)
      .single();

    if (!registro) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: assignment } = await supabase
      .from('assignments')
      .select('registro_id')
      .eq('seat_id', seatId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: 'Asiento no asignado' }, { status: 404 });
    }
    if (assignment.registro_id !== registro.id) {
      return NextResponse.json(
        { error: 'Solo puedes liberar tu propio asiento' },
        { status: 403 }
      );
    }

    const { data: userData } = await supabase
      .from('registros')
      .select('categoria')
      .eq('id', registro.id)
      .single();

    const { error: updateError } = await supabase
      .from('assignments')
      .update({
        nombre_invitado: 'Cupo Disponible',
        registro_id: null,
        categoria: userData?.categoria || 'docente'
      })
      .eq('seat_id', seatId);

    if (updateError) {
      console.error('Error releasing seat:', updateError);
      return NextResponse.json({ error: 'Error al liberar asiento' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
