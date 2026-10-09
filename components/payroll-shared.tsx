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

// Clave para agrupar/comparar restaurantes: "Barrio Café", "BARRIO CAFE " y "Barrio Café" (con la é escrita
// de otra forma) son el mismo restaurante. Antes se agrupaba por el texto exacto y salían duplicados.
export const restaurantKey = (name: string | undefined) =>
  String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase() || 'SIN RESTAURANTE';

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
