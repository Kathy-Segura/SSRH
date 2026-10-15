'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw, Search, Wallet } from 'lucide-react';
import { formatCurrency, PAYROLL_CONSTANTS } from '@/lib/payroll-calculations';
import { aggregateRows, groupByRestaurant } from '@/lib/payroll-aggregates';
import { formatDateTime, formatPercent, normalizeText, type PayrollRow } from '@/components/payroll-shared';

// Pestañas "Total por pagar" (totales + desglose por restaurante) e "Historial de deducciones".

// ── Estado de cuenta: una columna de conceptos y una de montos ───────────────
type LedgerLine = { label: string; amount: number; hint?: string; deduction?: boolean; strong?: boolean };

function Ledger({ title, lines, totalLabel, total, tone }: {
  title: string; lines: LedgerLine[]; totalLabel: string; total: number; tone: 'pay' | 'cost';
}) {
  return <section className="space-y-3">
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    <table className="w-full text-sm">
      <tbody>
        {lines.map((line) => <tr key={line.label} className="border-b last:border-0">
          <td className={cn('py-2 pr-3', line.strong ? 'font-semibold' : line.deduction && 'pl-4 text-muted-foreground')}>
            {line.label}{line.hint && <span className="ml-2 text-xs text-muted-foreground">{line.hint}</span>}
          </td>
          <td className={cn('whitespace-nowrap py-2 text-right tabular-nums', line.strong && 'font-semibold', line.amount === 0 && 'text-muted-foreground')}>
            {line.deduction && line.amount > 0 && <span className="mr-1 text-red-600">−</span>}{formatCurrency(line.amount)}
          </td>
        </tr>)}
      </tbody>
    </table>
    <div className={cn('flex items-center justify-between gap-3 rounded-lg px-4 py-3', tone === 'pay' ? 'bg-[#007EA7] text-white' : 'bg-[#80CED7]/25 text-[#00536F]')}>
      <span className="font-medium">{totalLabel}</span>
      <strong className="whitespace-nowrap text-lg tabular-nums">{formatCurrency(total)}</strong>
    </div>
  </section>;
}

