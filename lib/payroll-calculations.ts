// ─────────────────────────────────────────────────────────────────────────────
// Reglas de nómina (única fuente de verdad, usada por el front y por la API).
// Convención: mes comercial de 30 días, dos quincenas de 15 días pagados.
// ─────────────────────────────────────────────────────────────────────────────

export const PAYROLL_CONSTANTS = {
  // Techo mensual de cotización INSS. Revisar cuando el INSS lo actualice.
  inssCeilingMonthly: 88005.78,
  employeeInssRate: 0.07,
  employerInssRate: 0.215,
  inatecRate: 0.02,
  commercialMonthDays: 30,
  fortnightDays: 15,
  fortnightsPerYear: 24,
  workdayHours: 8,
  overtimeMultiplier: 2,
  // Aguinaldo, indemnización y vacaciones: 2.5 días por mes = 1.25 por quincena.
  provisionDaysPerFortnight: 1.25,
} as const;

// Tabla progresiva anual del IR laboral: tramos ordenados de menor a mayor.
// impuesto = base + (ingresoAnual - over) * rate
export const IR_BRACKETS = [
  { upTo: 100000, over: 0, rate: 0, base: 0 },
  { upTo: 200000, over: 100000, rate: 0.15, base: 0 },
  { upTo: 350000, over: 200000, rate: 0.2, base: 15000 },
  { upTo: 500000, over: 350000, rate: 0.25, base: 45000 },
  { upTo: Number.POSITIVE_INFINITY, over: 500000, rate: 0.3, base: 82500 },
] as const;

// Ventana de años que el módulo permite seleccionar/guardar.
export const PAYROLL_YEAR_WINDOW = { back: 2, forward: 1 } as const;

export interface PayrollInputs {
  salarioMensual: number;
  diasLaborados: number;
  diasVacaciones: number;
  horasExtra: number;
  otrosIngresos: number;
  consumo: number;
  prestamo: number;
  greceComida: number;
  otros: number;
  /**
   * Retención de IR laboral. Por defecto NO se aplica (undefined = false): la planilla deduce solo el INSS.
   * Se activa por empleado/quincena. No forma parte de PAYROLL_INPUT_FIELDS (no es numérico); en la hoja
   * vive en la columna P para no mover `totalPagar` (M).
   */
  aplicaIR?: boolean;
  /**
   * Excluye el INSS (pasantes o temporales que no cotizan). Por defecto SÍ cotizan (undefined = false).
   * En la hoja vive en la columna Q (vacío/0 = cotiza; 1 = excluido).
   */
  excluirINSS?: boolean;
}

// Orden canónico de los campos editables (formulario, validación y hoja).
export const PAYROLL_INPUT_FIELDS = [
  'salarioMensual',
  'diasLaborados',
  'diasVacaciones',
  'horasExtra',
  'otrosIngresos',
  'consumo',
  'prestamo',
  'greceComida',
  'otros',
] as const satisfies readonly (keyof PayrollInputs)[];

