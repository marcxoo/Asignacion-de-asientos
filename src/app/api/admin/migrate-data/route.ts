import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    const { target_template_id } = await request.json();
    if (!target_template_id) return NextResponse.json({ error: 'Falta target_template_id' }, { status: 400 });

    const supabase = createSupabaseServer();

    // 1. Update assignments
    const { error: assignError, data: assignData } = await supabase
        .from('assignments')
        .update({ template_id: target_template_id })
        .is('template_id', null)
        .select('seat_id');

    // 2. Update registros
    const { error: regError, data: regData } = await supabase
        .from('registros')
        .update({ template_id: target_template_id })
        .is('template_id', null)
        .select('id');

    if (assignError) console.error('Error migrando assignments:', assignError);
    if (regError) console.error('Error migrando registros:', regError);

    if (assignError || regError) {
        return NextResponse.json({ error: 'Error migrando datos' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        message: 'Datos migrados correctamente',
        migrated_assignments: assignData?.length || 0,
        migrated_registros: regData?.length || 0
    });
}
