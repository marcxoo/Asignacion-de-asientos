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
    const templateId = body.template_id;

    if (!seatId || !templateId) {
      return NextResponse.json({ error: 'seat_id y template_id requeridos' }, { status: 400 });
    }

    const supabase = createSupabaseServer();

    const { data: registro } = await supabase
      .from('registros')
      .select('id, nombre, categoria')
      .eq('token', token)
      .eq('template_id', templateId) // Asegurar que el registro sea para ESE evento
      .single();

    if (!registro) {
      return NextResponse.json({ error: 'No autorizado para este evento' }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from('assignments')
      .select('seat_id, registro_id, categoria, nombre_invitado')
      .eq('seat_id', seatId)
      .eq('template_id', templateId) // Filtrar por evento
      .single();

    if (existing) {
      const isTeacherSlot = existing.categoria === 'docente' && (!existing.registro_id || existing.nombre_invitado === 'Cupo Disponible' || existing.nombre_invitado === 'Reservado');
      const isGuestSlot = existing.categoria === 'invitado' && (!existing.registro_id || existing.nombre_invitado === 'Cupo Disponible' || existing.nombre_invitado === 'Reservado');
      const isStudentSlot = existing.categoria === 'estudiante' && (!existing.registro_id || existing.nombre_invitado === 'Cupo Disponible' || existing.nombre_invitado === 'Reservado');

      const isSlotForMe =
        (registro.categoria === 'docente' && isTeacherSlot) ||
        (registro.categoria === 'invitado' && isGuestSlot) ||
        (registro.categoria === 'estudiante' && isStudentSlot);

      if (existing.registro_id || !isSlotForMe) {
        return NextResponse.json(
          { error: 'El asiento ya está ocupado o no corresponde a tu categoría' },
          { status: 409 }
        );
      }

      // If we reach here, it's an available slot of the correct category.
      // We delete it first to avoid unique constraint conflict on insert.
      await supabase.from('assignments').delete().eq('seat_id', seatId).eq('template_id', templateId);
    }

    // 4. Verificar si el usuario ya tiene OTRO asiento asignado en ESTE evento y liberarlo/revertirlo
    if (registro.categoria === 'docente') {
      await supabase
        .from('assignments')
        .update({
          nombre_invitado: 'Cupo Disponible',
          registro_id: null,
          categoria: 'docente'
        })
        .eq('registro_id', registro.id)
        .eq('template_id', templateId);
    } else {
      await supabase
        .from('assignments')
        .delete()
        .eq('registro_id', registro.id)
        .eq('template_id', templateId);
    }

    // 5. Asignar el nuevo asiento
    const { error: insertError } = await supabase.from('assignments').insert({
      seat_id: seatId,
      nombre_invitado: registro.nombre,
      categoria: registro.categoria,
      assigned_at: new Date().toISOString(),
      registro_id: registro.id,
      template_id: templateId
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
