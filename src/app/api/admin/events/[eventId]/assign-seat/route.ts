import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { SeatCategory } from '@/lib/types';
import { parseSeatId } from '@/lib/seats-data';
import { getMailProvider, isRealMailEnabled } from '@/lib/mail-service';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

function generateAccessCode(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

const VALID_CATEGORIES: SeatCategory[] = ['autoridad', 'docente', 'administrativo', 'codigo_trabajo', 'invitado', 'estudiante', 'bloqueado'];

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json().catch(() => ({}));

    const seatId = typeof body.seat_id === 'string' ? body.seat_id.trim() : '';
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : '';
    const categoria = body.categoria as SeatCategory;
    const shouldSendEmail = body.send_email !== false;

    if (!seatId || !nombre || !correo || !categoria) {
      return NextResponse.json({ error: 'seat_id, nombre, correo y categoria son requeridos' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(categoria)) {
      return NextResponse.json({ error: 'Categoria invalida' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return NextResponse.json({ error: 'Correo invalido' }, { status: 400 });
    }

    const supabase = createSupabaseServer();

    const { data: existingRegistro, error: existingRegistroError } = await supabase
      .from('registros')
      .select('id, token, codigo_acceso')
      .eq('template_id', eventId)
      .eq('correo', correo)
      .maybeSingle();

    if (existingRegistroError) {
      return NextResponse.json({ error: existingRegistroError.message }, { status: 500 });
    }

    let registroId = existingRegistro?.id as string | undefined;
    let registroToken = existingRegistro?.token as string | undefined;

    if (!registroId) {
      const { data: insertedRegistro, error: insertRegistroError } = await supabase
        .from('registros')
        .insert({
          nombre,
          categoria,
          correo,
          template_id: eventId,
          token: crypto.randomUUID(),
          codigo_acceso: generateAccessCode(),
          invitation_status: 'reserved',
          invitation_reserved_at: new Date().toISOString(),
        })
        .select('id, token')
        .single();

      if (insertRegistroError || !insertedRegistro) {
        return NextResponse.json({ error: insertRegistroError?.message ?? 'No se pudo crear el registro' }, { status: 500 });
      }

      registroId = insertedRegistro.id;
      registroToken = insertedRegistro.token;
    } else {
      const { error: updateRegistroError } = await supabase
        .from('registros')
        .update({
          nombre,
          categoria,
          invitation_status: 'reserved',
          invitation_reserved_at: new Date().toISOString(),
          ...(existingRegistro?.codigo_acceso ? {} : { codigo_acceso: generateAccessCode() }),
          ...(existingRegistro?.token ? {} : { token: crypto.randomUUID() }),
        })
        .eq('id', registroId);

      if (updateRegistroError) {
        return NextResponse.json({ error: updateRegistroError.message }, { status: 500 });
      }

      if (!registroToken) {
        const { data: refreshedRegistro, error: refreshedRegistroError } = await supabase
          .from('registros')
          .select('token')
          .eq('id', registroId)
          .single();

        if (refreshedRegistroError || !refreshedRegistro?.token) {
          return NextResponse.json({ error: refreshedRegistroError?.message ?? 'No se pudo obtener token de registro' }, { status: 500 });
        }

        registroToken = refreshedRegistro.token;
      }
    }

    const { data: previousAssignments, error: previousAssignmentError } = await supabase
      .from('assignments')
      .select('seat_id')
      .eq('registro_id', registroId)
      .eq('template_id', eventId)
      .limit(1);

    if (previousAssignmentError) {
      return NextResponse.json({ error: previousAssignmentError.message }, { status: 500 });
    }

    const previousSeatId = previousAssignments?.[0]?.seat_id ?? null;

    const { error: releaseOldSeatError } = await supabase
      .from('assignments')
      .update({
        nombre_invitado: 'Cupo Disponible',
        registro_id: null,
        categoria,
      })
      .eq('registro_id', registroId)
      .eq('template_id', eventId)
      .neq('seat_id', seatId);

    if (releaseOldSeatError) {
      return NextResponse.json({ error: releaseOldSeatError.message }, { status: 500 });
    }

    const now = new Date().toISOString();

    const { error: clearSeatError } = await supabase
      .from('assignments')
      .delete()
      .eq('seat_id', seatId)
      .eq('template_id', eventId);

    if (clearSeatError) {
      return NextResponse.json({ error: clearSeatError.message }, { status: 500 });
    }

    const { error: insertAssignmentError } = await supabase.from('assignments').insert({
      seat_id: seatId,
      nombre_invitado: nombre,
      categoria,
      assigned_at: now,
      registro_id: registroId,
      template_id: eventId,
    });

    if (insertAssignmentError) {
      return NextResponse.json({ error: insertAssignmentError.message }, { status: 500 });
    }

    const isSeatChange = Boolean(previousSeatId && previousSeatId !== seatId);

    if (shouldSendEmail) {
      const { data: templateData } = await supabase.from('templates').select('name').eq('id', eventId).single();
      const seatLabel = parseSeatId(seatId).display;
      const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
      const origin = configuredOrigin?.trim() || request.nextUrl.origin;
      const viewLink = `${origin}/asignacion/${registroToken}`;

      if (!isRealMailEnabled()) {
        return NextResponse.json({
          warning: 'Asiento asignado. Configura RESEND_API_KEY y MAIL_FROM para enviar correos reales.',
          assigned: true,
          view_link: viewLink,
          seat_changed: isSeatChange,
          email_sent: false,
        });
      }

      try {
        const provider = getMailProvider();
        await provider.sendSeatAssignment({
          nombre,
          correo,
          eventName: templateData?.name ?? 'Evento',
          seatLabel,
          previousSeatLabel: isSeatChange ? parseSeatId(previousSeatId as string).display : undefined,
          viewLink,
        });

        return NextResponse.json({
          success: true,
          seat_changed: isSeatChange,
          email_sent: true,
        });
      } catch (error) {
        return NextResponse.json(
          {
            warning: 'Asiento asignado, pero no se pudo enviar el correo',
            detail: error instanceof Error ? error.message : 'Error enviando correo',
            assigned: true,
            seat_changed: isSeatChange,
            email_sent: false,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ success: true, seat_changed: isSeatChange, email_sent: false });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
