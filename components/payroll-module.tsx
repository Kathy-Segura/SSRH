'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Employee } from '@/types/employee';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronLeft, ChevronRight, Eraser, FileText, Printer, RefreshCw, Save, Search, SlidersHorizontal, Users, Wallet } from 'lucide-react';
import {
  calcularTotales,
  formatCurrency,
  getCurrentFortnight,
  getEmployeeDaysInPeriod,
  getPayrollPeriod,
  getPeriodoKey,
  parseCalendarDate,
  PAYROLL_CONSTANTS,
  PAYROLL_INPUT_FIELDS,
  PAYROLL_YEAR_WINDOW,
  type Fortnight,
  type PayrollCalculation,
  type PayrollInputs,
  type PeriodEligibility,
} from '@/lib/payroll-calculations';
import { parseMoney } from '@/lib/money';
import {
  FIELD_LABELS,
  inputsToForm,
  normalizeCedula,
  parseFormValues,
  sameInputs,
  validatePayrollInputs,
  type DeduccionApiItem,
  type DeduccionProblem,
  type FieldErrors,
  type FormValues,
  type PayrollField,
} from '@/lib/payroll-validation';

// Solo se usa si falla la carga desde /api/restaurantes (mismo patrón que
// employee-form-modal.tsx / employee-modal.tsx).
const RESTAURANTES_FALLBACK = ['Todos'];
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// Campos del formulario flotante, en el orden en que se muestran.
const INCOME_FIELDS: readonly { field: PayrollField; prefix?: string }[] = [
  { field: 'salarioMensual', prefix: 'C$' },
  { field: 'diasLaborados' },
  { field: 'diasVacaciones' },
  { field: 'horasExtra' },
  { field: 'otrosIngresos', prefix: 'C$' },
];
const DEDUCTION_FIELDS: readonly { field: PayrollField; prefix?: string }[] = [
  { field: 'consumo', prefix: 'C$' },
  { field: 'prestamo', prefix: 'C$' },
  { field: 'greceComida', prefix: 'C$' },
  { field: 'otros', prefix: 'C$' },
];
// "Limpiar" deja en cero extras y deducciones; salario y días laborados no se tocan.
const CLEARABLE_FIELDS: readonly PayrollField[] = [
  'diasVacaciones', 'horasExtra', 'otrosIngresos', 'consumo', 'prestamo', 'greceComida', 'otros',
];

const normalizeText = (value: string) => value.trim().toUpperCase();

