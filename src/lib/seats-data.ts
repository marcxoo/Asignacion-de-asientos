import { RowConfig, SeatCategory } from './types';

// Row definitions matching the specific schema
export const ROWS: RowConfig[] = [
  // Top Level: Wings (Far sides) and Cabin Flanks
  { id: 'W', label: 'W', left: 14, right: 14, type: 'wing' },
  { id: 'CB', label: 'K', left: 9, right: 9, type: 'cabin-flank' },

  // Main Section - J down to A
  { id: 'R17', label: 'J', left: 17, right: 17, leftWallOffset: 0, leftAisleOffset: 0, rightWallOffset: 0, rightAisleOffset: 0 },
  { id: 'R16', label: 'I', left: 17, right: 17, leftWallOffset: 0, leftAisleOffset: 0, rightWallOffset: 0, rightAisleOffset: 0 },
  { id: 'R15', label: 'H', left: 16, right: 16, leftWallOffset: 1, leftAisleOffset: 0, rightWallOffset: 1, rightAisleOffset: 0 },
  { id: 'R14', label: 'G', left: 16, right: 16, leftWallOffset: 1, leftAisleOffset: 0, rightWallOffset: 1, rightAisleOffset: 0 },
  { id: 'R13', label: 'F', left: 15, right: 15, leftWallOffset: 2, leftAisleOffset: 0, rightWallOffset: 2, rightAisleOffset: 0 },
  { id: 'R12', label: 'E', left: 14, right: 14, leftWallOffset: 3, leftAisleOffset: 0, rightWallOffset: 3, rightAisleOffset: 0 },
  { id: 'R11', label: 'D', left: 14, right: 14, leftWallOffset: 3, leftAisleOffset: 0, rightWallOffset: 3, rightAisleOffset: 0, doors: true },
  { id: 'R10', label: 'C', left: 13, right: 13, leftWallOffset: 4, leftAisleOffset: 0, rightWallOffset: 4, rightAisleOffset: 0 },
  { id: 'R9', label: 'B', left: 13, right: 13, leftWallOffset: 4, leftAisleOffset: 0, rightWallOffset: 4, rightAisleOffset: 0 },
  { id: 'R8', label: 'A', left: 10, right: 10, leftWallOffset: 4, leftAisleOffset: 3, rightWallOffset: 4, rightAisleOffset: 3 },

  // Bottom Center (Row 0)
  { id: 'C1', label: 'C1', center: 9, type: 'center' },
];

export function generateAllSeatIds(): string[] {
  const ids: string[] = [];
  for (const row of ROWS) {
    if (row.type === 'center' && row.center) {
      for (let i = 1; i <= row.center; i++) ids.push(`${row.id}-C-${i}`);
    } else if (row.type === 'wing') {
      for (let i = 1; i <= (row.left ?? 0); i++) ids.push(`${row.id}-WL-${i}`);
      for (let i = 1; i <= (row.right ?? 0); i++) ids.push(`${row.id}-WR-${i}`);
    } else {
      for (let i = 1; i <= (row.left ?? 0); i++) ids.push(`${row.id}-L-${i}`);
      for (let i = 1; i <= (row.right ?? 0); i++) ids.push(`${row.id}-R-${i}`);
    }
  }
  return ids;
}

export function parseSeatId(seatId: string) {
  const parts = seatId.split('-');
  const rowId = parts[0];
  const section = parts[1];
  const num = parts[2];
  const row = ROWS.find(r => r.id === rowId);

  const sectionLabels: Record<string, string> = {
    L: 'Ala Izquierda',
    R: 'Ala Derecha',
    C: 'Sección Central',
    WL: 'Ala Izq. Exterior',
    WR: 'Ala Der. Exterior',
    CL: 'Cabina Izquierda',
    CR: 'Cabina Derecha',
  };

  return {
    rowId,
    section,
    numero: parseInt(num),
    label: row?.label ?? rowId,
    sectionLabel: sectionLabels[section] ?? section,
    display: `Fila ${row?.label ?? rowId} · ${sectionLabels[section] ?? section} · Asiento ${num}`,
  };
}

export const CATEGORY_CONFIG: Record<SeatCategory, { label: string; color: string; hex: string }> = {
  autoridad: { label: 'Autoridad', color: 'bg-indigo-600', hex: '#4f46e5' }, // Indigo
  docente: { label: 'Docente', color: 'bg-sky-500', hex: '#0ea5e9' },      // Sky Blue
  invitado: { label: 'Invitado', color: 'bg-emerald-500', hex: '#10b981' }, // Emerald
  estudiante: { label: 'Estudiante', color: 'bg-orange-500', hex: '#f97316' }, // Orange
  bloqueado: { label: 'Bloqueado / Reservado', color: 'bg-indigo-900', hex: '#312e81' }, // Indigo 900
};

export const TEACHER_SLOT_LABEL = 'Cupo Disponible';
