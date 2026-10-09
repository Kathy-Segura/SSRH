'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Search, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/payroll-calculations';
import { formatDateTime, normalizeText, restaurantKey, type PayrollRow } from '@/components/payroll-shared';

// Pestañas "Total por pagar" (desglose por restaurante + totales) e "Historial de deducciones".

export function RestaurantBreakdown({ rows }: { rows: PayrollRow[] }) {
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

export function TotalsPayable({ rows, totals }: { rows: PayrollRow[]; totals: Record<string, number> }) {
  const cards = [['Salario', totals.totalDevengado], ['INSS Patronal', totals.inssPatronal], ['INATEC', totals.inatec], ['Aguinaldo', totals.provisionAguinaldo], ['Indemnizaciones', totals.provisionIndemnizacion], ['Vacaciones', totals.provisionVacaciones], ['Salario por pagar', totals.netoPagar]];
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-[#007EA7]" />Totales por Pagar</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(value))}</p></div>)}</div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Concepto</th><th className="py-2 text-right">Monto</th></tr></thead><tbody>{[['INSS laboral retenido', totals.inssLaboral], ...(totals.irLaboral > 0 ? [['IR retenido', totals.irLaboral]] : []), ['Consumos y préstamos', totals.otrasDeducciones]].map(([label, value]) => <tr key={String(label)} className="border-b"><td className="py-2">{label}</td><td className="py-2 text-right">{formatCurrency(Number(value))}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">El resumen se calcula con los {rows.length} empleados del filtro actual y queda listo para exportar al periodo.</p></CardContent></Card>;
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
