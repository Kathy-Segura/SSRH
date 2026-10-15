import type { Employee } from '@/types/employee';
import type { PayrollCalculation, PayrollInputs, PeriodEligibility } from '@/lib/payroll-calculations';
import type { FieldErrors } from '@/lib/payroll-validation';

// Tipos y utilidades compartidas por payroll-module, payroll-detail y payroll-reports.

export const normalizeText = (value: string) => value.trim().toUpperCase();

export const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
};

// Clave para agrupar/comparar restaurantes: vive en lib/payroll-aggregates (con sus pruebas) y se re-exporta aquí
// para no cambiar los imports existentes. Ignora mayúsculas, tildes, signos y espacios repetidos.
export { restaurantKey } from '@/lib/payroll-aggregates';

// 0.07 * 100 da 7.000000000000001 en JavaScript: los porcentajes se redondean antes de mostrarse.
export const formatPercent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

export type PayrollRow = Employee & {
  cedulaKey: string;
  inputs: PayrollInputs;
  calculation: PayrollCalculation;
  eligibility: PeriodEligibility;
  // saved = igual a la hoja · pending = aún sin fila en la hoja · draft = cambios locales sin guardar
  // conflict = hay borrador, pero la hoja/ficha cambió los mismos campos después de crearlo
  status: 'saved' | 'pending' | 'draft' | 'conflict';
  /** Valores de la hoja (o los predeterminados de la ficha si aún no hay fila): base sobre la que se hacen los borradores. */
  baseInputs: PayrollInputs;
  version: string | null;
  issues: string[];
  warnings: string[];
  fieldErrors: FieldErrors;
};

export type SaveOutcome = { ok: true } | { ok: false; message: string };