export function TotalsPayable({ rows, unsavedCount = 0 }: { rows: PayrollRow[]; unsavedCount?: number }) {
  const t = useMemo(() => aggregateRows(rows), [rows]);

  const payLines: LedgerLine[] = [
    { label: 'Total devengado', amount: t.totalDevengado, strong: true, hint: 'salario, vacaciones, extras' },
    { label: 'INSS laboral', amount: t.inssLaboral, deduction: true, hint: formatPercent(PAYROLL_CONSTANTS.employeeInssRate) },
    { label: 'IR laboral', amount: t.irLaboral, deduction: true },
    { label: 'Consumo', amount: t.consumo, deduction: true },
    { label: 'Mi Prestamito', amount: t.prestamo, deduction: true },
    { label: 'GRECE Comida', amount: t.greceComida, deduction: true },
    { label: 'Otras deducciones', amount: t.otros, deduction: true },
    { label: 'Total deducciones', amount: t.totalDeducciones, strong: true },
  ];
  const costLines: LedgerLine[] = [
    { label: 'Total devengado', amount: t.totalDevengado, strong: true },
    { label: 'INSS patronal', amount: t.inssPatronal, hint: formatPercent(PAYROLL_CONSTANTS.employerInssRate) },
    { label: 'INATEC', amount: t.inatec, hint: formatPercent(PAYROLL_CONSTANTS.inatecRate) },
    { label: 'Aguinaldo', amount: t.provisionAguinaldo, hint: 'provisión' },
    { label: 'Indemnización', amount: t.provisionIndemnizacion, hint: 'provisión' },
    { label: 'Vacaciones', amount: t.provisionVacaciones, hint: 'provisión' },
  ];

  return <Card className="border-0 shadow-sm">
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
      <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-[#007EA7]" />Totales por pagar</CardTitle>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="secondary">{t.employees} empleado(s)</Badge>
        {t.reconciles
          ? <span className="flex items-center gap-1 text-[#007EA7]"><CheckCircle2 className="h-4 w-4" />Los totales cuadran</span>
          : <span className="flex items-center gap-1 text-red-700"><AlertTriangle className="h-4 w-4" />Los totales no cuadran: recargue el periodo</span>}
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      {unsavedCount > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Incluye {unsavedCount} empleado(s) que aún no están guardados en la hoja: los montos usan los valores en pantalla.
      </div>}
      {rows.length === 0
        ? <p className="py-8 text-center text-sm text-muted-foreground">No hay empleados en este periodo con el filtro actual.</p>
        : <div className="grid gap-8 lg:grid-cols-2">
          <Ledger title="Pago a empleados" lines={payLines} totalLabel="Salario por pagar" total={t.netoPagar} tone="pay" />
          <Ledger title="Costo para la empresa" lines={costLines} totalLabel="Costo total del periodo" total={t.costoEmpresa} tone="cost" />
        </div>}
      <p className="text-xs text-muted-foreground">
        El resumen se calcula con los {rows.length} empleados del filtro actual. Las provisiones equivalen a {PAYROLL_CONSTANTS.provisionDaysPerFortnight} días de salario por quincena cada una.
      </p>
    </CardContent>
  </Card>;
}

// ── Desglose por restaurante: un renglón por restaurante, con sus empleados desplegables ──
export function RestaurantBreakdown({ rows, catalog = [] }: { rows: PayrollRow[]; catalog?: readonly string[] }) {
  const groups = useMemo(() => groupByRestaurant(rows, catalog), [rows, catalog]);
  const total = useMemo(() => aggregateRows(rows), [rows]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const columns = 9;

  return <Card className="border-0 shadow-sm">
    <CardHeader className="space-y-1">
      <CardTitle className="text-base">Desglose por restaurante</CardTitle>
      <p className="text-sm text-muted-foreground">Cuánto se paga en cada restaurante según sus empleados y salarios. Abra un restaurante para ver su personal.</p>
    </CardHeader>
    <CardContent className="overflow-x-auto p-0">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Restaurante</th>
            <th className="px-4 py-3 text-right font-medium">Empleados</th>
            <th className="px-4 py-3 text-right font-medium" title="Suma de los salarios mensuales">Salarios base</th>
            <th className="px-4 py-3 text-right font-medium">Devengado</th>
            <th className="px-4 py-3 text-right font-medium">INSS</th>
            <th className="px-4 py-3 text-right font-medium">IR</th>
            <th className="px-4 py-3 text-right font-medium" title="Consumo, Mi Prestamito, GRECE y otras deducciones">Descuentos</th>
            <th className="px-4 py-3 text-right font-medium">Total deducciones</th>
            <th className="px-4 py-3 text-right font-medium">Neto a pagar</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isOpen = open.has(group.key);
            const share = total.netoPagar > 0 ? (group.totals.netoPagar / total.netoPagar) * 100 : 0;
            return <Fragment key={group.key}>
              <tr className="border-b transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <button type="button" className="flex items-center gap-2 text-left font-medium" aria-expanded={isOpen} onClick={() => toggle(group.key)}>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', !isOpen && '-rotate-90')} />
                    {group.label}
                  </button>
                  <div className="ml-6 mt-1 flex flex-wrap gap-1">
                    {group.variants.length > 1 && <Badge variant="outline" title={`Escrito de ${group.variants.length} formas en las fichas: ${group.variants.join(' | ')}`}>{group.variants.length} grafías unificadas</Badge>}
                    {!group.inCatalog && <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900" title={group.variants.join(' | ') || 'Sin restaurante asignado'}>{group.variants.length === 0 ? 'Sin restaurante asignado' : 'No está en el catálogo'}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{group.totals.employees}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(group.totals.salarioBase)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(group.totals.totalDevengado)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(group.totals.inssLaboral)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(group.totals.irLaboral)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(group.totals.otrasDeducciones)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(group.totals.totalDeducciones)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="whitespace-nowrap font-semibold tabular-nums text-[#007EA7]">{formatCurrency(group.totals.netoPagar)}</span>
                  <div className="ml-auto mt-1 h-1 w-24 rounded bg-muted" aria-hidden="true"><div className="h-1 rounded bg-[#80CED7]" style={{ width: `${Math.min(100, share)}%` }} /></div>
                </td>
              </tr>
              {isOpen && <tr className="border-b bg-muted/20">
                <td colSpan={columns} className="px-4 py-3">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground"><tr>
                      <th className="py-1.5 font-medium">Empleado</th><th className="py-1.5 font-medium">Cargo</th>
                      <th className="py-1.5 text-right font-medium">Salario mensual</th><th className="py-1.5 text-right font-medium">Días</th>
                      <th className="py-1.5 text-right font-medium">Devengado</th><th className="py-1.5 text-right font-medium">Deducciones</th><th className="py-1.5 text-right font-medium">Neto</th>
                    </tr></thead>
                    <tbody>
                      {[...group.rows].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es')).map((row) => <tr key={row.id} className="border-t">
                        <td className="py-1.5 font-medium">{row.nombreCompleto}</td>
                        <td className="py-1.5 text-muted-foreground">{row.cargo || '-'}</td>
                        <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatCurrency(row.inputs.salarioMensual)}</td>
                        <td className="py-1.5 text-right tabular-nums">{row.inputs.diasLaborados}</td>
                        <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatCurrency(row.calculation.totalDevengado)}</td>
                        <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatCurrency(row.calculation.totalDeducciones)}</td>
                        <td className="whitespace-nowrap py-1.5 text-right font-medium tabular-nums text-[#007EA7]">{formatCurrency(row.calculation.netoPagar)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </td>
              </tr>}
            </Fragment>;
          })}
          {groups.length === 0 && <tr><td colSpan={columns} className="px-4 py-10 text-center text-muted-foreground">No hay empleados en este periodo con el filtro actual.</td></tr>}
        </tbody>
        {groups.length > 0 && <tfoot className="bg-muted/70 font-semibold">
          <tr>
            <td className="px-4 py-3">Total ({groups.length} restaurante{groups.length === 1 ? '' : 's'})</td>
            <td className="px-4 py-3 text-right tabular-nums">{total.employees}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(total.salarioBase)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(total.totalDevengado)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(total.inssLaboral)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(total.irLaboral)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(total.otrasDeducciones)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(total.totalDeducciones)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#007EA7]">{formatCurrency(total.netoPagar)}</td>
          </tr>
        </tfoot>}
      </table>
    </CardContent>
  </Card>;
}

