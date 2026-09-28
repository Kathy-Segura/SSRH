'use client';

import { useEffect, useMemo, useState } from 'react';
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
  PAYROLL_YEAR_WINDOW,
  type Fortnight,
  type PayrollCalculation,
  type PayrollInputs,
  type PeriodEligibility,
} from '@/lib/payroll-calculations';
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

type SavedRecord = { inputs: PayrollInputs; version: string };
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
  status: 'saved' | 'pending';
  version: string | null;
  issues: string[];
  warnings: string[];
  fieldErrors: FieldErrors;
};
type Notice = { kind: 'success' | 'error' | 'warning'; text: string; canReload?: boolean } | null;
type SaveTarget = { cedulaKey: string; inputs: PayrollInputs; version: string | null };
type SaveOutcome = { ok: true } | { ok: false; message: string };

const isBlocked = (row: PayrollRow) => row.issues.length > 0 || Object.keys(row.fieldErrors).length > 0;
const toTarget = (row: PayrollRow): SaveTarget => ({ cedulaKey: row.cedulaKey, inputs: row.inputs, version: row.version });

export function PayrollModule({ employees }: { employees: Employee[] }) {
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
          byCedula[normalizeCedula(item.cedula)] = { inputs: item.inputs, version: item.version };
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

      // Un empleado inactivo solo se paga si su salida cae dentro o después del periodo.
      if (employee.estado !== 'activo' && !egreso) return [];
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
    const fichaSalary = Number(employee.salario);
    const defaults: PayrollInputs = {
      salarioMensual: Number.isFinite(fichaSalary) && fichaSalary > 0 ? fichaSalary : 0,
      diasLaborados: eligibility.days,
      diasVacaciones: 0, horasExtra: 0, otrosIngresos: 0, consumo: 0, prestamo: 0, greceComida: 0, otros: 0,
    };
    const inputs = record?.inputs ?? defaults;
    const warnings: string[] = [];
    if (record) {
      const diasPagados = record.inputs.diasLaborados + record.inputs.diasVacaciones;
      if (diasPagados !== eligibility.days) warnings.push(`Días guardados (${diasPagados}) distintos a los que corresponden por fechas (${eligibility.days})`);
      if (defaults.salarioMensual > 0 && record.inputs.salarioMensual !== defaults.salarioMensual) {
        warnings.push(`Salario guardado distinto al de la ficha (${formatCurrency(defaults.salarioMensual)})`);
      }
    }
    return {
      ...employee,
      cedulaKey,
      inputs,
      calculation: calcularTotales(inputs),
      eligibility,
      status: record ? 'saved' : 'pending',
      version: record?.version ?? null,
      issues,
      warnings,
      fieldErrors: validatePayrollInputs(inputs, eligibility.days),
    };
  }), [eligible, sheet, sheetReady]);

  const rows = useMemo(() => allRows.filter((row) => {
    const matchesRestaurant = restaurant === 'Todos' || normalizeText(row.restaurante) === normalizeText(restaurant);
    const text = query.trim().toLowerCase();
    const matchesQuery = !text || row.nombreCompleto.toLowerCase().includes(text) || row.cedula.toLowerCase().includes(text);
    return matchesRestaurant && matchesQuery;
  }), [allRows, restaurant, query]);

  const proratedCount = rows.filter((row) => row.eligibility.status === 'partial').length;
  const blockedCount = rows.filter(isBlocked).length;
  const pendingCount = rows.filter((row) => row.status === 'pending').length;
  const orphanCount = sheetReady
    ? Object.keys(sheet.byCedula).filter((cedula) => !allRows.some((row) => row.cedulaKey === cedula)).length
    : 0;
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

    const savedPeriodKey = periodKey;
    setIsSaving(true);
    try {
      const response = await fetch('/api/deducciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: yearNumber, month: monthNumber, fortnight,
          filas: targets.map((target) => ({ cedula: target.cedulaKey, inputs: target.inputs, version: target.version })),
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
      setNotice({ kind: 'success', text: `Se guardaron ${targets.length} registro(s) en la hoja DEDUCCIONES (${savedPeriodKey}).` });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red al guardar';
      setNotice({ kind: 'error', text: message });
      return { ok: false, message };
    } finally {
      setIsSaving(false);
    }
  };

  const handleGuardarPeriodo = async () => {
    const pending = rows.filter((row) => row.status === 'pending');
    if (pending.length === 0) {
      setNotice({ kind: 'success', text: 'No hay registros pendientes: todo lo mostrado ya está guardado.' });
      return;
    }
    const blocked = pending.filter(isBlocked);
    if (blocked.length > 0) {
      const names = blocked.slice(0, 3).map((row) => row.nombreCompleto).join(', ');
      setNotice({ kind: 'error', text: `No se guardó nada: corrija ${blocked.length} empleado(s) con errores (${names}${blocked.length > 3 ? '…' : ''}). Ábralos con "Ver".` });
      return;
    }
    await persistRows(pending.map(toTarget));
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
      <div className="flex gap-2">
        <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Button>
        <Button className="gap-2 bg-[#80CED7] text-black hover:bg-[#007EA7]" disabled={isSaving || !sheetReady || pendingCount === 0} onClick={handleGuardarPeriodo}>
          <Save className="h-4 w-4" />{isSaving ? 'Guardando...' : `Guardar pendientes (${pendingCount})`}
        </Button>
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
    {orphanCount > 0 && <div className={cn('rounded-lg border px-4 py-3 text-sm', noticeStyles.warning)}>Hay {orphanCount} registro(s) guardado(s) en la hoja que no corresponden a ningún empleado pagable en este periodo (no se incluyen en los totales).</div>}
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
                <tr>{['Empleado', 'Cargo', 'Restaurante', 'Salario', 'Días', 'Devengado', 'INSS', 'IR', 'Otras', 'Deducciones', 'Neto', 'Estado', ''].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left font-medium">{heading}</th>)}</tr>
              </thead>
              <tbody>{paginatedRows.map((row) => <tr key={row.id} className="border-b transition-colors hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{row.nombreCompleto}</td>
                <td className="px-4 py-3">{row.cargo || '-'}</td>
                <td className="px-4 py-3">{row.restaurante}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.inputs.salarioMensual)}</td>
                <td className="px-4 py-3">{row.inputs.diasLaborados}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.totalDevengado)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.inssLaboral)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.irLaboral)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.otrasDeducciones)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.totalDeducciones)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#007EA7]">{formatCurrency(row.calculation.netoPagar)}</td>
                <td className="px-4 py-3">
                  {!sheetReady ? <Badge variant="outline">…</Badge>
                    : isBlocked(row) ? <Badge variant="destructive" title={[...row.issues, ...Object.values(row.fieldErrors)].join(' · ')}>Revisar</Badge>
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
                  <td className="px-4 py-3">{formatCurrency(totals.irLaboral)}</td>
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
          <DialogDescription>Ingresos, extras y deducciones del periodo {periodKey}. Los cambios se guardan al presionar “Guardar”.</DialogDescription>
        </DialogHeader>
        {selected
          ? <PayrollDetail
              key={`${selected.id}-${periodKey}-${reloadToken}`}
              row={selected}
              canPersist={sheetReady && !isSaving}
              isSaving={isSaving}
              onSave={(values) => persistRows([{ cedulaKey: selected.cedulaKey, inputs: values, version: selected.version }])}
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

function PayrollDetail({ row, canPersist, isSaving, onSave, onReload, onClose }: {
  row: PayrollRow;
  canPersist: boolean;
  isSaving: boolean;
  onSave: (values: PayrollInputs) => Promise<SaveOutcome>;
  onReload: () => void;
  onClose: () => void;
}) {
  // El formulario trabaja con texto para poder escribir decimales ("250.") sin que se pierdan.
  const [form, setForm] = useState<FormValues>(() => inputsToForm(row.inputs));
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const maxDays = row.eligibility.days;
  const parsed = useMemo(() => parseFormValues(form, maxDays), [form, maxDays]);
  const c = parsed.values ? calcularTotales(parsed.values) : null;
  const dirty = parsed.values ? !sameInputs(parsed.values, row.inputs) : true;
  const canSave = !!parsed.values && canPersist && row.issues.length === 0 && (dirty || row.status === 'pending');

  const setField = (field: PayrollField, value: string) => {
    setFeedback(null);
    setForm((current) => ({ ...current, [field]: value }));
  };
  const handleClear = () => {
    setFeedback(null);
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
    ['IR Laboral', -c.irLaboral], ['Otras deducciones', -c.otrasDeducciones], ['Neto a pagar', c.netoPagar],
  ] : [];

  return <div className="space-y-6">
    <div className="grid gap-3 rounded-xl bg-[#80CED7]/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div><p className="text-xs text-muted-foreground">Nombre completo</p><p className="font-semibold">{row.nombreCompleto}</p></div>
      <div><p className="text-xs text-muted-foreground">Cédula</p><p className="font-semibold">{row.cedula}</p></div>
      <div><p className="text-xs text-muted-foreground">Cargo</p><p className="font-semibold">{row.cargo || '-'}</p></div>
      <div><p className="text-xs text-muted-foreground">Restaurante</p><p className="font-semibold">{row.restaurante}</p></div>
    </div>

    <p className="text-sm text-muted-foreground">
      Corresponden <strong>{maxDays}</strong> de {PAYROLL_CONSTANTS.fortnightDays} días en esta quincena{row.eligibility.reason ? ` (${row.eligibility.reason.toLowerCase()})` : ''}.
      {' '}{row.status === 'saved' ? 'Datos leídos de la hoja; puede modificarlos y guardar.' : 'Aún no hay datos guardados para este periodo.'}
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
          {parsed.errors.general && <p className="text-sm text-red-600">{parsed.errors.general}</p>}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Desglose de nómina</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {c ? breakdown.map(([label, value], index) => (
            <div key={label} className={`flex justify-between ${index === 4 || index === 8 ? 'border-t pt-3 font-semibold' : ''}`}>
              <span>{label}</span><span className={index === 8 ? 'text-lg text-[#007EA7]' : ''}>{formatCurrency(value)}</span>
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
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        <Button className="gap-2 bg-[#80CED7] text-black hover:bg-[#007EA7] hover:text-white" disabled={!canSave} onClick={handleSave}>
          <Save className="h-4 w-4" />{isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  </div>;
}

function RestaurantBreakdown({ rows }: { rows: PayrollRow[] }) {
  const groups = rows.reduce<Record<string, { employees: number; devengado: number; deducciones: number; neto: number }>>((acc, row) => {
    const key = row.restaurante;
    const current = acc[key] ?? { employees: 0, devengado: 0, deducciones: 0, neto: 0 };
    current.employees += 1;
    current.devengado += row.calculation.totalDevengado;
    current.deducciones += row.calculation.totalDeducciones;
    current.neto += row.calculation.netoPagar;
    acc[key] = current;
    return acc;
  }, {});
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Desglose por restaurante</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="py-2">Restaurante</th><th className="py-2 text-right">Empleados</th><th className="py-2 text-right">Devengado</th><th className="py-2 text-right">Deducciones</th><th className="py-2 text-right">Neto a pagar</th></tr></thead><tbody>{Object.entries(groups).map(([name, values]) => <tr key={name} className="border-b"><td className="py-2 font-medium">{name}</td><td className="py-2 text-right">{values.employees}</td><td className="py-2 text-right">{formatCurrency(values.devengado)}</td><td className="py-2 text-right">{formatCurrency(values.deducciones)}</td><td className="py-2 text-right font-semibold text-[#007EA7]">{formatCurrency(values.neto)}</td></tr>)}</tbody></table></CardContent></Card>;
}

function TotalsPayable({ rows, totals }: { rows: PayrollRow[]; totals: Record<string, number> }) {
  const cards = [['Salario', totals.totalDevengado], ['INSS Patronal', totals.inssPatronal], ['INATEC', totals.inatec], ['Aguinaldo', totals.provisionAguinaldo], ['Indemnizaciones', totals.provisionIndemnizacion], ['Vacaciones', totals.provisionVacaciones], ['Salario por pagar', totals.netoPagar]];
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-[#007EA7]" />Totales por Pagar</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(value))}</p></div>)}</div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Concepto</th><th className="py-2 text-right">Monto</th></tr></thead><tbody>{[['INSS laboral retenido', totals.inssLaboral], ['IR retenido', totals.irLaboral], ['Consumos y préstamos', totals.otrasDeducciones]].map(([label, value]) => <tr key={String(label)} className="border-b"><td className="py-2">{label}</td><td className="py-2 text-right">{formatCurrency(Number(value))}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">El resumen se calcula con los {rows.length} empleados del filtro actual y queda listo para exportar al periodo.</p></CardContent></Card>;
}