export interface PayrollCalculation {
  salarioQuincenal: number;
  basico: number;
  vacaciones: number;
  horasExtraMonto: number;
  totalDevengado: number;
  inssMensualBase: number;
  baseImponible: number;
  irLaboral: number;
  inssLaboral: number;
  otrasDeducciones: number;
  totalDeducciones: number;
  netoPagar: number;
  inssPatronal: number;
  inatec: number;
  provisionAguinaldo: number;
  provisionIndemnizacion: number;
  provisionVacaciones: number;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calcularBasico(salarioMensual: number, diasLaborados: number) {
  return money((salarioMensual / PAYROLL_CONSTANTS.commercialMonthDays) * diasLaborados);
}

export function calcularVacaciones(salarioMensual: number, diasVacaciones: number) {
  return money((salarioMensual / PAYROLL_CONSTANTS.commercialMonthDays) * diasVacaciones);
}

export function calcularHorasExtra(salarioMensual: number, horasExtra: number) {
  const valorHora = salarioMensual / PAYROLL_CONSTANTS.commercialMonthDays / PAYROLL_CONSTANTS.workdayHours;
  return money(valorHora * horasExtra * PAYROLL_CONSTANTS.overtimeMultiplier);
}

// La planilla es quincenal: se anualiza con 24 periodos y se prorratea de vuelta.
export function calcularIR(baseImponibleQuincenal: number) {
  const periodos = PAYROLL_CONSTANTS.fortnightsPerYear;
  const ingresoAnualizado = baseImponibleQuincenal * periodos;
  const tramo = IR_BRACKETS.find((item) => ingresoAnualizado <= item.upTo);
  if (!tramo || tramo.rate === 0) return 0;
  return money(((ingresoAnualizado - tramo.over) * tramo.rate + tramo.base) / periodos);
}

export function calcularINSSLaboral(baseQuincenal: number, ceiling = PAYROLL_CONSTANTS.inssCeilingMonthly) {
  const monthlyBase = baseQuincenal * 2;
  return money((Math.min(monthlyBase, ceiling) / 2) * PAYROLL_CONSTANTS.employeeInssRate);
}

export function calcularINSSPatronal(baseQuincenal: number, ceiling = PAYROLL_CONSTANTS.inssCeilingMonthly) {
  const monthlyBase = baseQuincenal * 2;
  return money((Math.min(monthlyBase, ceiling) / 2) * PAYROLL_CONSTANTS.employerInssRate);
}

export function calcularINATEC(baseQuincenal: number) {
  return money(baseQuincenal * PAYROLL_CONSTANTS.inatecRate);
}

export function calcularProvisiones(salarioMensual: number) {
  const provision = money(
    (salarioMensual / PAYROLL_CONSTANTS.commercialMonthDays) * PAYROLL_CONSTANTS.provisionDaysPerFortnight
  );
  return { provisionAguinaldo: provision, provisionIndemnizacion: provision, provisionVacaciones: provision };
}

export function calcularTotales(inputs: PayrollInputs, ceiling = PAYROLL_CONSTANTS.inssCeilingMonthly): PayrollCalculation {
  const salarioQuincenal = money(inputs.salarioMensual / 2);
  const basico = calcularBasico(inputs.salarioMensual, inputs.diasLaborados);
  const vacaciones = calcularVacaciones(inputs.salarioMensual, inputs.diasVacaciones);
  const horasExtraMonto = calcularHorasExtra(inputs.salarioMensual, inputs.horasExtra);
  const totalDevengado = money(basico + vacaciones + horasExtraMonto + inputs.otrosIngresos);

  // El INSS laboral se calcula una sola vez sobre el total devengado (con tope).
  const inssLaboral = inputs.excluirINSS === true ? 0 : calcularINSSLaboral(totalDevengado, ceiling);
  const baseImponible = money(totalDevengado - inssLaboral);
  const irLaboral = inputs.aplicaIR === true ? calcularIR(baseImponible) : 0;

  const otrasDeducciones = money(inputs.consumo + inputs.prestamo + inputs.greceComida + inputs.otros);
  const totalDeducciones = money(inssLaboral + irLaboral + otrasDeducciones);
  const provisiones = calcularProvisiones(inputs.salarioMensual);
  return {
    salarioQuincenal, basico, vacaciones, horasExtraMonto, totalDevengado,
    inssMensualBase: inssLaboral, // alias histórico del campo
    baseImponible, irLaboral, inssLaboral, otrasDeducciones,
    totalDeducciones, netoPagar: money(totalDevengado - totalDeducciones),
    inssPatronal: inputs.excluirINSS === true ? 0 : calcularINSSPatronal(totalDevengado, ceiling),
    inatec: calcularINATEC(totalDevengado), ...provisiones,
  };
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 }).format(value || 0);

// ─────────────────────────────────────────────────────────────────────────────
// Periodos (quincenas)
// ─────────────────────────────────────────────────────────────────────────────

export type Fortnight = 'first' | 'second';

export const isFortnight = (value: unknown): value is Fortnight => value === 'first' || value === 'second';