type SavedRecord = { inputs: PayrollInputs; version: string; nombre?: string | null };
type SheetState = {
  periodKey: string;
  status: 'loading' | 'ready' | 'error';
  byCedula: Record<string, SavedRecord>;
  warnings: string[];
  message: string;
};
type PayrollRow = Employee & {
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
type Notice = { kind: 'success' | 'error' | 'warning'; text: string; canReload?: boolean } | null;
type SaveTarget = { cedulaKey: string; inputs: PayrollInputs; version: string | null; nombre: string };
type SaveOutcome = { ok: true } | { ok: false; message: string };

// ── Borradores: cambios sin guardar que se conservan (por periodo) en este navegador hasta guardarse ──
type Draft = { inputs: PayrollInputs; base: PayrollInputs };
type DraftState = { periodKey: string; items: Record<string, Draft> };
const EMPTY_DRAFTS: Record<string, Draft> = {};
const draftsStorageKey = (periodKey: string) => `payroll-drafts:v1:${periodKey}`;

function loadDrafts(periodKey: string): Record<string, Draft> {
  try {
    const raw = window.localStorage.getItem(draftsStorageKey(periodKey));
    const parsed = raw ? JSON.parse(raw) : {};
    const items: Record<string, Draft> = {};
    Object.entries(parsed as Record<string, Draft>).forEach(([key, value]) => {
      const valid = (inputs: unknown) => !!inputs && PAYROLL_INPUT_FIELDS.every((field) => Number.isFinite((inputs as PayrollInputs)[field]));
      if (valid(value?.inputs) && valid(value?.base)) items[key] = value;
    });
    return items;
  } catch { return {}; }
}
function storeDrafts(periodKey: string, items: Record<string, Draft>) {
  try {
    if (Object.keys(items).length === 0) window.localStorage.removeItem(draftsStorageKey(periodKey));
    else window.localStorage.setItem(draftsStorageKey(periodKey), JSON.stringify(items));
  } catch { /* almacenamiento no disponible: los borradores viven solo mientras la pestaña esté abierta */ }
}

// Clave para agrupar/comparar restaurantes: "Barrio Café", "BARRIO CAFE " y "Barrio Café" (con la é escrita
// de otra forma) son el mismo restaurante. Antes se agrupaba por el texto exacto y salían duplicados.
const restaurantKey = (name: string | undefined) =>
  String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase() || 'SIN RESTAURANTE';

/** Periodo vigente hoy en Nicaragua (UTC-6), mismo criterio que el servidor. */
function currentPeriodKeyNicaragua(): string {
  const local = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return getPeriodoKey(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate() <= 15 ? 'first' : 'second');
}

type DraftField = PayrollField | 'aplicaIR';
const fieldValue = (inputs: PayrollInputs, field: DraftField) => (field === 'aplicaIR' ? !!inputs.aplicaIR : inputs[field]);
const changedFields = (a: PayrollInputs, b: PayrollInputs): DraftField[] => {
  const fields: DraftField[] = [...PAYROLL_INPUT_FIELDS, 'aplicaIR'];
  return fields.filter((field) => fieldValue(a, field) !== fieldValue(b, field));
};

/**
 * Combina un borrador con la base actual (hoja o ficha), campo por campo:
 * - si la base no cambió desde el borrador → el borrador tal cual;
 * - si cambió solo en campos que el usuario no tocó (p. ej. el salario, actualizado desde Empleados) → se aplican
 *   esos cambios sobre el borrador, conservando lo editado;
 * - si cambió un campo que el usuario también editó (a otro valor) → conflicto.
 */
function reconcileDraft(draft: Draft, base: PayrollInputs): { inputs: PayrollInputs; conflict: boolean } {
  const theirs = changedFields(draft.base, base);
  if (theirs.length === 0) return { inputs: draft.inputs, conflict: false };
  const mine = changedFields(draft.base, draft.inputs);
  if (mine.some((field) => theirs.includes(field) && fieldValue(draft.inputs, field) !== fieldValue(base, field))) return { inputs: draft.inputs, conflict: true };
  const merged: PayrollInputs = { ...base };
  mine.forEach((field) => {
    if (field === 'aplicaIR') merged.aplicaIR = !!draft.inputs.aplicaIR;
    else merged[field] = draft.inputs[field];
  });
  return { inputs: merged, conflict: false };
}

const isBlocked = (row: PayrollRow) => row.issues.length > 0 || Object.keys(row.fieldErrors).length > 0;
const toTarget = (row: PayrollRow): SaveTarget => ({ cedulaKey: row.cedulaKey, inputs: row.inputs, version: row.version, nombre: row.nombreCompleto });

export function PayrollModule({ employees, onEmployeesChanged }: {
  employees: Employee[];
  /** Opcional: se llama cuando guardar una deducción actualizó el salario en la ficha, para que la página recargue empleados. */
  onEmployeesChanged?: () => void;
}) {
  const [mode, setMode] = useState<'table' | 'totals'>('table');
  const [restaurant, setRestaurant] = useState('Todos');
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [fortnight, setFortnight] = useState<Fortnight>(() => getCurrentFortnight());
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<Notice>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [draftState, setDraftState] = useState<DraftState>({ periodKey: '', items: {} });
  // Salarios de ficha ya actualizados desde esta pantalla, mientras la página no recargue la lista de empleados.
  const [fichaOverrides, setFichaOverrides] = useState<Record<string, number>>({});
  const previousSalaries = useRef<Map<string, string> | null>(null);
  const skipEmployeeSync = useRef(false);

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const periodKey = getPeriodoKey(yearNumber, monthNumber, fortnight);
  const period = useMemo(() => getPayrollPeriod(yearNumber, monthNumber, fortnight), [yearNumber, monthNumber, fortnight]);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const count = PAYROLL_YEAR_WINDOW.back + PAYROLL_YEAR_WINDOW.forward + 1;
    return Array.from({ length: count }, (_, index) => String(current - PAYROLL_YEAR_WINDOW.back + index));
  }, []);

  // ── Restaurantes: catálogo real desde /api/restaurantes (hoja RESTAURANTES) ──
  const [restaurantes, setRestaurantes] = useState<string[]>(RESTAURANTES_FALLBACK);
  useEffect(() => {
    let cancelado = false;
    fetch('/api/restaurantes')
      .then((res) => res.json())
      .then((data) => {
        const lista: string[] = Array.isArray(data?.restaurantes) ? data.restaurantes : [];
        if (!cancelado && lista.length > 0) setRestaurantes(['Todos', ...lista]);
      })
      .catch((err) => console.error('Error al cargar restaurantes:', err));
    return () => { cancelado = true; };
  }, []);

  // ── Deducciones guardadas del periodo (hoja DEDUCCIONES) ──
  // El estado lleva su periodKey: si el periodo cambia, lo cargado del anterior se ignora
  // y no se puede guardar hasta que llegue la respuesta del nuevo periodo.
  const [sheet, setSheet] = useState<SheetState>({ periodKey: '', status: 'loading', byCedula: {}, warnings: [], message: '' });
  const sheetReady = sheet.periodKey === periodKey && sheet.status === 'ready';

  useEffect(() => {
    const controller = new AbortController();
    setSheet({ periodKey, status: 'loading', byCedula: {}, warnings: [], message: '' });
    fetch(`/api/deducciones?year=${year}&month=${month}&fortnight=${fortnight}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar las deducciones del periodo');
        return data as { deducciones?: DeduccionApiItem[]; advertencias?: DeduccionProblem[] };
      })
      .then((data) => {
        const byCedula: Record<string, SavedRecord> = {};
        (data.deducciones ?? []).forEach((item) => {
          byCedula[normalizeCedula(item.cedula)] = { inputs: item.inputs, version: item.version, nombre: (item as { nombre?: string | null }).nombre ?? null };
        });
        const warnings = (data.advertencias ?? []).map((item) => `Fila ${item.fila} de la hoja: ${item.motivo}`);
        setSheet({ periodKey, status: 'ready', byCedula, warnings, message: '' });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSheet({ periodKey, status: 'error', byCedula: {}, warnings: [], message: err instanceof Error ? err.message : 'Error de red' });
      });
    return () => controller.abort();
  }, [periodKey, year, month, fortnight, reloadToken]);

  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // ── Borradores: se cargan al cambiar de periodo y se guardan en este navegador con cada cambio ──
  useEffect(() => { setDraftState({ periodKey, items: loadDrafts(periodKey) }); }, [periodKey]);
  useEffect(() => { if (draftState.periodKey) storeDrafts(draftState.periodKey, draftState.items); }, [draftState]);
  const drafts = draftState.periodKey === periodKey ? draftState.items : EMPTY_DRAFTS;

  // ── Si cambia el salario de alguna ficha (editado en el módulo Empleados), recargar el periodo ──
  // La API ya actualizó las filas guardadas de la hoja DEDUCCIONES; recargar trae esos salarios y sus nuevas versiones.
  useEffect(() => {
    const current = new Map(employees.map((employee) => [normalizeCedula(employee.cedula), String(employee.salario ?? '')] as const));
    const previous = previousSalaries.current;
    previousSalaries.current = current;
    setFichaOverrides({});
    if (!previous) return;
    if (skipEmployeeSync.current) { skipEmployeeSync.current = false; return; }
    const changed = [...current].filter(([key, value]) => previous.has(key) && previous.get(key) !== value);
    if (changed.length > 0) {
      setNotice({ kind: 'success', text: `Se actualizó el salario de ${changed.length} empleado(s) desde Empleados; se recargó el periodo.` });
      setReloadToken((token) => token + 1);
    }
  }, [employees]);

  // ── Empleados que corresponde pagar en el periodo ──
  const eligible = useMemo(() => {
    const cedulaCount = new Map<string, number>();
    employees.forEach((employee) => {
      const key = normalizeCedula(employee.cedula);
      cedulaCount.set(key, (cedulaCount.get(key) ?? 0) + 1);
    });

    return employees.flatMap((employee) => {
      const ingresoRaw = String(employee.fechaIngreso ?? '').trim();
      const egresoRaw = String(employee.fechaEgreso || employee.fechaRetiro || '').trim();
      const ingreso = parseCalendarDate(ingresoRaw);
      const egreso = parseCalendarDate(egresoRaw);

      // Un empleado inactivo no aparece en Deducciones (ni en la tabla, ni en totales, ni en prorrateados).
      if (normalizeText(employee.estado || 'activo') === 'INACTIVO') return [];
      const eligibility = getEmployeeDaysInPeriod(ingreso, egreso, yearNumber, monthNumber, fortnight);
      if (eligibility.status === 'outside') return [];

      const issues: string[] = [];
      const cedulaKey = normalizeCedula(employee.cedula);
      if (!cedulaKey) issues.push('La ficha no tiene cédula');
      else if ((cedulaCount.get(cedulaKey) ?? 0) > 1) issues.push('Cédula repetida en las fichas de empleados');
      if (ingresoRaw && !ingreso) issues.push('Fecha de ingreso inválida en la ficha');
      if (egresoRaw && !egreso) issues.push('Fecha de egreso/retiro inválida en la ficha');
      return [{ employee, eligibility, issues, cedulaKey }];
    });
  }, [employees, yearNumber, monthNumber, fortnight]);

  const allRows: PayrollRow[] = useMemo(() => eligible.map(({ employee, eligibility, issues, cedulaKey }) => {
    const record = sheetReady ? sheet.byCedula[cedulaKey] : undefined;
    // parseMoney tolera "C$ 12,000.00"; Number("C$ 12,000.00") daba NaN y el salario quedaba en 0.
    const fichaSalary = parseMoney(fichaOverrides[cedulaKey] ?? employee.salario);
    const defaults: PayrollInputs = {
      salarioMensual: fichaSalary !== null && fichaSalary > 0 ? fichaSalary : 0,
      diasLaborados: eligibility.days,
      diasVacaciones: 0, horasExtra: 0, otrosIngresos: 0, consumo: 0, prestamo: 0, greceComida: 0, otros: 0,
      aplicaIR: false,
    };
    const baseInputs = record?.inputs ?? defaults;
    let inputs = baseInputs;
    let hasDraft = false;
    let conflict = false;
    const draft = sheetReady ? drafts[cedulaKey] : undefined;
    if (draft) {
      const reconciled = reconcileDraft(draft, baseInputs);
      if (changedFields(reconciled.inputs, baseInputs).length > 0) { inputs = reconciled.inputs; hasDraft = true; conflict = reconciled.conflict; }
    }
    const warnings: string[] = [];
    if (record) {
      // Las vacaciones pagadas no se comparan con los días de la quincena (pueden liquidarse aparte).
      if (record.inputs.diasLaborados !== eligibility.days && record.inputs.diasVacaciones === 0) {
        warnings.push(`Días laborados guardados (${record.inputs.diasLaborados}) distintos a los que corresponden por fechas (${eligibility.days})`);
      }
      if (defaults.salarioMensual > 0 && record.inputs.salarioMensual !== defaults.salarioMensual) {
        warnings.push(`Salario guardado distinto al de la ficha (${formatCurrency(defaults.salarioMensual)})`);
      }
    }
    if (conflict) warnings.push('El borrador choca con cambios más recientes en la hoja o la ficha. Revíselo o descártelo.');
    return {
      ...employee,
      cedulaKey,
      inputs,
      baseInputs,
      calculation: calcularTotales(inputs),
      eligibility,
      status: conflict ? 'conflict' : hasDraft ? 'draft' : record ? 'saved' : 'pending',
      version: record?.version ?? null,
      issues,
      warnings,
      fieldErrors: validatePayrollInputs(inputs, eligibility.days),
    };
  }), [eligible, sheet, sheetReady, drafts, fichaOverrides]);

  const rows = useMemo(() => allRows.filter((row) => {
    const matchesRestaurant = restaurant === 'Todos' || restaurantKey(row.restaurante) === restaurantKey(restaurant);
    const text = query.trim().toLowerCase();
    const matchesQuery = !text || row.nombreCompleto.toLowerCase().includes(text) || row.cedula.toLowerCase().includes(text);
    return matchesRestaurant && matchesQuery;
  }), [allRows, restaurant, query]);

  const proratedCount = rows.filter((row) => row.eligibility.status === 'partial').length;
  const blockedCount = rows.filter(isBlocked).length;
  const isUnsaved = (row: PayrollRow) => row.status === 'pending' || row.status === 'draft';
  const unsavedCount = rows.filter(isUnsaved).length;
  const draftCount = allRows.filter((row) => row.status === 'draft' || row.status === 'conflict').length;
  const conflictCount = allRows.filter((row) => row.status === 'conflict').length;
  // Resumen por restaurante de TODA la planilla del periodo (sin importar el filtro actual).
  const restaurantSummary = (() => {
    const groups = new Map<string, { labels: Map<string, number>; total: number; saved: number; unsaved: number; conflicts: number }>();
    allRows.forEach((row) => {
      const label = (row.restaurante ?? '').trim() || 'Sin restaurante';
      const key = restaurantKey(label);
      const group = groups.get(key) ?? { labels: new Map<string, number>(), total: 0, saved: 0, unsaved: 0, conflicts: 0 };
      group.labels.set(label, (group.labels.get(label) ?? 0) + 1);
      group.total += 1;
      if (row.status === 'saved') group.saved += 1;
      else if (row.status === 'conflict') group.conflicts += 1;
      else group.unsaved += 1;
      groups.set(key, group);
    });
    return [...groups.entries()]
      .map(([key, group]) => ({ key, label: [...group.labels].sort((x, y) => y[1] - x[1])[0][0], total: group.total, saved: group.saved, unsaved: group.unsaved, conflicts: group.conflicts }))
      .sort((x, y) => x.label.localeCompare(y.label));
  })();
  const restaurantsWithPending = restaurantSummary.filter((group) => group.unsaved + group.conflicts > 0);

  // Registros guardados en la hoja que no entran en la planilla del periodo, con el motivo.
  const orphans = sheetReady
    ? Object.entries(sheet.byCedula)
        .filter(([cedula]) => !allRows.some((row) => row.cedulaKey === cedula))
        .map(([cedula, record]) => {
          const employee = employees.find((item) => normalizeCedula(item.cedula) === cedula);
          const reason = !employee ? 'La cédula no existe en el módulo Empleados'
            : normalizeText(employee.estado || 'activo') === 'INACTIVO' ? 'El empleado está inactivo'
            : 'Sus fechas de ingreso/egreso lo dejan fuera de esta quincena';
          return { cedula, nombre: employee?.nombreCompleto || record.nombre || cedula, reason };
        })
    : [];
  const orphanCount = orphans.length;
  const selected = allRows.find((row) => row.id === selectedId);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedRows = rows.slice(pageStart, pageStart + pageSize);
  const rangeFrom = rows.length === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageStart + pageSize, rows.length);

  // Al cambiar filtros o tamaño de página, volver a la primera página
  useEffect(() => { setPage(1); }, [restaurant, query, month, year, fortnight, pageSize]);

  const totals = rows.reduce((acc, row) => ({
    totalDevengado: acc.totalDevengado + row.calculation.totalDevengado,
    inssLaboral: acc.inssLaboral + row.calculation.inssLaboral,
    irLaboral: acc.irLaboral + row.calculation.irLaboral,
    otrasDeducciones: acc.otrasDeducciones + row.calculation.otrasDeducciones,
    totalDeducciones: acc.totalDeducciones + row.calculation.totalDeducciones,
    netoPagar: acc.netoPagar + row.calculation.netoPagar,
    inssPatronal: acc.inssPatronal + row.calculation.inssPatronal,
    inatec: acc.inatec + row.calculation.inatec,
    provisionAguinaldo: acc.provisionAguinaldo + row.calculation.provisionAguinaldo,
    provisionIndemnizacion: acc.provisionIndemnizacion + row.calculation.provisionIndemnizacion,
    provisionVacaciones: acc.provisionVacaciones + row.calculation.provisionVacaciones,
  }), { totalDevengado: 0, inssLaboral: 0, irLaboral: 0, otrasDeducciones: 0, totalDeducciones: 0, netoPagar: 0, inssPatronal: 0, inatec: 0, provisionAguinaldo: 0, provisionIndemnizacion: 0, provisionVacaciones: 0 });

  const reloadPeriod = () => { setNotice(null); setReloadToken((token) => token + 1); };

  // ── Guardado: solo se envían las filas indicadas; la API hace upsert por periodo + cédula ──
  const persistRows = async (targets: SaveTarget[]): Promise<SaveOutcome> => {
    if (!sheetReady) return { ok: false, message: 'Espere a que termine de cargar el periodo antes de guardar.' };
    if (isSaving) return { ok: false, message: 'Ya hay un guardado en curso.' };

    // Cambiar el salario en la quincena vigente (o posterior) también actualiza la ficha del empleado y sus
    // demás quincenas guardadas desde la vigente en adelante: se pide confirmación antes de propagarlo.
    if (periodKey >= currentPeriodKeyNicaragua()) {
      const salaryChanges = targets.flatMap((target) => {
        const row = allRows.find((item) => item.cedulaKey === target.cedulaKey);
        return row && target.inputs.salarioMensual > 0 && target.inputs.salarioMensual !== row.baseInputs.salarioMensual
          ? [`• ${row.nombreCompleto}: ${formatCurrency(row.baseInputs.salarioMensual)} → ${formatCurrency(target.inputs.salarioMensual)}`]
          : [];
      });
      if (salaryChanges.length > 0) {
        const list = salaryChanges.slice(0, 8).join('\n') + (salaryChanges.length > 8 ? `\n… y ${salaryChanges.length - 8} más` : '');
        const accepted = window.confirm(
          `Cambia el salario de ${salaryChanges.length} empleado(s):\n${list}\n\nSe actualizará también en su ficha de Empleados y en las quincenas vigentes o siguientes ya guardadas. Las quincenas anteriores no cambian. ¿Continuar?`
        );
        if (!accepted) return { ok: false, message: 'Guardado cancelado.' };
      }
    }

    const savedPeriodKey = periodKey;
    setIsSaving(true);
    try {
      const response = await fetch('/api/deducciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: yearNumber, month: monthNumber, fortnight,
          filas: targets.map((target) => ({ cedula: target.cedulaKey, inputs: target.inputs, version: target.version, nombre: target.nombre })),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        const message = data.error || 'Los registros cambiaron en la hoja.';
        setNotice({ kind: 'error', text: `${message} Cédulas: ${(data.conflictos ?? []).join(', ')}`, canReload: true });
        return { ok: false, message };
      }
      if (!response.ok) {
        const detalles = Array.isArray(data.detalles)
          ? data.detalles.slice(0, 3).map((item: { cedula: string; errores: FieldErrors }) => `${item.cedula}: ${Object.values(item.errores).join(', ')}`).join(' · ')
          : '';
        const message = [data.error || 'No se pudo guardar', detalles].filter(Boolean).join(' — ');
        setNotice({ kind: 'error', text: message });
        return { ok: false, message };
      }

      const versiones: Record<string, string> = data.versiones ?? {};
      setSheet((current) => {
        if (current.periodKey !== savedPeriodKey) return current;
        const byCedula = { ...current.byCedula };
        targets.forEach((target) => {
          byCedula[target.cedulaKey] = { inputs: target.inputs, version: versiones[target.cedulaKey] };
        });
        return { ...current, byCedula };
      });
      // Lo guardado deja de ser borrador (lo no guardado, por ejemplo tras un error, se conserva).
      setDraftState((current) => {
        if (current.periodKey !== savedPeriodKey) return current;
        const items = { ...current.items };
        targets.forEach((target) => { delete items[target.cedulaKey]; });
        return { ...current, items };
      });
      // Si se cambió el salario, la API ya lo actualizó también en la ficha del empleado.
      const fichas: { cedula: string; salario: number }[] = Array.isArray(data.fichas) ? data.fichas : [];
      const avisos: string[] = Array.isArray(data.avisos) ? data.avisos : [];
      if (fichas.length > 0) {
        setFichaOverrides((current) => ({ ...current, ...Object.fromEntries(fichas.map((ficha) => [ficha.cedula, ficha.salario])) }));
        if (onEmployeesChanged) { skipEmployeeSync.current = true; onEmployeesChanged(); }
        // Aviso para cualquier otra parte de la app (p. ej. la lista del módulo Empleados) que quiera recargarse.
        window.dispatchEvent(new CustomEvent('empleados:actualizados', { detail: { cedulas: fichas.map((ficha) => ficha.cedula) } }));
      }
      // En una quincena anterior a la vigente el salario queda solo en esa quincena y NO se aplica a la ficha.
      const salaryOnlyInThisPeriod = periodKey < currentPeriodKeyNicaragua()
        ? targets.filter((target) => {
            const row = allRows.find((item) => item.cedulaKey === target.cedulaKey);
            return row && target.inputs.salarioMensual > 0 && target.inputs.salarioMensual !== row.baseInputs.salarioMensual;
          }).length
        : 0;
      const extra = [
        fichas.length > 0 ? `Salario actualizado también en la ficha de ${fichas.length} empleado(s).` : '',
        salaryOnlyInThisPeriod > 0 ? `El salario de ${salaryOnlyInThisPeriod} empleado(s) cambió solo en esta quincena: es anterior a la vigente, por eso no se aplicó a la ficha en Empleados.` : '',
        ...avisos,
      ].filter(Boolean).join(' ');
      setNotice({ kind: avisos.length > 0 ? 'warning' : 'success', text: `Se guardaron ${targets.length} registro(s) en la hoja DEDUCCIONES (${savedPeriodKey}). ${extra}`.trim() });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red al guardar';
      setNotice({ kind: 'error', text: message });
      return { ok: false, message };
    } finally {
      setIsSaving(false);
    }
  };

  // Guardado masivo de las filas indicadas (pendientes o en borrador). Sin conflictos ni errores de validación.
  const saveRows = async (list: PayrollRow[], scope: string) => {
    const unsaved = list.filter(isUnsaved);
    const skippedConflicts = list.filter((row) => row.status === 'conflict').length;
    if (unsaved.length === 0) {
      setNotice({ kind: skippedConflicts > 0 ? 'error' : 'success', text: skippedConflicts > 0
        ? `${skippedConflicts} registro(s) con conflicto no se guardan en bloque: ábralos con "Ver" y resuélvalos.`
        : `No hay cambios sin guardar en ${scope}.` });
      return;
    }
    const blocked = unsaved.filter(isBlocked);
    if (blocked.length > 0) {
      const names = blocked.slice(0, 3).map((row) => row.nombreCompleto).join(', ');
      setNotice({ kind: 'error', text: `No se guardó nada: corrija ${blocked.length} empleado(s) con errores (${names}${blocked.length > 3 ? '…' : ''}). Ábralos con "Ver".` });
      return;
    }
    const outcome = await persistRows(unsaved.map(toTarget));
    if (outcome.ok && skippedConflicts > 0) {
      setNotice({ kind: 'warning', text: `Se guardaron ${unsaved.length} registro(s) de ${scope}. ${skippedConflicts} con conflicto quedaron sin guardar.` });
    }
  };
  // Botón de cabecera: todo lo mostrado según el filtro de restaurante.
  const handleGuardarPeriodo = () => saveRows(rows, restaurant === 'Todos' ? 'todos los restaurantes' : restaurant);

  // ── Borradores ──
  const saveDraft = (row: PayrollRow, values: PayrollInputs) => {
    setDraftState((current) => {
      const items = { ...(current.periodKey === periodKey ? current.items : {}) };
      if (sameInputs(values, row.baseInputs)) delete items[row.cedulaKey];
      else items[row.cedulaKey] = { inputs: values, base: row.baseInputs };
      return { periodKey, items };
    });
  };
  const discardDraft = (cedulaKey: string) => setDraftState((current) => {
    if (current.periodKey !== periodKey) return current;
    const items = { ...current.items };
    delete items[cedulaKey];
    return { ...current, items };
  });
  const discardAllDrafts = () => {
    if (!window.confirm(`¿Descartar los ${draftCount} borrador(es) de este periodo? Se perderán los cambios sin guardar.`)) return;
    setDraftState({ periodKey, items: {} });
  };

  const noticeStyles: Record<NonNullable<Notice>['kind'], string> = {
    success: 'border-[#80CED7]/40 bg-[#80CED7]/10 text-[#007EA7]',
    error: 'border-red-300 bg-red-50 text-red-700',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2"><Wallet className="h-6 w-6 text-[#007EA7]" /><h1 className="text-2xl font-semibold tracking-tight">Deducciones de Nómina</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">Calcula, revisa y guarda la planilla por quincena.</p>
      </div>
      <div className="flex flex-col items-start gap-1 md:items-end">
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Button>
          <Button className="gap-2 bg-[#80CED7] text-black hover:bg-[#007EA7]" disabled={isSaving || !sheetReady || unsavedCount === 0} onClick={handleGuardarPeriodo}>
            <Save className="h-4 w-4" />{isSaving ? 'Guardando...' : `Guardar cambios (${unsavedCount})`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Guarda todo lo mostrado ({restaurant === 'Todos' ? 'todos los restaurantes' : restaurant}). También puede guardar cada empleado con "Ver".</p>
      </div>
    </div>

    {notice && <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm', noticeStyles[notice.kind])}>
      <span>{notice.text}</span>
      {notice.canReload && <Button size="sm" variant="outline" className="gap-2" onClick={reloadPeriod}><RefreshCw className="h-4 w-4" />Recargar periodo</Button>}
    </div>}
    {sheet.periodKey === periodKey && sheet.status === 'error' && <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm', noticeStyles.error)}>
      <span>{sheet.message}. No se puede guardar hasta cargar el periodo, para no sobrescribir datos existentes.</span>
      <Button size="sm" variant="outline" className="gap-2" onClick={reloadPeriod}><RefreshCw className="h-4 w-4" />Reintentar</Button>
    </div>}
    {!sheetReady && sheet.status !== 'error' && <div className="rounded-lg border border-muted bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Cargando deducciones guardadas de este periodo...</div>}
    {sheetReady && sheet.warnings.length > 0 && <div className={cn('rounded-lg border px-4 py-3 text-sm', noticeStyles.warning)}>
      <p className="font-medium">La hoja DEDUCCIONES tiene filas de este periodo que no se pudieron leer:</p>
      <ul className="mt-1 list-disc pl-5">{sheet.warnings.slice(0, 5).map((text) => <li key={text}>{text}</li>)}</ul>
    </div>}
    {orphanCount > 0 && <details className="group rounded-lg border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <Badge variant="outline">{orphanCount}</Badge>
        <span>registro(s) en la hoja fuera de esta planilla (no suman en los totales)</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        {orphans.slice(0, 10).map((item) => <li key={item.cedula}><span className="font-medium text-foreground">{item.nombre}</span> · {item.cedula} — {item.reason}</li>)}
        {orphans.length > 10 && <li>… y {orphans.length - 10} más</li>}
      </ul>
    </details>}
    {sheetReady && draftCount > 0 && <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm', noticeStyles.warning)}>
      <span>Tiene {draftCount} registro(s) con cambios sin guardar{conflictCount > 0 ? ` (${conflictCount} con conflicto)` : ''}. Se conservan en este navegador aunque cierre la ventana o recargue; envíelos con “Guardar cambios”.</span>
      <Button size="sm" variant="outline" onClick={discardAllDrafts}>Descartar borradores</Button>
    </div>}
    {sheetReady && restaurantsWithPending.length > 0 && <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base">
        Pendientes de guardar por restaurante <Badge variant="secondary">{restaurantsWithPending.reduce((sum, group) => sum + group.unsaved + group.conflicts, 0)}</Badge>
      </CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {restaurantsWithPending.map((group) => {
          const pending = group.unsaved + group.conflicts;
          const active = restaurantKey(restaurant) === group.key;
          return <button key={group.key} type="button" title="Filtrar la tabla por este restaurante"
            onClick={() => setRestaurant(restaurantes.find((item) => restaurantKey(item) === group.key) ?? group.label)}
            className={cn('rounded-lg border p-3 text-left transition-colors hover:bg-muted/40', active ? 'border-[#007EA7] bg-[#80CED7]/10' : 'border-muted')}>
            <p className="truncate text-sm font-medium">{group.label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-[#007EA7]">{pending}</span>
              <span className="text-xs text-muted-foreground">{pending === 1 ? 'empleado por pagar' : 'empleados por pagar'} · de {group.total}</span>
            </p>
          </button>;
        })}
      </CardContent>
    </Card>}
    {proratedCount > 0 && <div className={cn('rounded-lg border px-4 py-3 text-sm', noticeStyles.warning)}>Hay {proratedCount} empleado(s) con días prorrateados por fecha de ingreso o egreso. Revise el detalle antes de guardar.</div>}
    {blockedCount > 0 && <div className={cn('rounded-lg border px-4 py-3 text-sm', noticeStyles.error)}>{blockedCount} empleado(s) tienen datos por corregir antes de poder guardarse (marcados como “Revisar”).</div>}

    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Filtros del periodo</CardTitle>
          <Button size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="bg-[#80CED7] text-black hover:bg-[#007EA7] hover:text-white">
            <SlidersHorizontal className="mr-2 h-4 w-4" />{filtersOpen ? 'Ocultar' : 'Mostrar'} filtros<ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      {filtersOpen && <CardContent className="grid gap-4 border-t pt-5 md:grid-cols-2 lg:grid-cols-5">
        <div><label className="text-xs font-medium text-muted-foreground">Restaurante</label>
          <Select value={restaurant} onValueChange={setRestaurant}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{restaurantes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="text-xs font-medium text-muted-foreground">Mes</label>
          <Select value={month} onValueChange={setMonth}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2024, index).toLocaleString('es', { month: 'long' })}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="text-xs font-medium text-muted-foreground">Quincena</label>
          <Select value={fortnight} onValueChange={(value: Fortnight) => setFortnight(value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="first">1 al 15</SelectItem><SelectItem value="second">16 al último día</SelectItem></SelectContent></Select></div>
        <div><label className="text-xs font-medium text-muted-foreground">Año</label>
          <Select value={year} onValueChange={setYear}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{yearOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="text-xs font-medium text-muted-foreground">Buscar empleado</label>
          <div className="relative mt-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o cédula" /></div></div>
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm md:col-span-2 lg:col-span-5">
          <FileText className="h-4 w-4 text-[#007EA7]" />Periodo: <strong>{period.start.toLocaleDateString('es-NI')} — {period.end.toLocaleDateString('es-NI')}</strong>
        </div>
      </CardContent>}
    </Card>

    <Tabs value={mode} onValueChange={(value) => setMode(value as 'table' | 'totals')}>
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-[#80CED7]/10 p-2 sm:grid-cols-2">
        <TabsTrigger value="table" className="gap-2 data-[state=active]:bg-[#80CED7] data-[state=active]:text-black"><Users className="h-4 w-4" />Tabla masiva</TabsTrigger>
        <TabsTrigger value="totals" className="gap-2"><Wallet className="h-4 w-4" />Total por pagar</TabsTrigger>
      </TabsList>

      <TabsContent value="table" className="mt-4">
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Planilla del periodo <Badge variant="secondary" className="ml-2">{rows.length} empleados</Badge></CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-[#007EA7] text-white">
                <tr>{['Empleado', 'Cargo', 'Restaurante', 'Salario', 'Días', 'Devengado', 'INSS', 'Otras', 'Deducciones', 'Neto', 'Estado', ''].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left font-medium">{heading}</th>)}</tr>
              </thead>
              <tbody>{paginatedRows.map((row) => <tr key={row.id} className="border-b transition-colors hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{row.nombreCompleto}</td>
                <td className="px-4 py-3">{row.cargo || '-'}</td>
                <td className="px-4 py-3">{row.restaurante}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.inputs.salarioMensual)}</td>
                <td className="px-4 py-3">{row.inputs.diasLaborados}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.totalDevengado)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.inssLaboral)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.otrasDeducciones)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.totalDeducciones)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#007EA7]">{formatCurrency(row.calculation.netoPagar)}</td>
                <td className="px-4 py-3">
                  {!sheetReady ? <Badge variant="outline">…</Badge>
                    : isBlocked(row) ? <Badge variant="destructive" title={[...row.issues, ...Object.values(row.fieldErrors)].join(' · ')}>Revisar</Badge>
                    : row.status === 'conflict' ? <Badge variant="destructive" title={row.warnings.join(' · ')}>Conflicto</Badge>
                    : row.status === 'draft' ? <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900" title="Cambios sin guardar">Borrador</Badge>
                    : row.status === 'saved' ? <Badge variant="secondary" title={row.warnings.join(' · ')}>Guardado{row.warnings.length > 0 ? ' ⚠' : ''}</Badge>
                    : <Badge variant="outline">Pendiente</Badge>}
                </td>
                <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => { setSelectedId(row.id); setDetailOpen(true); }}>Ver</Button></td>
              </tr>)}</tbody>
              <tfoot className="bg-muted/70 font-semibold">
                <tr>
                  <td className="px-4 py-3" colSpan={5}>Totales ({rows.length} empleados)</td>
                  <td className="px-4 py-3">{formatCurrency(totals.totalDevengado)}</td>
                  <td className="px-4 py-3">{formatCurrency(totals.inssLaboral)}</td>
                  <td className="px-4 py-3">{formatCurrency(totals.otrasDeducciones)}</td>
                  <td className="px-4 py-3">{formatCurrency(totals.totalDeducciones)}</td>
                  <td className="px-4 py-3 text-[#007EA7]">{formatCurrency(totals.netoPagar)}</td>
                  <td /><td />
                </tr>
              </tfoot>
            </table>
            {rows.length > 0 && <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Filas por página</span>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}><SelectTrigger className="h-8 w-[76px]"><SelectValue /></SelectTrigger><SelectContent>{PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{rangeFrom}–{rangeTo} de {rows.length}</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="min-w-[4.5rem] text-center text-muted-foreground">Pág. {currentPage} / {totalPages}</span>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="totals" className="mt-4 space-y-6">
        <TotalsPayable rows={rows} totals={totals} />
        <RestaurantBreakdown rows={rows} />
      </TabsContent>
    </Tabs>

    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#007EA7]">Detalle del empleado</DialogTitle>
          <DialogDescription>Ingresos, extras y deducciones del periodo {periodKey}. Use “Guardar” para enviar este empleado a la hoja, o “Dejar en borrador” para guardarlo después junto con los demás.</DialogDescription>
        </DialogHeader>
        {selected
          ? <PayrollDetail
              key={`${selected.id}-${periodKey}-${reloadToken}`}
              row={selected}
              canPersist={sheetReady && !isSaving}
              isSaving={isSaving}
              onSave={(values) => persistRows([{ cedulaKey: selected.cedulaKey, inputs: values, version: selected.version, nombre: selected.nombreCompleto }])}
              onSaveDraft={(values) => {
                saveDraft(selected, values);
                setDetailOpen(false);
                setNotice({ kind: 'success', text: `Borrador de ${selected.nombreCompleto} conservado. Se enviará con “Guardar cambios”.` });
              }}
              onDiscardDraft={() => { discardDraft(selected.cedulaKey); setDetailOpen(false); }}
              onReload={reloadPeriod}
              onClose={() => setDetailOpen(false)}
            />
          : <p className="py-8 text-center text-muted-foreground">No hay empleado seleccionado.</p>}
      </DialogContent>
    </Dialog>
  </div>;
}

function NumberField({ label, prefix, value, error, onChange }: {
  label: string; prefix?: string; value: string; error?: string; onChange: (value: string) => void;
}) {
  return <div className="min-w-0 space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">{prefix}</span>}
      <Input inputMode="decimal" value={value} aria-invalid={!!error} onChange={(event) => onChange(event.target.value)} className={cn(prefix && 'pl-8', error && 'border-red-500 focus-visible:ring-red-500')} />
    </div>
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>;
}

function PayrollDetail({ row, canPersist, isSaving, onSave, onSaveDraft, onDiscardDraft, onReload, onClose }: {
  row: PayrollRow;
  canPersist: boolean;
  isSaving: boolean;
  onSave: (values: PayrollInputs) => Promise<SaveOutcome>;
  onSaveDraft: (values: PayrollInputs) => void;
  onDiscardDraft: () => void;
  onReload: () => void;
  onClose: () => void;
}) {
  // El formulario trabaja con texto para poder escribir decimales ("250.") sin que se pierdan.
  const [form, setForm] = useState<FormValues>(() => inputsToForm(row.inputs));
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  // 2.0: por defecto solo se deduce INSS; el IR se activa a mano (p. ej. empleados que no son pasantes/temporales).
  const [aplicaIR, setAplicaIR] = useState<boolean>(!!row.inputs.aplicaIR);

  const maxDays = row.eligibility.days;
  const parsed = useMemo(() => parseFormValues(form, maxDays, aplicaIR), [form, maxDays, aplicaIR]);
  const c = parsed.values ? calcularTotales(parsed.values) : null;
  // dirty = distinto a lo que se muestra; changedVsBase = distinto a lo guardado en la hoja (o a los valores por defecto)
  const dirty = parsed.values ? !sameInputs(parsed.values, row.inputs) : true;
  const changedVsBase = parsed.values ? !sameInputs(parsed.values, row.baseInputs) : true;
  const hasDraft = row.status === 'draft' || row.status === 'conflict';
  const canSave = !!parsed.values && canPersist && row.issues.length === 0 && (row.status !== 'saved' || changedVsBase);
  const canDraft = !!parsed.values && row.issues.length === 0 && (dirty || row.status === 'conflict');

  const setField = (field: PayrollField, value: string) => {
    setFeedback(null);
    setForm((current) => ({ ...current, [field]: value }));
  };
  const handleClear = () => {
    setFeedback(null); // no toca aplicaIR: es una condición del empleado, no un extra ni una deducción
    setForm((current) => ({ ...current, ...Object.fromEntries(CLEARABLE_FIELDS.map((field) => [field, '0'])) }));
  };
  const handleSave = async () => {
    if (!parsed.values) return;
    const outcome = await onSave(parsed.values);
    setFeedback(outcome.ok ? { kind: 'success', text: 'Guardado en la hoja DEDUCCIONES.' } : { kind: 'error', text: outcome.message });
  };

  const renderField = ({ field, prefix }: { field: PayrollField; prefix?: string }) => (
    <NumberField key={field} label={FIELD_LABELS[field]} prefix={prefix} value={form[field]} error={parsed.errors[field]} onChange={(value) => setField(field, value)} />
  );
  const breakdown: [string, number][] = c ? [
    ['Salario quincenal', c.salarioQuincenal], ['Básico', c.basico], ['Vacaciones', c.vacaciones], ['Horas extra', c.horasExtraMonto],
    ['Total devengado', c.totalDevengado], [`INSS Laboral (${PAYROLL_CONSTANTS.employeeInssRate * 100}%)`, -c.inssLaboral],
    ...(aplicaIR ? [['IR Laboral', -c.irLaboral] as [string, number]] : []),
    ['Otras deducciones', -c.otrasDeducciones], ['Neto a pagar', c.netoPagar],
  ] : [];

  const strongRows = new Set(['Total devengado', 'Neto a pagar']);
  return <div className="space-y-6">
    <div className="grid gap-3 rounded-xl bg-[#80CED7]/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div><p className="text-xs text-muted-foreground">Nombre completo</p><p className="font-semibold">{row.nombreCompleto}</p></div>
      <div><p className="text-xs text-muted-foreground">Cédula</p><p className="font-semibold">{row.cedula}</p></div>
      <div><p className="text-xs text-muted-foreground">Cargo</p><p className="font-semibold">{row.cargo || '-'}</p></div>
      <div><p className="text-xs text-muted-foreground">Restaurante</p><p className="font-semibold">{row.restaurante}</p></div>
    </div>

    <p className="text-sm text-muted-foreground">
      Corresponden <strong>{maxDays}</strong> de {PAYROLL_CONSTANTS.fortnightDays} días en esta quincena{row.eligibility.reason ? ` (${row.eligibility.reason.toLowerCase()})` : ''}.
      {' '}{row.status === 'saved' ? 'Datos leídos de la hoja; puede modificarlos y guardar.' : hasDraft ? 'Hay cambios en borrador, todavía no guardados en la hoja.' : 'Aún no hay datos guardados para este periodo.'}
    </p>

    {row.issues.length > 0 && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{row.issues.join(' · ')}. Corrija la ficha del empleado para poder guardar.</div>}
    {row.warnings.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{row.warnings.join(' · ')}</div>}

    <div className="grid gap-4 md:grid-cols-3">
      {([['Total devengado', c?.totalDevengado], ['Deducciones', c?.totalDeducciones], ['Neto a pagar', c?.netoPagar]] as const).map(([label, value], index) => (
        <Card key={label} className={index === 2 ? 'border-[#80CED7] bg-[#80CED7]/10' : ''}>
          <CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-[#007EA7]">{value === undefined ? '—' : formatCurrency(value)}</p></CardContent>
        </Card>
      ))}
    </div>

    <div className="space-y-6">
      <Card className="min-w-0 border-0 shadow-sm">
        <CardHeader><CardTitle>{row.nombreCompleto}</CardTitle><p className="text-sm text-muted-foreground">{row.cargo || 'Sin cargo'} · {row.restaurante}</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Ingresos y extras</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{INCOME_FIELDS.map(renderField)}</div>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Deducciones</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{DEDUCTION_FIELDS.map(renderField)}</div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-muted p-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={aplicaIR} onChange={(event) => { setFeedback(null); setAplicaIR(event.target.checked); }} />
            <span><span className="font-medium">Retener IR laboral</span><br />
              <span className="text-xs text-muted-foreground">Desactivado por defecto: solo se deduce el INSS (pasantías, temporales). Actívelo solo si este empleado debe retener IR.</span></span>
          </label>
          {parsed.errors.general && <p className="text-sm text-red-600">{parsed.errors.general}</p>}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Desglose de nómina</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {c ? breakdown.map(([label, value]) => (
            <div key={label} className={`flex justify-between ${strongRows.has(label) ? 'border-t pt-3 font-semibold' : ''}`}>
              <span>{label}</span><span className={label === 'Neto a pagar' ? 'text-lg text-[#007EA7]' : ''}>{formatCurrency(value)}</span>
            </div>
          )) : <p className="text-muted-foreground">Corrija los campos marcados para ver el desglose.</p>}
          {c && <>
            <Separator />
            <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Provisiones patronales</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <span>Aguinaldo<br /><strong>{formatCurrency(c.provisionAguinaldo)}</strong></span>
              <span>Indemnización<br /><strong>{formatCurrency(c.provisionIndemnizacion)}</strong></span>
              <span>Vacaciones<br /><strong>{formatCurrency(c.provisionVacaciones)}</strong></span>
            </div>
          </>}
        </CardContent>
      </Card>
    </div>

    {feedback && <div role="status" className={cn('flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm', feedback.kind === 'success' ? 'border-[#80CED7]/40 bg-[#80CED7]/10 text-[#007EA7]' : 'border-red-300 bg-red-50 text-red-700')}>
      <span>{feedback.text}</span>
      {feedback.kind === 'error' && <Button size="sm" variant="outline" className="gap-2" onClick={onReload}><RefreshCw className="h-4 w-4" />Recargar periodo</Button>}
    </div>}

    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
      <Button variant="outline" className="gap-2" onClick={handleClear} disabled={isSaving}><Eraser className="h-4 w-4" />Limpiar extras y deducciones</Button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {hasDraft && <Button variant="ghost" disabled={isSaving} onClick={onDiscardDraft}>Descartar borrador</Button>}
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        <Button variant="outline" disabled={!canDraft || isSaving} onClick={() => parsed.values && onSaveDraft(parsed.values)}>Dejar en borrador</Button>
        <Button className="gap-2 bg-[#80CED7] text-black hover:bg-[#007EA7] hover:text-white" disabled={!canSave} onClick={handleSave}>
          <Save className="h-4 w-4" />{isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  </div>;
}

function RestaurantBreakdown({ rows }: { rows: PayrollRow[] }) {
  const groups = rows.reduce<Record<string, { label: string; employees: number; devengado: number; deducciones: number; neto: number }>>((acc, row) => {
    const key = restaurantKey(row.restaurante);
    const current = acc[key] ?? { label: (row.restaurante ?? '').trim() || 'Sin restaurante', employees: 0, devengado: 0, deducciones: 0, neto: 0 };
    current.employees += 1;
    current.devengado += row.calculation.totalDevengado;
    current.deducciones += row.calculation.totalDeducciones;
    current.neto += row.calculation.netoPagar;
    acc[key] = current;
    return acc;
  }, {});
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Desglose por restaurante</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="py-2">Restaurante</th><th className="py-2 text-right">Empleados</th><th className="py-2 text-right">Devengado</th><th className="py-2 text-right">Deducciones</th><th className="py-2 text-right">Neto a pagar</th></tr></thead><tbody>{Object.entries(groups).map(([key, values]) => <tr key={key} className="border-b"><td className="py-2 font-medium">{values.label}</td><td className="py-2 text-right">{values.employees}</td><td className="py-2 text-right">{formatCurrency(values.devengado)}</td><td className="py-2 text-right">{formatCurrency(values.deducciones)}</td><td className="py-2 text-right font-semibold text-[#007EA7]">{formatCurrency(values.neto)}</td></tr>)}</tbody></table></CardContent></Card>;
}

function TotalsPayable({ rows, totals }: { rows: PayrollRow[]; totals: Record<string, number> }) {
  const cards = [['Salario', totals.totalDevengado], ['INSS Patronal', totals.inssPatronal], ['INATEC', totals.inatec], ['Aguinaldo', totals.provisionAguinaldo], ['Indemnizaciones', totals.provisionIndemnizacion], ['Vacaciones', totals.provisionVacaciones], ['Salario por pagar', totals.netoPagar]];
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-[#007EA7]" />Totales por Pagar</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(value))}</p></div>)}</div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Concepto</th><th className="py-2 text-right">Monto</th></tr></thead><tbody>{[['INSS laboral retenido', totals.inssLaboral], ...(totals.irLaboral > 0 ? [['IR retenido', totals.irLaboral]] : []), ['Consumos y préstamos', totals.otrasDeducciones]].map(([label, value]) => <tr key={String(label)} className="border-b"><td className="py-2">{label}</td><td className="py-2 text-right">{formatCurrency(Number(value))}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">El resumen se calcula con los {rows.length} empleados del filtro actual y queda listo para exportar al periodo.</p></CardContent></Card>;
}
