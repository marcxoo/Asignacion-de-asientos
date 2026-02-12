import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
    const supabase = createSupabaseServer();

    // 1. Obtener todos los registros ordenados por fecha de creación (los más viejos primero)
    const { data: registros, error: fetchError } = await supabase
        .from('registros')
        .select('id, nombre, created_at')
        .order('created_at', { ascending: true });

    if (fetchError || !registros) {
        return NextResponse.json({ error: 'Error al obtener registros' }, { status: 500 });
    }

    const vistos = new Set();
    const aEliminar: string[] = [];

    // 2. Identificar duplicados (ignorando mayúsculas y espacios)
    for (const r of registros) {
        const nombreNormalizado = r.nombre.trim().toLowerCase();
        if (vistos.has(nombreNormalizado)) {
            aEliminar.push(r.id);
        } else {
            vistos.add(nombreNormalizado);
        }
    }

    if (aEliminar.length === 0) {
        return NextResponse.json({ message: 'No se encontraron duplicados' });
    }

    // 3. Eliminar los duplicados
    const { error: deleteError } = await supabase
        .from('registros')
        .delete()
        .in('id', aEliminar);

    if (deleteError) {
        return NextResponse.json({ error: 'Error al eliminar duplicados', details: deleteError }, { status: 500 });
    }

    return NextResponse.json({
        message: 'Limpieza completada',
        eliminados: aEliminar.length,
        ids: aEliminar
    });
}
