import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase-server';
import { parseSeatId } from '@/lib/seats-data';

const COOKIE_NAME = 'asiento_registro_token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : '';
    const seatId = typeof body.seat_id === 'string' ? body.seat_id.trim() : '';

    if (!eventId || !seatId) {
      return NextResponse.json({ error: 'event_id y seat_id son requeridos' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Sesion no valida. Abre primero tu enlace de invitacion.' }, { status: 401 });
    }

    const supabase = createSupabaseServer();

    const { data: registro, error: registroError } = await supabase
      .from('registros')
      .select('id, nombre, template_id, attended_at, checked_in_seat_id')
      .eq('token', token)
      .eq('template_id', eventId)
      .single();

    if (registroError || !registro) {
      return NextResponse.json({ error: 'Invitacion invalida para este evento' }, { status: 401 });
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('seat_id')
      .eq('template_id', eventId)
      .eq('registro_id', registro.id)
      .maybeSingle();

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }

    if (!assignment?.seat_id) {
      return NextResponse.json({ error: 'No tienes un asiento asignado' }, { status: 409 });
    }

    if (assignment.seat_id !== seatId) {
      return NextResponse.json(
        {
          error: 'Este QR no corresponde a tu asiento asignado',
          assigned_seat: assignment.seat_id,
          assigned_display: parseSeatId(assignment.seat_id).display,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('registros')
      .update({
        attended_at: registro.attended_at ?? now,
        checked_in_at: now,
        checked_in_seat_id: seatId,
        invitation_status: 'reserved',
      })
      .eq('id', registro.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Asistencia confirmada en tu asiento',
      seat_id: seatId,
      seat_display: parseSeatId(seatId).display,
      attendee: registro.nombre,
      already_attended: Boolean(registro.attended_at),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
