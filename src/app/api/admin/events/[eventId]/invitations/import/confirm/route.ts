import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { CsvInviteRow } from '@/lib/types';
import { writeAuditLog } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

function generateAccessCode(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? (body.rows as CsvInviteRow[]) : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const emails = rows.map((r) => r.correo.toLowerCase());

    const { data: existing, error: existingError } = await supabase
      .from('registros')
      .select('id, correo, invitation_status')
      .eq('template_id', eventId)
      .in('correo', emails);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingByEmail = new Map((existing ?? []).map((r) => [String(r.correo).toLowerCase(), r]));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const toInsert = [];
    for (const row of rows) {
      const correo = row.correo.toLowerCase();
      const current = existingByEmail.get(correo);
      if (!current) {
        toInsert.push({
          nombre: row.nombre,
          categoria: row.categoria,
          correo,
          departamento: row.departamento ?? null,
          template_id: eventId,
          token: crypto.randomUUID(),
          codigo_acceso: generateAccessCode(),
          invitation_status: 'pending',
        });
        continue;
      }

      if (current.invitation_status === 'reserved') {
        skipped += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from('registros')
        .update({
          nombre: row.nombre,
          categoria: row.categoria,
          correo,
          departamento: row.departamento ?? null,
        })
        .eq('id', current.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      updated += 1;
    }

    if (toInsert.length > 0) {
      const { error: insertError, data: insertedRows } = await supabase
        .from('registros')
        .insert(toInsert)
        .select('id');
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      inserted = insertedRows?.length ?? toInsert.length;
    }

    await writeAuditLog({
      templateId: eventId,
      actorType: 'system',
      action: 'import_csv_confirm',
      entity: 'registros',
      payload: { inserted, updated, skipped, total: rows.length },
    });

    return NextResponse.json({ inserted, updated, skipped, total: rows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al confirmar importación' }, { status: 500 });
  }
}
