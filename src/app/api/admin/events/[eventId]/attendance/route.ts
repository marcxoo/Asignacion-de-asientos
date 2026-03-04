import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const registroId = typeof body.registro_id === 'string' ? body.registro_id.trim() : '';
    const attended = body.attended !== false;

    if (!registroId) {
      return NextResponse.json({ error: 'registro_id es requerido' }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const attendedAt = attended ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from('registros')
      .update({ attended_at: attendedAt })
      .eq('id', registroId)
      .eq('template_id', eventId)
      .select('id, attended_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      registro_id: data.id,
      attended: Boolean(data.attended_at),
      attended_at: data.attended_at,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
