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
      .select('id, categoria')
      .eq('token', token)
      .eq('template_id', template_id)
      .single();

    if (!registro) {
      return NextResponse.json({ error: 'Invitación inválida' }, { status: 401 });
    }

    const { data: assignment } = await supabase
      .from('assignments')
      .select('registro_id')
      .eq('seat_id', seat_id)
      .eq('template_id', template_id)
      .maybeSingle();

    if (!assignment || assignment.registro_id !== registro.id) {
      return NextResponse.json({ error: 'Solo puedes liberar tu propio asiento' }, { status: 403 });
    }

    const { error } = await supabase
      .from('assignments')
      .update({
        nombre_invitado: 'Cupo Disponible',
        registro_id: null,
        categoria: registro.categoria,
      })
      .eq('seat_id', seat_id)
      .eq('template_id', template_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from('registros')
      .update({ invitation_status: 'opened' })
      .eq('id', registro.id);

    await writeAuditLog({
      templateId: template_id,
      actorType: 'invitado',
      actorId: registro.id,
      action: 'release_seat_token',
      entity: 'assignments',
      entityId: seat_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
