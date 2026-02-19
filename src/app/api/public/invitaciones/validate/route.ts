import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from('registros')
      .select('id, nombre, categoria, correo, template_id, invitation_status, invitation_expires_at')
      .eq('token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Invitación inválida' }, { status: 404 });
    }

    if (data.invitation_expires_at && new Date(data.invitation_expires_at) < new Date()) {
      await supabase
        .from('registros')
        .update({ invitation_status: 'expired' })
        .eq('id', data.id);
      return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 });
    }

    if (data.invitation_status === 'pending' || data.invitation_status === 'sent') {
      await supabase
        .from('registros')
        .update({ invitation_status: 'opened', invitation_opened_at: new Date().toISOString() })
        .eq('id', data.id);
      data.invitation_status = 'opened';
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
