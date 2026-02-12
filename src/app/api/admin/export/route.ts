import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';
import { parseSeatId } from '@/lib/seats-data';
import { SeatCategory } from '@/lib/types';

export async function GET() {
    const supabase = createSupabaseServer();
    const { data: assignments, error } = await supabase
        .from('assignments')
        .select('*');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data for Excel
    const rows = assignments.map((a: { seat_id: string; nombre_invitado: string; categoria: SeatCategory }) => {
        const { label, numero, sectionLabel } = parseSeatId(a.seat_id);
        return {
            'Seat ID': a.seat_id,
            'Fila': label,
            'Número': numero,
            'Sección': sectionLabel,
            'Categoría': a.categoria,
            'Nombre Invitado': a.nombre_invitado,
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asientos');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
        status: 200,
        headers: {
            'Content-Disposition': 'attachment; filename="asignacion_asientos.xlsx"',
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
    });
}
