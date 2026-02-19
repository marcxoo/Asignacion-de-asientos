import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getMailProvider } from '@/lib/mail-service';
import { writeAuditLog } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const resend = Boolean(body.resend);
    const limit = Math.min(Number(body.limit) || 500, 2000);

    const supabase = createSupabaseServer();
    const statusFilter = resend ? ['pending', 'sent'] : ['pending'];

    const { data: template } = await supabase
      .from('templates')
      .select('name')
      .eq('id', eventId)
      .single();

    const { data: recipients, error } = await supabase
      .from('registros')
      .select('id, nombre, correo, token')
      .eq('template_id', eventId)
      .in('invitation_status', statusFilter)
      .not('correo', 'is', null)
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, total: 0, mode: 'simulate' });
    }

    const origin = request.nextUrl.origin;
    const provider = getMailProvider();
    const sendResult = await provider.sendInvitationBatch(
      recipients.map((r) => ({
        nombre: r.nombre,
        correo: r.correo,
        inviteLink: `${origin}/invitacion/${r.token}`,
        eventName: template?.name ?? 'Evento',
      }))
    );

    const now = new Date().toISOString();
    const ids = recipients.map((r) => r.id);
    await supabase
      .from('registros')
      .update({ invitation_status: 'sent', invitation_sent_at: now, invitation_last_error: null })
      .in('id', ids);

    await supabase.from('invitation_campaigns').insert({
      template_id: eventId,
      subject: body.subject ?? null,
      mode: 'simulate',
      status: sendResult.failed > 0 ? 'failed' : 'completed',
      total: recipients.length,
      sent: sendResult.sent,
      failed: sendResult.failed,
      completed_at: now,
    });

    await writeAuditLog({
      templateId: eventId,
      actorType: 'system',
      action: 'send_invitations',
      entity: 'registros',
      payload: {
        total: recipients.length,
        sent: sendResult.sent,
        failed: sendResult.failed,
        mode: 'simulate',
      },
    });

    return NextResponse.json({
      total: recipients.length,
      sent: sendResult.sent,
      failed: sendResult.failed,
      mode: 'simulate',
      failures: sendResult.failures,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo enviar la campaña' }, { status: 500 });
  }
}
