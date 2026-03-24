import { NextRequest, NextResponse } from 'next/server';
import { generateAllSeatIds, parseSeatId } from '@/lib/seats-data';
import QRCode from 'qrcode';
import JSZip from 'jszip';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { eventId } = await params;
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const origin = configuredOrigin?.trim() || request.nextUrl.origin;
  const format = request.nextUrl.searchParams.get('format')?.toLowerCase();

  const rows = generateAllSeatIds().map((seatId) => {
    const info = parseSeatId(seatId);
    return {
      seat_id: seatId,
      fila: info.label,
      seccion: info.sectionLabel,
      asiento_numero: info.numero,
      display: info.display,
      checkin_url: `${origin}/checkin?seat=${encodeURIComponent(seatId)}`,
    };
  });

  if (format === 'csv') {
    const csvLines = buildCsv(rows);

    const csv = csvLines.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qr-links-${eventId}.csv"`,
      },
    });
  }

  if (format === 'zip') {
    const zip = new JSZip();
    const csv = buildCsv(rows).join('\n');
    zip.file('qr-links.csv', csv);

    zip.file(
      'README.txt',
      [
        'Paquete de QR de check-in por asiento',
        '',
        'Contenido:',
        '- qr-links.csv: listado completo con URL por asiento',
        '- qr-png/: un PNG QR por asiento',
        '',
        'Uso recomendado:',
        '1) Imprime y pega cada QR en su asiento correspondiente.',
        '2) El invitado abre primero su enlace de invitacion en su celular.',
        '3) Escanea el QR de su asiento y confirma check-in.',
      ].join('\n')
    );

    const qrFolder = zip.folder('qr-png');
    if (qrFolder) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const qrPng = await QRCode.toBuffer(row.checkin_url, {
          type: 'png',
          width: 720,
          margin: 1,
          errorCorrectionLevel: 'M',
        });

        const index = String(i + 1).padStart(3, '0');
        const safeSeat = row.seat_id.replace(/[^a-zA-Z0-9\-_]/g, '_');
        qrFolder.file(`${index}_${safeSeat}.png`, qrPng);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const zipBody = new Uint8Array(zipBuffer);

    return new NextResponse(zipBody, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="qr-pack-${eventId}.zip"`,
      },
    });
  }

  return NextResponse.json({
    event_id: eventId,
    total: rows.length,
    rows,
  });
}

function buildCsv(rows: Array<{ seat_id: string; fila: string; seccion: string; asiento_numero: number; display: string; checkin_url: string }>) {
  const header = ['seat_id', 'fila', 'seccion', 'asiento_numero', 'display', 'checkin_url'];
  const escapeCsv = (value: string | number) => {
    const raw = String(value ?? '');
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  return [
    header.join(','),
    ...rows.map((row) =>
      [row.seat_id, row.fila, row.seccion, row.asiento_numero, row.display, row.checkin_url]
        .map(escapeCsv)
        .join(',')
    ),
  ];
}