// ── 2.6 Historial de deducciones ─────────────────────────────────────────────
type HistorialEntry = {
  fecha: string; periodo: string; cedula: string; nombre: string; campo: string;
  valorAnterior: number | null; valorNuevo: number | null;
  salarioMensual: number | null; deduccionesTotales: number | null; netoPagar: number | null;
};
const CONCEPT_LABELS: Record<string, string> = {
  consumo: 'Consumo', prestamo: 'Mi Prestamito', greceComida: 'GRECE Comida', otros: 'Otros',
  salarioMensual: 'Cambio de salario', diasLaborados: 'Días laborados', diasVacaciones: 'Días de vacaciones',
  horasExtra: 'Horas extra', otrosIngresos: 'Otros ingresos', aplicaIR: 'Retención de IR', excluirINSS: 'Exclusión de INSS',
};
const QUINCENA_LABEL = (periodo: string) => {
  const [year, month, part] = periodo.split('-');
  return `${part === 'second' ? '2.ª' : '1.ª'} quincena ${month}/${year}`;
};
const money = (value: number | null) => (value === null ? '—' : formatCurrency(value));

function conceptText(entry: HistorialEntry) {
  const label = CONCEPT_LABELS[entry.campo] ?? entry.campo;
  if (entry.campo === 'aplicaIR' || entry.campo === 'excluirINSS') return `${label}: ${entry.valorNuevo ? 'activada' : 'desactivada'}`;
  if (['diasLaborados', 'diasVacaciones', 'horasExtra'].includes(entry.campo)) return `${label}: ${entry.valorAnterior ?? 0} → ${entry.valorNuevo ?? 0}`;
  return `${label}: ${money(entry.valorAnterior)} → ${money(entry.valorNuevo)}`;
}

