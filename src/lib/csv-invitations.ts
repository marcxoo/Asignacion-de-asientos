import * as XLSX from 'xlsx';
import { CsvInviteRow, SeatCategory } from '@/lib/types';

const VALID_CATEGORIES = new Set<SeatCategory>(['autoridad', 'docente', 'invitado', 'estudiante']);

type RawRow = Record<string, unknown>;

export interface CsvPreviewResult {
  total: number;
  valid: number;
  invalid: number;
  duplicates_in_file: number;
  rows: CsvInviteRow[];
  errors: Array<{ row: number; message: string }>;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function normalizeCategory(value: string): SeatCategory | null {
  const normalized = value.trim().toLowerCase() as SeatCategory;
  if (!VALID_CATEGORIES.has(normalized) || normalized === 'bloqueado') return null;
  return normalized;
}

function readRowField(row: RawRow, keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val != null) {
      const asString = getString(String(val));
      if (asString) return asString;
    }
  }
  return '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function parseInvitationsFile(buffer: ArrayBuffer): CsvPreviewResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  const validRows: CsvInviteRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const byEmail = new Map<string, CsvInviteRow>();
  let duplicates = 0;

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const nombreRaw = readRowField(row, ['nombre', 'Nombre', 'NOMBRE']);
    const correoRaw = readRowField(row, ['correo', 'Correo', 'CORREO', 'email', 'Email', 'EMAIL']);
    const categoriaRaw = readRowField(row, ['categoria', 'Categoría', 'Categoria', 'CATEGORIA']);
    const departamento = readRowField(row, ['departamento', 'Departamento', 'DEPARTAMENTO']);

    const nombre = normalizeName(nombreRaw);
    const correo = normalizeEmail(correoRaw);
    const categoria = normalizeCategory(categoriaRaw || 'docente');

    if (!nombre) {
      errors.push({ row: line, message: 'Nombre requerido' });
      return;
    }
    if (!correo || !isValidEmail(correo)) {
      errors.push({ row: line, message: 'Correo inválido' });
      return;
    }
    if (!categoria || categoria === 'bloqueado') {
      errors.push({ row: line, message: 'Categoría inválida' });
      return;
    }

    const normalized: CsvInviteRow = {
      nombre,
      correo,
      categoria,
      departamento: departamento || undefined,
    };

    if (byEmail.has(correo)) duplicates++;
    byEmail.set(correo, normalized);
  });

  byEmail.forEach((value) => validRows.push(value));

  return {
    total: rows.length,
    valid: validRows.length,
    invalid: errors.length,
    duplicates_in_file: duplicates,
    rows: validRows,
    errors,
  };
}
