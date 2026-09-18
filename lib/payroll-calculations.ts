export const PAYROLL_CONSTANTS = {
  inssCeilingMonthly: 88005.78,
  employeeInssRate: 0.07,
  employerInssRate: 0.215,
  inatecRate: 0.02,
} as const;

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
}

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
  return money((salarioMensual / 30) * diasLaborados);
}

export function calcularVacaciones(salarioMensual: number, diasVacaciones: number) {
  return money((salarioMensual / 30) * diasVacaciones);
}

export function calcularHorasExtra(salarioMensual: number, horasExtra: number) {
  return money((salarioMensual / 30 / 8) * horasExtra * 2);
}

export function calcularIR(baseImponibleQuincenal: number) {
  const ingresoAnualizado = baseImponibleQuincenal * 12;
  if (ingresoAnualizado < 100000) return 0;
  if (ingresoAnualizado < 200000) return money(((ingresoAnualizado - 100000) * 0.15) / 12);
  if (ingresoAnualizado < 350000) return money(((ingresoAnualizado - 200000) * 0.2 + 15000) / 12);
  if (ingresoAnualizado < 500000) return money(((ingresoAnualizado - 350000) * 0.25 + 45000) / 12);
  return money(((ingresoAnualizado - 500000) * 0.3 + 82500) / 12);
}

export function calcularINSSLaboral(baseQuincenal: number, ceiling = PAYROLL_CONSTANTS.inssCeilingMonthly) {
  const monthlyBase = baseQuincenal * 2;
  return money(Math.min(monthlyBase, ceiling) / 2 * PAYROLL_CONSTANTS.employeeInssRate);
}

export function calcularINSSPatronal(baseQuincenal: number, ceiling = PAYROLL_CONSTANTS.inssCeilingMonthly) {
  const monthlyBase = baseQuincenal * 2;
  return money(Math.min(monthlyBase, ceiling) / 2 * PAYROLL_CONSTANTS.employerInssRate);
}

export function calcularINATEC(baseQuincenal: number) {
  return money(baseQuincenal * PAYROLL_CONSTANTS.inatecRate);
}

export function calcularProvisiones(salarioMensual: number) {
  const provision = money((salarioMensual / 30) * 1.25);
  return { provisionAguinaldo: provision, provisionIndemnizacion: provision, provisionVacaciones: provision };
}

export function calcularTotales(inputs: PayrollInputs, ceiling = PAYROLL_CONSTANTS.inssCeilingMonthly): PayrollCalculation {
  const salarioQuincenal = money(inputs.salarioMensual / 2);
  const basico = calcularBasico(inputs.salarioMensual, inputs.diasLaborados);
  const vacaciones = calcularVacaciones(inputs.salarioMensual, inputs.diasVacaciones);
  const horasExtraMonto = calcularHorasExtra(inputs.salarioMensual, inputs.horasExtra);
  const totalDevengado = money(basico + vacaciones + horasExtraMonto + inputs.otrosIngresos);
  const inssMensualBase = money((basico + totalDevengado) * PAYROLL_CONSTANTS.employeeInssRate);
  const baseImponible = money(basico + totalDevengado - inssMensualBase);
  const irLaboral = calcularIR(baseImponible);
  const baseParaCargas = money(basico + vacaciones + horasExtraMonto + inputs.otrosIngresos);
  const inssLaboral = calcularINSSLaboral(baseParaCargas, ceiling);
  const otrasDeducciones = money(inputs.consumo + inputs.prestamo + inputs.greceComida + inputs.otros);
  const totalDeducciones = money(inssLaboral + irLaboral + otrasDeducciones);
  const provisiones = calcularProvisiones(inputs.salarioMensual);
  return {
    salarioQuincenal, basico, vacaciones, horasExtraMonto, totalDevengado, inssMensualBase,
    baseImponible, irLaboral, inssLaboral, otrasDeducciones,
    totalDeducciones, netoPagar: money(totalDevengado - totalDeducciones),
    inssPatronal: calcularINSSPatronal(baseParaCargas, ceiling),
    inatec: calcularINATEC(baseParaCargas), ...provisiones,
  };
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 }).format(value || 0);

export function getPayrollPeriod(year: number, month: number, fortnight: 'first' | 'second') {
  const start = new Date(year, month - 1, fortnight === 'first' ? 1 : 16);
  const end = new Date(year, month, fortnight === 'first' ? 15 : 0);
  return { start, end };
}

export function getProratedDays(dateValue: string, start: Date, end: Date, fallback = 15) {
  if (!dateValue) return fallback;
  const date = new Date(`${dateValue}T00:00:00`);
  if (date <= start) return fallback;
  if (date > end) return 0;
  return Math.max(0, Math.floor((end.getTime() - date.getTime()) / 86400000) + 1);
}
