import {
  PAYROLL_CONSTANTS,
  calcularTotales,
  getAllowedYearRange,
  isFortnight,
  PAYROLL_INPUT_FIELDS,
  type Fortnight,
  type PayrollInputs,
} from './payroll-calculations';

// Reglas compartidas: el formulario las usa para guiar al usuario y la API las
// vuelve a aplicar antes de escribir en el Sheet (el servidor nunca confía en el cliente).

export type PayrollField = (typeof PAYROLL_INPUT_FIELDS)[number];
export type FieldErrors = Partial<Record<PayrollField | 'general', string>>;
export type FormValues = Record<PayrollField, string>;

export const FIELD_LABELS: Record<PayrollField, string> = {
  salarioMensual: 'Salario mensual',
  diasLaborados: 'Días laborados',
  diasVacaciones: 'Días de vacaciones',
  horasExtra: 'Horas extra',
  otrosIngresos: 'Otros ingresos',
  consumo: 'Consumo',
  prestamo: 'Mi Prestamito',
  greceComida: 'GRECE Comida',
  otros: 'Otros',
};

const INTEGER_FIELDS: ReadonlySet<PayrollField> = new Set(['diasLaborados', 'diasVacaciones']);
const REQUIRED_FIELDS: ReadonlySet<PayrollField> = new Set(['salarioMensual', 'diasLaborados']);
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;

// La cédula es la llave del registro en la hoja: se normaliza igual en todos lados.
export function normalizeCedula(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

const MAX_NAME_LENGTH = 120;

// Nombre tal como se guarda en la columna "nombre" de DEDUCCIONES (solo para lectura
// humana de la hoja; la identidad real del registro sigue siendo periodo + cédula).
export function sanitizeNombre(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, MAX_NAME_LENGTH) : null;
}

export function inputsToForm(inputs: PayrollInputs): FormValues {
  return Object.fromEntries(PAYROLL_INPUT_FIELDS.map((field) => [field, String(inputs[field])])) as FormValues;
}

export function sameInputs(a: PayrollInputs, b: PayrollInputs): boolean {
  return PAYROLL_INPUT_FIELDS.every((field) => a[field] === b[field]) && !!a.aplicaIR === !!b.aplicaIR;
}

/**
 * Valida valores ya numéricos. `maxDays` es el tope de días que corresponde pagar
 * en la quincena (15, o menos si el empleado ingresó/salió dentro de ella).
 */
export function validatePayrollInputs(inputs: PayrollInputs, maxDays: number): FieldErrors {
  const errors: FieldErrors = {};

  for (const field of PAYROLL_INPUT_FIELDS) {
    const value = inputs[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) errors[field] = 'Valor numérico inválido';
    else if (value < 0) errors[field] = 'No puede ser negativo';
    else if (INTEGER_FIELDS.has(field) && !Number.isInteger(value)) errors[field] = 'Debe ser un número entero de días';
    else if (!INTEGER_FIELDS.has(field) && !hasAtMostTwoDecimals(value)) errors[field] = 'Máximo 2 decimales';
  }
  if (Object.keys(errors).length > 0) return errors;

  if (inputs.salarioMensual <= 0) errors.salarioMensual = 'Debe ser mayor que cero';

  // Los días laborados se topan por la quincena (o por ingreso/egreso). Las vacaciones pagadas NO se suman a ese tope:
  // pueden liquidarse completas (p. ej. en efectivo) aunque superen los 15 días de la quincena; el máximo es un mes comercial.
  if (inputs.diasLaborados > maxDays) {
    errors.diasLaborados = `Los días laborados (${inputs.diasLaborados}) superan los ${maxDays} que corresponden a esta quincena`;
  }
  if (inputs.diasVacaciones > PAYROLL_CONSTANTS.commercialMonthDays) {
    errors.diasVacaciones = `Máximo ${PAYROLL_CONSTANTS.commercialMonthDays} días de vacaciones`;
  }
  if (Object.keys(errors).length > 0) return errors;

  const calculo = calcularTotales(inputs);
  if (calculo.netoPagar < 0) {
    errors.general = `Las deducciones (${calculo.totalDeducciones.toFixed(2)}) superan lo devengado (${calculo.totalDevengado.toFixed(2)}); el neto sería negativo`;
  }
  return errors;
}

