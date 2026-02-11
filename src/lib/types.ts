export type SeatCategory = 'autoridad' | 'docente' | 'invitado';

export interface SeatAssignment {
  nombre_invitado: string;
  categoria: SeatCategory;
  asignado_en: string;
}

export type SeatState = Record<string, SeatAssignment | undefined>;

export interface RowConfig {
  id: string;
  label: string;
  left?: number;
  right?: number;
  center?: number;
  type?: 'wing' | 'center' | 'cabin-flank';
  doors?: boolean;
  wideAisle?: boolean;
}