// Clave estable de periodo: la usan el front, /api/deducciones y la hoja DEDUCCIONES.
// No cambiar el formato: las filas ya guardadas en la hoja dependen de él.
export function getPeriodoKey(year: number, month: number, fortnight: Fortnight) {
  return `${year}-${String(month).padStart(2, '0')}-${fortnight}`;
}

export function getCurrentFortnight(date: Date = new Date()): Fortnight {
  return date.getDate() <= PAYROLL_CONSTANTS.fortnightDays ? 'first' : 'second';
}

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export function getFortnightBounds(year: number, month: number, fortnight: Fortnight) {
  return fortnight === 'first'
    ? { startDay: 1, endDay: PAYROLL_CONSTANTS.fortnightDays }
    : { startDay: PAYROLL_CONSTANTS.fortnightDays + 1, endDay: daysInMonth(year, month) };
}

export function getPayrollPeriod(year: number, month: number, fortnight: Fortnight) {
  const { startDay, endDay } = getFortnightBounds(year, month, fortnight);
  return { start: new Date(year, month - 1, startDay), end: new Date(year, month - 1, endDay) };
}

export function getAllowedYearRange(now: Date = new Date(), slack = 0) {
  const current = now.getFullYear();
  return { min: current - PAYROLL_YEAR_WINDOW.back - slack, max: current + PAYROLL_YEAR_WINDOW.forward + slack };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fechas de empleados y días que corresponde pagar en la quincena
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarDate { year: number; month: number; day: number }

const dateKey = (date: CalendarDate) => date.year * 10000 + date.month * 100 + date.day;

// Acepta AAAA-MM-DD (con o sin hora) y DD/MM/AAAA (también con - o .).
// Devuelve null si el texto está vacío o no es una fecha real de calendario.
export function parseCalendarDate(value: unknown): CalendarDate | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(text);
  const latam = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (latam) [day, month, year] = [Number(latam[1]), Number(latam[2]), Number(latam[3])];
  else return null;

  const check = new Date(Date.UTC(year, month - 1, day));
  const isReal = check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  return isReal ? { year, month, day } : null;
}

export interface PeriodEligibility {
  status: 'full' | 'partial' | 'outside';
  days: number;
  reason: string;
}

// Días a pagar en la quincena según ingreso/egreso, con mes comercial de 30 días:
// una quincena completa siempre vale 15 días (también la segunda de meses de 28, 29 o 31).
export function getEmployeeDaysInPeriod(
  ingreso: CalendarDate | null,
  egreso: CalendarDate | null,
  year: number,
  month: number,
  fortnight: Fortnight
): PeriodEligibility {
  const { fortnightDays, commercialMonthDays } = PAYROLL_CONSTANTS;
  const { startDay, endDay } = getFortnightBounds(year, month, fortnight);
  const start: CalendarDate = { year, month, day: startDay };
  const end: CalendarDate = { year, month, day: endDay };

  if (ingreso && dateKey(ingreso) > dateKey(end)) return { status: 'outside', days: 0, reason: 'Ingresa después de esta quincena' };
  if (egreso && dateKey(egreso) < dateKey(start)) return { status: 'outside', days: 0, reason: 'Salió antes de esta quincena' };

  // Posición (1..15) de una fecha dentro de la quincena comercial.
  const position = (date: CalendarDate) =>
    dateKey(date) >= dateKey(end) ? fortnightDays : Math.min(date.day, commercialMonthDays) - startDay + 1;

  const joinsInside = !!ingreso && dateKey(ingreso) > dateKey(start);
  const from = ingreso && joinsInside ? position(ingreso) : 1;
  const to = egreso && dateKey(egreso) < dateKey(end) ? position(egreso) : fortnightDays;
  const days = to - from + 1;

  if (days <= 0) return { status: 'outside', days: 0, reason: 'Sin días laborables en esta quincena' };
  if (days === fortnightDays) return { status: 'full', days, reason: '' };
  return { status: 'partial', days, reason: joinsInside ? 'Ingresó dentro de la quincena' : 'Salió dentro de la quincena' };
}
