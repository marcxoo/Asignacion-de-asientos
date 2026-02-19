import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const { token, seat_id, template_id } = await request.json();

    if (!token || !seat_id || !template_id) {
      return NextResponse.json({ error: 'token, seat_id y template_id son requeridos' }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: registro } = await supabase
      .from('registros')
      .select('id, nombre, categoria, invitation_status')
      .eq('token', token)
      .eq('template_id', template_id)
      .single();

    if (!registro) {
      return NextResponse.json({ error: 'Invitación inválida' }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from('assignments')
      .select('seat_id, categoria, registro_id, nombre_invitado')
      .eq('seat_id', seat_id)
      .eq('template_id', template_id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'El asiento no existe para este evento' }, { status: 404 });
    }

    const isFreeSlot =
      existing.categoria === registro.categoria &&
      (!existing.registro_id || existing.nombre_invitado === 'Cupo Disponible' || existing.nombre_invitado === 'Reservado');

    if (!isFreeSlot && existing.registro_id !== registro.id) {
      return NextResponse.json({ error: 'Asiento no disponible para tu categoría' }, { status: 409 });
    }

    await supabase
      .from('assignments')
      .update({
        nombre_invitado: 'Cupo Disponible',
        registro_id: null,
        categoria: registro.categoria,
      })
      .eq('registro_id', registro.id)
      .eq('template_id', template_id);

    const { error: updateError } = await supabase
      .from('assignments')
      .update({
        nombre_invitado: registro.nombre,
        categoria: registro.categoria,
        registro_id: registro.id,
        assigned_at: new Date().toISOString(),
      })
      .eq('seat_id', seat_id)
      .eq('template_id', template_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase
      .from('registros')
      .update({ invitation_status: 'reserved', invitation_reserved_at: new Date().toISOString() })
      .eq('id', registro.id);

    await writeAuditLog({
      templateId: template_id,
      actorType: 'invitado',
      actorId: registro.id,
      action: 'reserve_seat_token',
      entity: 'assignments',
      entityId: seat_id,
      payload: { categoria: registro.categoria },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
