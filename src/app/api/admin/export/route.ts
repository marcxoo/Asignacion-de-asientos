import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import ExcelJS from 'exceljs';
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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Asientos';
    workbook.created = new Date();

    // ── Sheet 1: Asignaciones ──
    const sheet = workbook.addWorksheet('Asignaciones', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
        { header: 'Seat ID', key: 'seat_id', width: 15 },
        { header: 'Fila', key: 'fila', width: 10 },
        { header: 'Número', key: 'numero', width: 10 },
        { header: 'Sección', key: 'seccion', width: 25 },
        { header: 'Categoría', key: 'categoria', width: 15 },
        { header: 'Nombre Invitado', key: 'nombre', width: 40 },
    ];

    // Header Style
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF002E45' }, // Navy Blue
    };

    // Process Rows
    const counts: Record<string, number> = {
        autoridad: 0,
        docente: 0,
        invitado: 0,
        estudiante: 0,
    };

    assignments.forEach((a: { seat_id: string; nombre_invitado: string; categoria: SeatCategory }) => {
        const { label, numero, sectionLabel } = parseSeatId(a.seat_id);
        const row = sheet.addRow({
            seat_id: a.seat_id,
            fila: label,
            numero: numero,
            seccion: sectionLabel,
            categoria: a.categoria.toUpperCase(),
            nombre: a.nombre_invitado,
        });

        // Color Coding
        let argb = 'FFFFFFFF'; // Default White
        if (a.categoria === 'autoridad') argb = 'FFE0E7FF'; // Light Indigo
        if (a.categoria === 'docente') argb = 'FFE0F2FE'; // Light Sky
        if (a.categoria === 'invitado') argb = 'FFDCFCE7'; // Light Emerald
        if (a.categoria === 'estudiante') argb = 'FFFFEDD5'; // Light Orange

        row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb },
        };

        row.getCell('seat_id').protection = { locked: true }; // Attempt to lock ID

        // Count for valid categories
        if (counts[a.categoria] !== undefined) {
            counts[a.categoria]++;
        }
    });

    // ── Sheet 2: Resumen ──
    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.columns = [
        { header: 'Categoría', key: 'cat', width: 20 },
        { header: 'Total Asignados', key: 'count', width: 15 },
    ];

    summarySheet.getRow(1).font = { bold: true };

    Object.entries(counts).forEach(([cat, count]) => {
        summarySheet.addRow({ cat: cat.toUpperCase(), count });
    });

    // Total
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const totalRow = summarySheet.addRow({ cat: 'TOTAL', count: total });
    totalRow.font = { bold: true };
    totalRow.getCell('cat').alignment = { horizontal: 'right' };


    // Generate Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            'Content-Disposition': 'attachment; filename="asignacion_asientos.xlsx"',
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
    });
}
