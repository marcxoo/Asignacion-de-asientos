import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const supabase = createSupabaseServer();

    const [{ data: template }, { count: assignedCount }, { count: pendingInvites }, { data: quotas }] = await Promise.all([
      supabase.from('templates').select('id, name, created_at').eq('id', eventId).single(),
      supabase.from('assignments').select('seat_id', { count: 'exact', head: true }).eq('template_id', eventId),
      supabase.from('registros').select('id', { count: 'exact', head: true }).eq('template_id', eventId).eq('invitation_status', 'pending'),
      supabase.from('event_quotas').select('categoria, cupo_total, cupo_usado').eq('template_id', eventId),
    ]);

    if (!template) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      event: template,
      metrics: {
        assigned: assignedCount ?? 0,
        pendingInvites: pendingInvites ?? 0,
      },
      quotas: quotas ?? [],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
