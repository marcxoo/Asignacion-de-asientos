import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const supabase = createSupabaseServer();
        const updates = [];

        interface ExcelRow {
            'Seat ID': string;
            'Nombre Invitado': string;
            'Categoría'?: string;
        }

        const rows = jsonData as ExcelRow[];

        for (const row of rows) {
            const seatId = row['Seat ID'];
            const nombreInvitado = row['Nombre Invitado'];
            const categoria = row['Categoría']; // Optional if we want to update category too

            if (seatId && nombreInvitado) {
                updates.push({
                    seat_id: seatId,
                    nombre_invitado: nombreInvitado,
                    categoria: categoria || 'invitado', // Default to invitado if missing
                    assigned_at: new Date().toISOString(),
                });
            }
        }

        if (updates.length > 0) {
            const { error } = await supabase
                .from('assignments')
                .upsert(updates, { onConflict: 'seat_id' });

            if (error) {
                console.error('Error updating assignments:', error);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }
        }

        return NextResponse.json({ message: `Successfully updated ${updates.length} assignments` });
    } catch (error) {
        console.error('Error processing file:', error);
        return NextResponse.json({ error: 'Error processing file' }, { status: 500 });
    }
}
