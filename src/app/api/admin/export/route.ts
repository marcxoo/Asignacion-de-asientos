import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import ExcelJS from 'exceljs';
import { parseSeatId, ROWS } from '@/lib/seats-data';
import { SeatCategory } from '@/lib/types';

interface AssignmentExportRow {
  seat_id: string;
  nombre_invitado: string;
  categoria: SeatCategory;
}

const CATEGORY_FILL: Record<SeatCategory, string> = {
  autoridad: 'FF4F46E5',
  docente: 'FF0EA5E9',
  invitado: 'FF10B981',
  estudiante: 'FFF97316',
  bloqueado: 'FF312E81',
};

const CATEGORY_TEXT: Record<SeatCategory, string> = {
  autoridad: 'FFFFFFFF',
  docente: 'FF0B1220',
  invitado: 'FF0B1220',
  estudiante: 'FF0B1220',
  bloqueado: 'FFFFFFFF',
};

const LIGHT_CATEGORY_FILL: Record<SeatCategory, string> = {
  autoridad: 'FFE0E7FF',
  docente: 'FFE0F2FE',
  invitado: 'FFDCFCE7',
  estudiante: 'FFFFEDD5',
  bloqueado: 'FFEDE9FE',
};

function shortName(value: string): string {
  const t = value.trim();
  if (t.length <= 20) return t;
  return `${t.slice(0, 17)}...`;
}

function styleSeatCell(cell: ExcelJS.Cell, assignment?: AssignmentExportRow) {
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF0B1220' } },
    left: { style: 'thin', color: { argb: 'FF0B1220' } },
    bottom: { style: 'thin', color: { argb: 'FF0B1220' } },
    right: { style: 'thin', color: { argb: 'FF0B1220' } },
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: assignment ? CATEGORY_FILL[assignment.categoria] : 'FF1F314D' },
  };
  cell.font = {
    bold: true,
    size: 11,
    color: { argb: assignment ? CATEGORY_TEXT[assignment.categoria] : 'FFE2E8F0' },
  };
}

function renderSeat(
  sheet: ExcelJS.Worksheet,
  row: number,
  col: number,
  seatId: string,
  assignmentBySeat: Map<string, AssignmentExportRow>,
  seatCellRefs: Map<string, string>,
  assignmentRowBySeat: Map<string, number>
) {
  const assignment = assignmentBySeat.get(seatId);
  const cell = sheet.getCell(row, col);
  const numberToken = seatId.split('-').pop() ?? '';
  const assignmentRow = assignmentRowBySeat.get(seatId);
  if (assignment && assignmentRow) {
    cell.value = {
      text: numberToken,
      hyperlink: `#'Asignaciones'!B${assignmentRow}`,
    };
  } else {
    cell.value = numberToken;
  }
  styleSeatCell(cell, assignment);
  if (assignment && assignmentRow) {
    cell.font = {
      ...(cell.font || {}),
      underline: true,
    };
  }
  seatCellRefs.set(seatId, cell.address);
}

