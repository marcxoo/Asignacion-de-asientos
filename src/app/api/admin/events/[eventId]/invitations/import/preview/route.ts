import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { parseInvitationsFile } from '@/lib/csv-invitations';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const preview = parseInvitationsFile(buffer);

    const emails = preview.rows.map((r) => r.correo);
    let duplicatesInDb = 0;
    if (emails.length > 0) {
      const supabase = createSupabaseServer();
      const { data } = await supabase
        .from('registros')
        .select('correo')
        .eq('template_id', eventId)
        .in('correo', emails);
      duplicatesInDb = data?.length ?? 0;
    }

    return NextResponse.json({
      ...preview,
      duplicates_in_db: duplicatesInDb,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo procesar el archivo' }, { status: 500 });
  }
}
