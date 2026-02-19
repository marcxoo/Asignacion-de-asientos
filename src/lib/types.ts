export type SeatCategory = 'autoridad' | 'docente' | 'invitado' | 'estudiante' | 'bloqueado';

export interface SeatAssignment {
  nombre_invitado: string;
  categoria: SeatCategory;
  asignado_en: string;
  registro_id?: string | null;
}

export interface Registro {
  id: string;
  nombre: string;
  categoria: SeatCategory;
  codigo_acceso?: string;
  template_id?: string;
  correo?: string | null;
}

export type InvitationStatus = 'pending' | 'sent' | 'opened' | 'reserved' | 'expired' | 'cancelled';

export interface CsvInviteRow {
  nombre: string;
  correo: string;
  categoria: Exclude<SeatCategory, 'bloqueado'>;
  departamento?: string;
}

export type SeatState = Record<string, SeatAssignment | undefined>;

export interface RowConfig {
  id: string;
  label: string;
  left?: number;
  right?: number;
  center?: number;
  leftWallOffset?: number;
  leftAisleOffset?: number;
  rightWallOffset?: number;
  rightAisleOffset?: number;
  type?: 'wing' | 'center' | 'cabin-flank';
  doors?: boolean;
  wideAisle?: boolean;
}