function styleLabel(cell: ExcelJS.Cell, text: string, color = 'FF94A3B8') {
  cell.value = text;
  cell.font = { bold: true, color: { argb: color }, size: 12 };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function drawEmergencyPillar(sheet: ExcelJS.Worksheet, rowStart: number, col: number) {
  for (let r = rowStart; r < rowStart + 3; r++) {
    const c = sheet.getCell(r, col);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
    c.border = {
      top: { style: 'thin', color: { argb: 'FFFCA5A5' } },
      left: { style: 'thin', color: { argb: 'FFFCA5A5' } },
      bottom: { style: 'thin', color: { argb: 'FFFCA5A5' } },
      right: { style: 'thin', color: { argb: 'FFFCA5A5' } },
    };
  }
  sheet.mergeCells(rowStart, col + 1, rowStart + 2, col + 2);
  styleLabel(sheet.getCell(rowStart, col + 1), 'P. EMERGENCIA', 'FFFCA5A5');
  sheet.getCell(rowStart, col + 1).alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
}

function createVisualMapSheet(
  workbook: ExcelJS.Workbook,
  assignments: AssignmentExportRow[],
  assignmentRowBySeat: Map<string, number>
) {
  const mapSheet = workbook.addWorksheet('Mapa Visual', {
    views: [{ state: 'frozen', ySplit: 8, xSplit: 2, showGridLines: false }],
  });

  const assignmentBySeat = new Map(assignments.map((a) => [a.seat_id, a]));
  const seatCellRefs = new Map<string, string>();

  for (let c = 1; c <= 76; c++) mapSheet.getColumn(c).width = 3.4;
  for (let r = 1; r <= 50; r++) mapSheet.getRow(r).height = r < 8 ? 21 : 24;

  for (let r = 1; r <= 50; r++) {
    for (let c = 1; c <= 76; c++) {
      const bg = mapSheet.getCell(r, c);
      bg.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0A1220' },
      };
    }
  }

  mapSheet.mergeCells(1, 2, 1, 74);
  const title = mapSheet.getCell(1, 2);
  title.value = 'MAPA VISUAL DEL AUDITORIO';
  title.font = { bold: true, size: 16, color: { argb: 'FFE5E7EB' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10233A' } };

  mapSheet.mergeCells(2, 2, 2, 74);
  const subtitle = mapSheet.getCell(2, 2);
  subtitle.value = 'Diseno referencial del mapa real: bloque izquierdo, pasillos, bloque derecho, alas y cabina.';
  subtitle.font = { size: 10, color: { argb: 'FF93A7C0' }, bold: true };
  subtitle.alignment = { horizontal: 'center', vertical: 'middle' };

  const legendItems: Array<{ label: string; color: string }> = [
    { label: 'Disponible', color: 'FF334155' },
    { label: 'Autoridad', color: CATEGORY_FILL.autoridad },
    { label: 'Docente', color: CATEGORY_FILL.docente },
    { label: 'Invitado', color: CATEGORY_FILL.invitado },
    { label: 'Estudiante', color: CATEGORY_FILL.estudiante },
    { label: 'Bloqueado', color: CATEGORY_FILL.bloqueado },
  ];

  let legendCol = 3;
  for (const item of legendItems) {
    const colorCell = mapSheet.getCell(4, legendCol);
    colorCell.value = '  ';
    colorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.color } };
    colorCell.border = {
      top: { style: 'thin', color: { argb: 'FF0B1220' } },
      left: { style: 'thin', color: { argb: 'FF0B1220' } },
      bottom: { style: 'thin', color: { argb: 'FF0B1220' } },
      right: { style: 'thin', color: { argb: 'FF0B1220' } },
    };
    colorCell.alignment = { horizontal: 'center', vertical: 'middle' };
    mapSheet.mergeCells(4, legendCol + 1, 4, legendCol + 5);
    const legendLabelCell = mapSheet.getCell(4, legendCol + 1);
    styleLabel(legendLabelCell, item.label, 'FFCBD5E1');
    legendCol += 7;
  }

  mapSheet.mergeCells(12, 2, 14, 10);
  const entrada = mapSheet.getCell(12, 2);
  styleLabel(entrada, 'ENTRADA', 'FFE2E8F0');
  entrada.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  entrada.border = {
    top: { style: 'thin', color: { argb: 'FF475569' } },
    left: { style: 'thin', color: { argb: 'FF475569' } },
    bottom: { style: 'thin', color: { argb: 'FF475569' } },
    right: { style: 'thin', color: { argb: 'FF475569' } },
  };
  mapSheet.mergeCells(12, 66, 14, 74);
  const salida = mapSheet.getCell(12, 66);
  styleLabel(salida, 'SALIDA', 'FFE2E8F0');
  salida.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  salida.border = {
    top: { style: 'thin', color: { argb: 'FF475569' } },
    left: { style: 'thin', color: { argb: 'FF475569' } },
    bottom: { style: 'thin', color: { argb: 'FF475569' } },
    right: { style: 'thin', color: { argb: 'FF475569' } },
  };

  const startRow = 8;
  const leftWingStartCol = 2;
  const leftBlockWallCol = 15;
  const leftAisleCol = 36;
  const rightAisleCol = 41;
  const rightWingStartCol = 68;
  const leftCabinStartCol = 20;
  const rightCabinStartCol = 49;

  mapSheet.mergeCells(startRow, 34, startRow + 2, 43);
  const cabinaCell = mapSheet.getCell(startRow, 34);
  cabinaCell.value = 'CABINA';
  cabinaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  cabinaCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  cabinaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  for (let i = 1; i <= 9; i++) {
    renderSeat(mapSheet, startRow + 1, leftCabinStartCol + (i - 1), `CB-CL-${i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
    renderSeat(mapSheet, startRow + 1, rightCabinStartCol + (i - 1), `CB-CR-${10 - i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
  }

  for (let i = 1; i <= 7; i++) {
    renderSeat(mapSheet, startRow + 1, leftWingStartCol + (i - 1), `W-WL-${i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
    renderSeat(mapSheet, startRow + 2, leftWingStartCol + (i - 1), `W-WL2-${i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
    renderSeat(mapSheet, startRow + 1, rightWingStartCol + (i - 1), `W-WR-${8 - i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
    renderSeat(mapSheet, startRow + 2, rightWingStartCol + (i - 1), `W-WR2-${8 - i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
  }

  mapSheet.mergeCells(startRow, 12, startRow + 2, 17);
  const leftTopEmergency = mapSheet.getCell(startRow, 12);
  styleLabel(leftTopEmergency, 'P. EMERGENCIA', 'FFFCA5A5');
  leftTopEmergency.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } };
  leftTopEmergency.border = {
    top: { style: 'thin', color: { argb: 'FFFCA5A5' } },
    left: { style: 'thin', color: { argb: 'FFFCA5A5' } },
    bottom: { style: 'thin', color: { argb: 'FFFCA5A5' } },
    right: { style: 'thin', color: { argb: 'FFFCA5A5' } },
  };

  mapSheet.mergeCells(startRow, 60, startRow + 2, 65);
  const rightTopEmergency = mapSheet.getCell(startRow, 60);
  styleLabel(rightTopEmergency, 'P. EMERGENCIA', 'FFFCA5A5');
  rightTopEmergency.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } };
  rightTopEmergency.border = {
    top: { style: 'thin', color: { argb: 'FFFCA5A5' } },
    left: { style: 'thin', color: { argb: 'FFFCA5A5' } },
    bottom: { style: 'thin', color: { argb: 'FFFCA5A5' } },
    right: { style: 'thin', color: { argb: 'FFFCA5A5' } },
  };

  const mainRows = ROWS.filter((r) => !r.type && !r.center);
  let rowPointer = startRow + 7;

  mainRows.forEach((r) => {
    const leftLabel = mapSheet.getCell(rowPointer, leftBlockWallCol - 2);
    styleLabel(leftLabel, r.label, 'FFE2E8F0');
    leftLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF233247' } };
    const rightLabel = mapSheet.getCell(rowPointer, rightWingStartCol - 2);
    styleLabel(rightLabel, r.label, 'FFE2E8F0');
    rightLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF233247' } };

    const leftCount = r.left ?? 0;
    const rightCount = r.right ?? 0;
    const leftAisleOffset = r.leftAisleOffset ?? 0;
    const rightAisleOffset = r.rightAisleOffset ?? 0;

    const leftEndCol = leftAisleCol - 1 - leftAisleOffset;
    const leftStartCol = leftEndCol - leftCount + 1;
    const rightStartCol = rightAisleCol + rightAisleOffset;

    for (let i = 1; i <= leftCount; i++) {
      renderSeat(mapSheet, rowPointer, leftStartCol + (i - 1), `${r.id}-L-${i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
    }

    for (let i = 0; i < rightCount; i++) {
      const seatNumber = rightCount - i;
      renderSeat(mapSheet, rowPointer, rightStartCol + i, `${r.id}-R-${seatNumber}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
    }

    for (let c = leftAisleCol; c <= rightAisleCol - 1; c++) {
      const aisle = mapSheet.getCell(rowPointer, c);
      aisle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1728' } };
      aisle.border = {
        top: { style: 'thin', color: { argb: 'FF1E293B' } },
        left: { style: 'thin', color: { argb: 'FF1E293B' } },
        bottom: { style: 'thin', color: { argb: 'FF1E293B' } },
        right: { style: 'thin', color: { argb: 'FF1E293B' } },
      };
    }

    rowPointer += 1;
  });

  mapSheet.mergeCells(rowPointer + 1, leftAisleCol, rowPointer + 1, rightAisleCol - 1);
  styleLabel(mapSheet.getCell(rowPointer + 1, leftAisleCol), 'PASILLO CENTRAL', 'FF64748B');

  rowPointer += 4;
  mapSheet.mergeCells(rowPointer - 1, 31, rowPointer - 1, 46);
  const centerContainerTop = mapSheet.getCell(rowPointer - 1, 31);
  centerContainerTop.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2636' } };
  mapSheet.mergeCells(rowPointer + 1, 31, rowPointer + 1, 46);
  const centerContainerBottom = mapSheet.getCell(rowPointer + 1, 31);
  centerContainerBottom.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2636' } };
  for (let i = 1; i <= 9; i++) {
    renderSeat(mapSheet, rowPointer, 34 + (i - 1), `C1-C-${i}`, assignmentBySeat, seatCellRefs, assignmentRowBySeat);
  }

  mapSheet.mergeCells(rowPointer + 4, 30, rowPointer + 4, 47);
  const screenCell = mapSheet.getCell(rowPointer + 4, 30);
  screenCell.value = 'PANTALLA LED';
  screenCell.alignment = { horizontal: 'center', vertical: 'middle' };
  screenCell.font = { bold: true, size: 14, color: { argb: 'FFCBD5E1' } };
  screenCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  drawEmergencyPillar(mapSheet, rowPointer - 5, 1);
  drawEmergencyPillar(mapSheet, rowPointer - 5, 73);

  return seatCellRefs;
}

function createDynamicTablesSheet(
  workbook: ExcelJS.Workbook,
  dataRowsCount: number,
  categoryCounts: Record<SeatCategory, number>,
  rowCounts: Record<string, number>
) {
  const sheet = workbook.addWorksheet('Tablas Dinamicas');
  sheet.columns = [
    { width: 24 },
    { width: 16 },
    { width: 16 },
    { width: 8 },
    { width: 24 },
    { width: 16 },
    { width: 16 },
  ];

  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = 'Tablas dinamicas (basadas en TablaAsignaciones)';
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

  sheet.getCell('A3').value = 'Por Categoria';
  sheet.getCell('A3').font = { bold: true, color: { argb: 'FF1E293B' } };
  sheet.getCell('E3').value = 'Por Fila';
  sheet.getCell('E3').font = { bold: true, color: { argb: 'FF1E293B' } };

  const categories = ['autoridad', 'docente', 'invitado', 'estudiante', 'bloqueado'];
  categories.forEach((cat, i) => {
    const row = 5 + i;
    sheet.getCell(row, 1).value = cat;
    const count = categoryCounts[cat as SeatCategory] ?? 0;
    sheet.getCell(row, 2).value = count;
    sheet.getCell(row, 3).value = dataRowsCount > 0 ? count / dataRowsCount : 0;
    sheet.getCell(row, 3).numFmt = '0.00%';
  });

  const rowLabels = ['W', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'C1'];
  rowLabels.forEach((label, i) => {
    const row = 5 + i;
    sheet.getCell(row, 5).value = label;
    const count = rowCounts[label] ?? 0;
    sheet.getCell(row, 6).value = count;
    sheet.getCell(row, 7).value = dataRowsCount > 0 ? count / dataRowsCount : 0;
    sheet.getCell(row, 7).numFmt = '0.00%';
  });

  sheet.addTable({
    name: 'TD_Categoria',
    ref: 'A4',
    headerRow: true,
    totalsRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [
      { name: 'Categoria', totalsRowLabel: 'TOTAL' },
      { name: 'Asientos', totalsRowFunction: 'sum' },
      { name: 'Porcentaje', totalsRowFunction: 'none' },
    ],
    rows: categories.map((cat, i) => {
      const row = 5 + i;
      return [
        cat,
        Number(sheet.getCell(row, 2).value || 0),
        Number(sheet.getCell(row, 3).value || 0),
      ];
    }),
  });

  sheet.addTable({
    name: 'TD_Fila',
    ref: 'E4',
    headerRow: true,
    totalsRow: true,
    style: { theme: 'TableStyleMedium9', showRowStripes: true },
    columns: [
      { name: 'Fila', totalsRowLabel: 'TOTAL' },
      { name: 'Asientos', totalsRowFunction: 'sum' },
      { name: 'Porcentaje', totalsRowFunction: 'none' },
    ],
    rows: rowLabels.map((label, i) => {
      const row = 5 + i;
      return [
        label,
        Number(sheet.getCell(row, 6).value || 0),
        Number(sheet.getCell(row, 7).value || 0),
      ];
    }),
  });

  for (let r = 5; r <= 5 + categories.length - 1; r++) {
    sheet.getCell(r, 3).numFmt = '0.00%';
  }
  for (let r = 5; r <= 5 + rowLabels.length - 1; r++) {
    sheet.getCell(r, 7).numFmt = '0.00%';
  }
}

function createInstructionsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Instrucciones');
  sheet.getColumn(1).width = 124;

  const lines = [
    'Como usar este archivo:',
    '1) La hoja que importa el sistema es "Asignaciones".',
    '2) Columnas obligatorias para importar: "Seat ID", "Nombre Invitado", "Categoría".',
    '3) Puedes hacer clic en Seat ID o Nombre en "Asignaciones" para saltar directo a su asiento en "Mapa Visual".',
    '4) No cambies los encabezados ni elimines la tabla "TablaAsignaciones".',
    '5) Categorias validas: autoridad, docente, invitado, estudiante, bloqueado.',
    '6) La hoja "Mapa Visual" replica el layout del auditorio para ubicar lugares rapidamente.',
    '7) La hoja "Tablas Dinamicas" incluye tablas y formulas para analisis rapido por categoria y fila.',
  ];

  lines.forEach((line, idx) => {
    const cell = sheet.getCell(idx + 1, 1);
    cell.value = line;
    cell.font = { size: idx === 0 ? 14 : 11, bold: idx === 0 };
  });
}

export async function GET(request: NextRequest) {
  const templateId = request.nextUrl.searchParams.get('template_id');
  if (!templateId) {
    return NextResponse.json({ error: 'template_id requerido' }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('seat_id, nombre_invitado, categoria')
    .eq('template_id', templateId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safeAssignments = (assignments ?? []) as AssignmentExportRow[];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Asientos';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = false;

  const sheet = workbook.addWorksheet('Asignaciones', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Seat ID', key: 'seat_id', width: 15 },
    { header: 'Nombre Invitado', key: 'nombre', width: 42 },
    { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Fila', key: 'fila', width: 10 },
    { header: 'Número', key: 'numero', width: 10 },
    { header: 'Sección', key: 'seccion', width: 25 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF002E45' },
  };

  const rowsForTable: Array<(string | number)[]> = [];
  const counts: Record<SeatCategory, number> = {
    autoridad: 0,
    docente: 0,
    invitado: 0,
    estudiante: 0,
    bloqueado: 0,
  };
  const rowCounts: Record<string, number> = {
    W: 0,
    K: 0,
    J: 0,
    I: 0,
    H: 0,
    G: 0,
    F: 0,
    E: 0,
    D: 0,
    C: 0,
    B: 0,
    A: 0,
    C1: 0,
  };

  safeAssignments.forEach((a) => {
    const { label, numero, sectionLabel } = parseSeatId(a.seat_id);
    rowsForTable.push([a.seat_id, a.nombre_invitado, a.categoria, label, numero, sectionLabel]);
    counts[a.categoria] += 1;
    if (rowCounts[label] !== undefined) {
      rowCounts[label] += 1;
    }
  });

  sheet.addTable({
    name: 'TablaAsignaciones',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
    },
    columns: [
      { name: 'Seat ID' },
      { name: 'Nombre Invitado' },
      { name: 'Categoría' },
      { name: 'Fila' },
      { name: 'Número' },
      { name: 'Sección' },
    ],
    rows: rowsForTable,
  });

  for (let r = 2; r <= rowsForTable.length + 1; r++) {
    const category = String(sheet.getCell(`C${r}`).value || '') as SeatCategory;
    const fillColor = LIGHT_CATEGORY_FILL[category] ?? 'FFFFFFFF';
    for (let c = 1; c <= 6; c++) {
      const cell = sheet.getCell(r, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    }
  }

  sheet.autoFilter = {
    from: 'A1',
    to: `F${Math.max(rowsForTable.length + 1, 2)}`,
  };

  const summarySheet = workbook.addWorksheet('Resumen');
  summarySheet.columns = [
    { header: 'Categoría', key: 'cat', width: 20 },
    { header: 'Total Asignados', key: 'count', width: 18 },
  ];
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

  (Object.keys(counts) as SeatCategory[]).forEach((cat) => {
    summarySheet.addRow({ cat: cat.toUpperCase(), count: counts[cat] });
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalRow = summarySheet.addRow({ cat: 'TOTAL', count: total });
  totalRow.font = { bold: true };

  const assignmentRowBySeat = new Map<string, number>();
  for (let i = 0; i < rowsForTable.length; i++) {
    assignmentRowBySeat.set(String(rowsForTable[i][0]), i + 2);
  }

  const seatCellRefs = createVisualMapSheet(workbook, safeAssignments, assignmentRowBySeat);

  for (let i = 0; i < rowsForTable.length; i++) {
    const excelRow = i + 2;
    const seatId = String(rowsForTable[i][0]);
    const nombre = String(rowsForTable[i][1]);
    const mapCell = seatCellRefs.get(seatId);
    if (!mapCell) continue;

    sheet.getCell(excelRow, 1).value = {
      text: seatId,
      hyperlink: `#'Mapa Visual'!${mapCell}`,
    };
    sheet.getCell(excelRow, 1).font = {
      color: { argb: 'FF1D4ED8' },
      underline: true,
      bold: true,
    };

    sheet.getCell(excelRow, 2).value = {
      text: nombre,
      hyperlink: `#'Mapa Visual'!${mapCell}`,
    };
    sheet.getCell(excelRow, 2).font = {
      color: { argb: 'FF1D4ED8' },
      underline: true,
      bold: true,
    };
  }

  createDynamicTablesSheet(workbook, rowsForTable.length, counts, rowCounts);
  createInstructionsSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Disposition': 'attachment; filename="asignacion_asientos.xlsx"',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}
