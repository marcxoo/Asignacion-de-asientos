import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const templateId = String(formData.get('template_id') || '').trim();

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }
        if (!templateId) {
            return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
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
                    template_id: templateId,
                });
            }
        }

        if (updates.length > 0) {
            const seatIds = updates.map(u => u.seat_id);
            const { data: existing } = await supabase
                .from('assignments')
                .select('id, seat_id')
                .eq('template_id', templateId)
                .in('seat_id', seatIds);

            const existingMap = new Map((existing || []).map(r => [r.seat_id, r.id]));

            const finalUpdates = updates.map(u => {
                if (existingMap.has(u.seat_id)) {
                    return { ...u, id: existingMap.get(u.seat_id) };
                }
                return u;
            });

            const { error } = await supabase
                .from('assignments')
                .upsert(finalUpdates);

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