export function DeductionHistory({ periodKey }: { periodKey: string }) {
  const [allPeriods, setAllPeriods] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; entries: HistorialEntry[]; message: string }>({ status: 'loading', entries: [], message: '' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading' }));
    const url = allPeriods ? '/api/historial' : `/api/historial?periodo=${encodeURIComponent(periodKey)}`;
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error ?? 'No se pudo cargar el historial.');
        setState({ status: 'ready', entries: (body.historial ?? []) as HistorialEntry[], message: '' });
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === 'AbortError') return;
        setState({ status: 'error', entries: [], message: error instanceof Error ? error.message : 'No se pudo cargar el historial.' });
      });
    return () => controller.abort();
  }, [periodKey, allPeriods, reloadToken]);

  const visible = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return state.entries;
    return state.entries.filter((entry) => normalizeText(`${entry.nombre} ${entry.cedula}`).includes(term));
  }, [state.entries, query]);

  return <Card className="overflow-hidden border-0 shadow-sm">
    <CardHeader className="space-y-3">
      <CardTitle className="text-base">Historial de deducciones <Badge variant="secondary" className="ml-2">{visible.length} movimientos</Badge></CardTitle>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-11 pl-9" placeholder="Buscar por nombre o cédula" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={allPeriods} onChange={(event) => setAllPeriods(event.target.checked)} />Todos los periodos</label>
        <Button variant="outline" className="h-11 gap-2" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw className="h-4 w-4" />Actualizar</Button>
      </div>
    </CardHeader>
    <CardContent className="overflow-x-auto p-0">
      {state.status === 'error' && <p className="px-6 py-6 text-sm text-red-600">{state.message}</p>}
      {state.status === 'loading' && <p className="px-6 py-6 text-sm text-muted-foreground">Cargando historial…</p>}
      {state.status === 'ready' && <table className="w-full min-w-[960px] text-sm">
        <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{['Fecha', 'Quincena', 'Cédula', 'Nombre', 'Salario mensual', 'Concepto deducción', 'Deducciones totales', 'Neto a pagar'].map((heading) => <th key={heading} className={cn('px-4 py-3', ['Salario mensual', 'Deducciones totales', 'Neto a pagar'].includes(heading) && 'text-right')}>{heading}</th>)}</tr>
        </thead>
        <tbody>
          {visible.map((entry, index) => <tr key={`${entry.fecha}-${entry.cedula}-${entry.campo}-${index}`} className="border-b">
            <td className="whitespace-nowrap px-4 py-3">{formatDateTime(entry.fecha) ?? entry.fecha}</td>
            <td className="whitespace-nowrap px-4 py-3">{QUINCENA_LABEL(entry.periodo)}</td>
            <td className="whitespace-nowrap px-4 py-3">{entry.cedula}</td>
            <td className="px-4 py-3 font-medium">{entry.nombre}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right">{money(entry.salarioMensual)}</td>
            <td className="px-4 py-3">{conceptText(entry)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right">{money(entry.deduccionesTotales)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#007EA7]">{money(entry.netoPagar)}</td>
          </tr>)}
          {visible.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No hay movimientos registrados{allPeriods ? '' : ' en este periodo'}.</td></tr>}
        </tbody>
      </table>}
    </CardContent>
  </Card>;
}