/** Convierte el texto del formulario a números y aplica todas las validaciones. */
export function parseFormValues(
  form: FormValues,
  maxDays: number,
  aplicaIR = false
): { values: PayrollInputs | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const parsed: Partial<PayrollInputs> = {};

  for (const field of PAYROLL_INPUT_FIELDS) {
    const text = (form[field] ?? '').trim();
    if (!text) {
      if (REQUIRED_FIELDS.has(field)) errors[field] = 'Campo requerido';
      else parsed[field] = 0;
    } else if (!DECIMAL_PATTERN.test(text)) {
      errors[field] = 'Use solo números y punto decimal';
    } else {
      parsed[field] = Number(text);
    }
  }
  if (Object.keys(errors).length > 0) return { values: null, errors };

  const values = { ...(parsed as PayrollInputs), aplicaIR };
  const fieldErrors = validatePayrollInputs(values, maxDays);
  return Object.keys(fieldErrors).length > 0 ? { values: null, errors: fieldErrors } : { values, errors: {} };
}

/** Lee un objeto desconocido (cuerpo de la petición) exigiendo todos los campos numéricos. */
export function coercePayrollInputs(raw: unknown): PayrollInputs | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const result: Partial<PayrollInputs> = {};
  for (const field of PAYROLL_INPUT_FIELDS) {
    const value = source[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    result[field] = value;
  }
  // Opcional por compatibilidad con clientes anteriores: si no viene, el IR no se aplica.
  if (source.aplicaIR !== undefined && typeof source.aplicaIR !== 'boolean') return null;
  result.aplicaIR = source.aplicaIR === true;
  return result as PayrollInputs;
}

// ── Periodo ──────────────────────────────────────────────────────────────────

export type PeriodParams = { year: number; month: number; fortnight: Fortnight };

export function parsePeriodParams(
  year: unknown,
  month: unknown,
  fortnight: unknown,
  now: Date = new Date()
): { ok: true; value: PeriodParams } | { ok: false; error: string } {
  const y = typeof year === 'number' ? year : Number(String(year ?? '').trim() || NaN);
  const m = typeof month === 'number' ? month : Number(String(month ?? '').trim() || NaN);
  // Margen de 1 año: el servidor puede estar en otra zona horaria y cruzar de año antes que el cliente.
  const range = getAllowedYearRange(now, 1);

  if (!Number.isInteger(y) || y < range.min || y > range.max) {
    return { ok: false, error: `year debe ser un entero entre ${range.min} y ${range.max}` };
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) return { ok: false, error: 'month debe ser un entero de 1 a 12' };
  if (!isFortnight(fortnight)) return { ok: false, error: "fortnight debe ser 'first' o 'second'" };
  return { ok: true, value: { year: y, month: m, fortnight } };
}

// ── Contrato de la API /api/deducciones ──────────────────────────────────────

/** Versión que se asigna a filas guardadas antes de existir la columna actualizadoEn. */
export const LEGACY_VERSION = 'sin-version';
export const MAX_ROWS_PER_SAVE = 500;

export interface DeduccionApiItem {
  cedula: string;
  inputs: PayrollInputs;
  /** Marca de la última escritura de la fila (control de concurrencia optimista). */
  version: string;
  /** Nombre guardado en la hoja (columna "nombre"); solo informativo. */
  nombre: string | null;
  /** Total a pagar que quedó escrito en la hoja al momento de guardar; solo informativo,
   *  el neto vigente siempre se recalcula en el cliente con calcularTotales(inputs). */
  totalPagarGuardado: number | null;
}

export interface DeduccionSaveItem {
  cedula: string;
  inputs: PayrollInputs;
  /** Versión que el cliente cargó; null si la fila no existía en la hoja. */
  version: string | null;
  nombre: string;
}

export interface DeduccionProblem {
  fila: number;
  motivo: string;
}

// ── Historial de cambios (para auditar, p. ej., ajustes de vacaciones en el año) ──

export interface FieldChange {
  campo: PayrollField | 'aplicaIR';
  anterior: number;
  nuevo: number;
}

/** Compara los valores previos guardados contra los nuevos. `before` null = fila nueva
 * (no se reporta como "cambio": es una creación, no un ajuste). */
export function computeInputDiffs(before: PayrollInputs | null, after: PayrollInputs): FieldChange[] {
  if (!before) return [];
  const changes: FieldChange[] = PAYROLL_INPUT_FIELDS.filter((field) => before[field] !== after[field]).map((field) => ({
    campo: field,
    anterior: before[field],
    nuevo: after[field],
  }));
  if (!!before.aplicaIR !== !!after.aplicaIR) changes.push({ campo: 'aplicaIR', anterior: before.aplicaIR ? 1 : 0, nuevo: after.aplicaIR ? 1 : 0 });
  return changes;
}
