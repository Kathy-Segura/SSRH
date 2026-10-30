// ─────────────────────────────────────────────────────────────────────────────
// Totales y agrupación por restaurante. Única fuente de verdad para:
//   · el pie de la tabla masiva,
//   · el tab "Total por pagar" (totales y desglose por restaurante),
//   · el reporte impreso.
// Se suma en centavos enteros: el total siempre coincide con la suma de lo que
// se ve fila por fila (sin arrastrar errores de punto flotante).
// ─────────────────────────────────────────────────────────────────────────────
import type { PayrollCalculation, PayrollInputs } from './payroll-calculations';

export interface AggregatableRow {
  restaurante?: string | null;
  inputs: PayrollInputs;
  calculation: PayrollCalculation;
}

export const NO_RESTAURANT_KEY = 'SIN RESTAURANTE';

/**
 * Clave para agrupar/comparar restaurantes. "Barrio Café", "BARRIO CAFE", " barrio  café. "
 * y "Barrio-Café" son el mismo restaurante: se ignoran mayúsculas, tildes, signos y espacios repetidos.
 */
export const restaurantKey = (name?: string | null): string =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim() || NO_RESTAURANT_KEY;

export interface PayrollTotals {
  employees: number;
  /** Suma de los salarios mensuales (base) de los empleados incluidos. */
  salarioBase: number;
  totalDevengado: number;
  inssLaboral: number;
  irLaboral: number;
  consumo: number;
  prestamo: number;
  greceComida: number;
  otros: number;
  /** consumo + prestamo + greceComida + otros */
  otrasDeducciones: number;
  totalDeducciones: number;
  netoPagar: number;
  inssPatronal: number;
  inatec: number;
  provisionAguinaldo: number;
  provisionIndemnizacion: number;
  provisionVacaciones: number;
  /** inssPatronal + inatec */
  cargasPatronales: number;
  /** aguinaldo + indemnización + vacaciones */
  provisiones: number;
  /** devengado + cargas patronales + provisiones */
  costoEmpresa: number;
  /** true si devengado − deducciones = neto y cada tipo de deducción suma el total. */
  reconciles: boolean;
}

type SummedKey =
  | 'salarioBase' | 'totalDevengado' | 'inssLaboral' | 'irLaboral' | 'consumo' | 'prestamo' | 'greceComida' | 'otros'
  | 'otrasDeducciones' | 'totalDeducciones' | 'netoPagar' | 'inssPatronal' | 'inatec'
  | 'provisionAguinaldo' | 'provisionIndemnizacion' | 'provisionVacaciones';

const SOURCES: Record<SummedKey, (row: AggregatableRow) => number> = {
  salarioBase: (r) => r.inputs.salarioMensual,
  totalDevengado: (r) => r.calculation.totalDevengado,
  inssLaboral: (r) => r.calculation.inssLaboral,
  irLaboral: (r) => r.calculation.irLaboral,
  consumo: (r) => r.inputs.consumo,
  prestamo: (r) => r.inputs.prestamo,
  greceComida: () => 0, // GRECE Comida fue eliminada de la planilla: no suma aunque la hoja tenga valores antiguos
  otros: (r) => r.inputs.otros,
  otrasDeducciones: (r) => r.calculation.otrasDeducciones,
  totalDeducciones: (r) => r.calculation.totalDeducciones,
  netoPagar: (r) => r.calculation.netoPagar,
  inssPatronal: (r) => r.calculation.inssPatronal,
  inatec: (r) => r.calculation.inatec,
  provisionAguinaldo: (r) => r.calculation.provisionAguinaldo,
  provisionIndemnizacion: (r) => r.calculation.provisionIndemnizacion,
  provisionVacaciones: (r) => r.calculation.provisionVacaciones,
};
const SUMMED_KEYS = Object.keys(SOURCES) as SummedKey[];

const toCents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100);

export function aggregateRows(rows: readonly AggregatableRow[]): PayrollTotals {
  const cents = Object.fromEntries(SUMMED_KEYS.map((key) => [key, 0])) as Record<SummedKey, number>;
  for (const row of rows) for (const key of SUMMED_KEYS) cents[key] += toCents(SOURCES[key](row));

  const otrasParts = cents.consumo + cents.prestamo + cents.greceComida + cents.otros;
  const deductionParts = cents.inssLaboral + cents.irLaboral + otrasParts;
  const cargas = cents.inssPatronal + cents.inatec;
  const provisiones = cents.provisionAguinaldo + cents.provisionIndemnizacion + cents.provisionVacaciones;

  const reconciles =
    cents.otrasDeducciones === otrasParts &&
    cents.totalDeducciones === deductionParts &&
    cents.totalDevengado - cents.totalDeducciones === cents.netoPagar;

  const money = Object.fromEntries(SUMMED_KEYS.map((key) => [key, cents[key] / 100])) as Record<SummedKey, number>;
  return {
    employees: rows.length,
    ...money,
    cargasPatronales: cargas / 100,
    provisiones: provisiones / 100,
    costoEmpresa: (cents.totalDevengado + cargas + provisiones) / 100,
    reconciles,
  };
}

export interface RestaurantGroup<T extends AggregatableRow = AggregatableRow> {
  key: string;
  /** Nombre a mostrar: el del catálogo si coincide; si no, la grafía más usada. */
  label: string;
  /** false si el nombre de los empleados no coincide con ningún restaurante del catálogo. */
  inCatalog: boolean;
  /** Grafías distintas que se unificaron en este grupo (para diagnosticar datos sucios). */
  variants: string[];
  rows: T[];
  totals: PayrollTotals;
}

/**
 * Agrupa por restaurante. Un restaurante aparece UNA sola vez, con todos sus empleados, aunque en las fichas
 * esté escrito de varias formas. Orden: el del catálogo, luego los que no están en él, "Sin restaurante" al final.
 */
export function groupByRestaurant<T extends AggregatableRow>(rows: readonly T[], catalog: readonly string[] = []): RestaurantGroup<T>[] {
  const catalogEntries = new Map<string, { label: string; order: number }>();
  catalog.forEach((name) => {
    const key = restaurantKey(name);
    if (key === 'TODOS' || key === NO_RESTAURANT_KEY || catalogEntries.has(key)) return;
    catalogEntries.set(key, { label: String(name).trim(), order: catalogEntries.size });
  });

  const buckets = new Map<string, { rows: T[]; spellings: Map<string, number> }>();
  for (const row of rows) {
    const key = restaurantKey(row.restaurante);
    const bucket = buckets.get(key) ?? { rows: [], spellings: new Map<string, number>() };
    bucket.rows.push(row);
    const spelling = String(row.restaurante ?? '').trim();
    if (spelling) bucket.spellings.set(spelling, (bucket.spellings.get(spelling) ?? 0) + 1);
    buckets.set(key, bucket);
  }

  const groups = [...buckets].map(([key, bucket]): RestaurantGroup<T> => {
    const known = catalogEntries.get(key);
    const mostUsed = [...bucket.spellings].sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      key,
      label: known?.label ?? mostUsed ?? 'Sin restaurante',
      inCatalog: catalogEntries.size === 0 ? key !== NO_RESTAURANT_KEY : !!known,
      variants: [...bucket.spellings.keys()],
      rows: bucket.rows,
      totals: aggregateRows(bucket.rows),
    };
  });

  const rank = (group: RestaurantGroup<T>) =>
    group.key === NO_RESTAURANT_KEY ? Number.POSITIVE_INFINITY : (catalogEntries.get(group.key)?.order ?? 10_000);
  return groups.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, 'es'));
}
