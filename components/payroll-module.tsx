'use client';

import { useEffect, useMemo, useState } from 'react';
import { Employee } from '@/types/employee';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Printer, Save, Search, SlidersHorizontal, Users, Wallet } from 'lucide-react';
import { calcularTotales, formatCurrency, getPayrollPeriod, getProratedDays, PayrollCalculation, PayrollInputs } from '@/lib/payroll-calculations';

const RESTAURANTS = ['Todos', 'AJÍ', 'DF', 'ADMIN', 'BARRIO CAFÉ', 'LA CONTENTERA', 'FRITONI', 'CANTABAR'];
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const emptyInputs: PayrollInputs = { salarioMensual: 15000, diasLaborados: 15, diasVacaciones: 0, horasExtra: 0, otrosIngresos: 0, consumo: 0, prestamo: 0, greceComida: 0, otros: 0 };

type PayrollRow = Employee & { calculation: PayrollCalculation; inputs: PayrollInputs };

const numberValue = (value: string) => Number(value) || 0;
const safeNumber = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function PayrollModule({ employees }: { employees: Employee[] }) {
  const now = new Date();
  const [mode, setMode] = useState<'table' | 'totals'>('table');
  const [restaurant, setRestaurant] = useState('Todos');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [fortnight, setFortnight] = useState<'first' | 'second'>('first');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(employees[0]?.id ?? '');
  const [inputsById, setInputsById] = useState<Record<string, PayrollInputs>>({});
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);

  const period = useMemo(() => getPayrollPeriod(Number(year), Number(month), fortnight), [year, month, fortnight]);
  const scopedEmployees = useMemo(() => employees.filter((employee) => {
    const matchesRestaurant = restaurant === 'Todos' || employee.restaurante.toUpperCase() === restaurant;
    const matchesQuery = employee.nombreCompleto.toLowerCase().includes(query.toLowerCase()) || employee.cedula.toLowerCase().includes(query.toLowerCase());
    return matchesRestaurant && matchesQuery && employee.estado === 'activo';
  }), [employees, restaurant, query]);

  const getDefaultInputs = (employee: Employee): PayrollInputs => ({
    ...emptyInputs,
    salarioMensual: Number((employee as Employee & { salario?: number }).salario) || 15000,
    diasLaborados: safeNumber(getProratedDays(employee.fechaIngreso, period.start, period.end), 15),
  });
  const getInputs = (employee: Employee): PayrollInputs => {
    const raw = { ...getDefaultInputs(employee), ...(inputsById[employee.id] ?? {}) };
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, safeNumber(value)])) as unknown as PayrollInputs;
  };
  const rows: PayrollRow[] = scopedEmployees.map((employee) => ({ ...employee, inputs: getInputs(employee), calculation: calcularTotales(getInputs(employee)) }));
  const proratedRows = rows.filter((row) => row.inputs.diasLaborados !== 15);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedRows = rows.slice(pageStart, pageStart + pageSize);
  const rangeFrom = rows.length === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageStart + pageSize, rows.length);

  // Al cambiar filtros o tamaño de página, volver a la primera página
  useEffect(() => { setPage(1); }, [restaurant, query, month, year, fortnight, pageSize]);
  const updateInputs = (id: string, patch: Partial<PayrollInputs>) => {
    const employee = employees.find((item) => item.id === id);
    setInputsById((current) => ({ ...current, [id]: { ...(current[id] ?? (employee ? getDefaultInputs(employee) : emptyInputs)), ...patch } }));
  };
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

  const renderInput = (label: string, field: keyof PayrollInputs, value: number, id: string, prefix?: string) => (
    <div className="min-w-0 space-y-1.5"><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="relative">{prefix && <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">{prefix}</span>}<Input type="number" min="0" value={Number.isFinite(value) ? value : 0} onChange={(event) => updateInputs(id, { [field]: numberValue(event.target.value) })} className={prefix ? 'pl-8' : ''} /></div></div>
  );

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><Wallet className="h-6 w-6 text-[#007EA7]" /><h1 className="text-2xl font-semibold tracking-tight">Deducciones de Nómina</h1></div><p className="mt-1 text-sm text-muted-foreground">Calcula, revisa y guarda la planilla por quincena.</p></div><div className="flex gap-2"><Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Button><Button className="gap-2 bg-[#80CED7] text-black hover:bg-[#007EA7]" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2200); }}><Save className="h-4 w-4" />Guardar periodo</Button></div></div>
    {saved && <div className="rounded-lg border border-[#80CED7]/40 bg-[#80CED7]/10 px-4 py-3 text-sm text-[#007EA7]">Periodo preparado para guardar en la pestaña Nomina_Deducciones del Google Sheet.</div>}
    {proratedRows.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Hay {proratedRows.length} empleado(s) con días prorrateados por fecha de ingreso o egreso. Revise el detalle antes de guardar.</div>}
    <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Filtros del periodo</CardTitle><Button size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="bg-[#80CED7] text-black hover:bg-[#007EA7] hover:text-white"><SlidersHorizontal className="mr-2 h-4 w-4" />{filtersOpen ? 'Ocultar' : 'Mostrar'} filtros<ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} /></Button></div></CardHeader>{filtersOpen && <CardContent className="grid gap-4 border-t pt-5 md:grid-cols-2 lg:grid-cols-5"><div><label className="text-xs font-medium text-muted-foreground">Restaurante</label><Select value={restaurant} onValueChange={setRestaurant}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{RESTAURANTS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div><label className="text-xs font-medium text-muted-foreground">Mes</label><Select value={month} onValueChange={setMonth}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2024, index).toLocaleString('es', { month: 'long' })}</SelectItem>)}</SelectContent></Select></div><div><label className="text-xs font-medium text-muted-foreground">Quincena</label><Select value={fortnight} onValueChange={(value: 'first' | 'second') => setFortnight(value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="first">1 al 15</SelectItem><SelectItem value="second">16 al último día</SelectItem></SelectContent></Select></div><div><label className="text-xs font-medium text-muted-foreground">Año</label><Input className="mt-1" value={year} onChange={(event) => setYear(event.target.value)} /></div><div><label className="text-xs font-medium text-muted-foreground">Buscar empleado</label><div className="relative mt-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o cédula" /></div></div><div className="md:col-span-2 lg:col-span-5 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"><FileText className="h-4 w-4 text-[#007EA7]" />Periodo: <strong>{period.start.toLocaleDateString('es-NI')} — {period.end.toLocaleDateString('es-NI')}</strong></div></CardContent>}</Card>
    <Tabs value={mode} onValueChange={(value) => setMode(value as 'table' | 'totals')}><TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-[#80CED7]/10 p-2 sm:grid-cols-2"><TabsTrigger value="table" className="gap-2 data-[state=active]:bg-[#80CED7] data-[state=active]:text-black"><Users className="h-4 w-4" />Tabla masiva</TabsTrigger><TabsTrigger value="totals" className="gap-2"><Wallet className="h-4 w-4" />Total por pagar</TabsTrigger></TabsList><TabsContent value="table" className="mt-4"><Card className="overflow-hidden border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Planilla del periodo <Badge variant="secondary" className="ml-2">{rows.length} empleados</Badge></CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-[#007EA7] text-white"><tr>{['Empleado','Cargo','Restaurante','Salario','Días','Devengado','INSS','IR','Otras','Deducciones','Neto',''].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left font-medium">{heading}</th>)}</tr></thead><tbody>{paginatedRows.map((row) => <tr key={row.id} className="border-b transition-colors hover:bg-muted/40"><td className="whitespace-nowrap px-4 py-3 font-medium">{row.nombreCompleto}</td><td className="px-4 py-3">{row.cargo || '-'}</td><td className="px-4 py-3">{row.restaurante}</td><td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.inputs.salarioMensual)}</td><td className="px-4 py-3">{row.inputs.diasLaborados}</td><td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.totalDevengado)}</td><td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.inssLaboral)}</td><td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.irLaboral)}</td><td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.otrasDeducciones)}</td><td className="whitespace-nowrap px-4 py-3">{formatCurrency(row.calculation.totalDeducciones)}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-[#007EA7]">{formatCurrency(row.calculation.netoPagar)}</td><td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => { setSelectedId(row.id); setDetailOpen(true); }}>Ver</Button></td></tr>)}</tbody><tfoot className="bg-muted/70 font-semibold"><tr><td className="px-4 py-3" colSpan={5}>Totales ({rows.length} empleados)</td><td className="px-4 py-3">{formatCurrency(totals.totalDevengado)}</td><td className="px-4 py-3">{formatCurrency(totals.inssLaboral)}</td><td className="px-4 py-3">{formatCurrency(totals.irLaboral)}</td><td className="px-4 py-3">{formatCurrency(totals.otrasDeducciones)}</td><td className="px-4 py-3">{formatCurrency(totals.totalDeducciones)}</td><td className="px-4 py-3 text-[#007EA7]">{formatCurrency(totals.netoPagar)}</td><td /></tr></tfoot></table>{rows.length > 0 && <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="text-muted-foreground">Filas por página</span><Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}><SelectTrigger className="h-8 w-[76px]"><SelectValue /></SelectTrigger><SelectContent>{PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center gap-3"><span className="text-muted-foreground">{rangeFrom}–{rangeTo} de {rows.length}</span><div className="flex items-center gap-1"><Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-[4.5rem] text-center text-muted-foreground">Pág. {currentPage} / {totalPages}</span><Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button></div></div></div>}</CardContent></Card></TabsContent><TabsContent value="employee" className="mt-4">{selected ? <EmployeeDetail row={selected} renderInput={renderInput} /> : <Card><CardContent className="p-8 text-center text-muted-foreground">No hay empleados para el filtro actual.</CardContent></Card>}</TabsContent><TabsContent value="totals" className="mt-4 space-y-6"><TotalsPayable rows={rows} totals={totals} /><RestaurantBreakdown rows={rows} /></TabsContent></Tabs>
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#007EA7]">Detalle del empleado</DialogTitle>
          <DialogDescription>Información laboral y desglose de nómina del periodo seleccionado.</DialogDescription>
        </DialogHeader>
        {selected ? <div className="space-y-6">
          <div className="grid gap-3 rounded-xl bg-[#80CED7]/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Nombre completo</p><p className="font-semibold">{selected.nombreCompleto}</p></div>
            <div><p className="text-xs text-muted-foreground">Cédula</p><p className="font-semibold">{selected.cedula}</p></div>
            <div><p className="text-xs text-muted-foreground">Cargo</p><p className="font-semibold">{selected.cargo || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Restaurante</p><p className="font-semibold">{selected.restaurante}</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[['Total devengado', selected.calculation.totalDevengado], ['Deducciones', selected.calculation.totalDeducciones], ['Neto a pagar', selected.calculation.netoPagar]].map(([label, value], index) => <Card key={String(label)} className={index === 2 ? 'border-[#80CED7] bg-[#80CED7]/10' : ''}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-[#007EA7]">{formatCurrency(Number(value))}</p></CardContent></Card>)}
          </div>
          <EmployeeDetail row={selected} renderInput={renderInput} />
        </div> : <p className="py-8 text-center text-muted-foreground">No hay empleado seleccionado.</p>}
      </DialogContent>
    </Dialog>
  </div>;
}

function EmployeeDetail({ row, renderInput }: { row: PayrollRow; renderInput: (label: string, field: keyof PayrollInputs, value: number, id: string, prefix?: string) => React.ReactNode }) {
  const c = row.calculation;
  return <div className="space-y-6"><Card className="min-w-0 border-0 shadow-sm"><CardHeader><CardTitle>{row.nombreCompleto}</CardTitle><p className="text-sm text-muted-foreground">{row.cargo || 'Sin cargo'} · {row.restaurante}</p></CardHeader><CardContent className="space-y-5"><div className="space-y-3"><p className="text-xs font-medium text-muted-foreground">Ingresos y extras</p><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{renderInput('Salario mensual', 'salarioMensual', row.inputs.salarioMensual, row.id, 'C$')}{renderInput('Días laborados', 'diasLaborados', row.inputs.diasLaborados, row.id)}{renderInput('Días de vacaciones', 'diasVacaciones', row.inputs.diasVacaciones, row.id)}{renderInput('Horas extra', 'horasExtra', row.inputs.horasExtra, row.id)}{renderInput('Otros ingresos', 'otrosIngresos', row.inputs.otrosIngresos, row.id, 'C$')}</div></div><Separator /><div className="space-y-3"><p className="text-xs font-medium text-muted-foreground">Deducciones</p><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{renderInput('Consumo', 'consumo', row.inputs.consumo, row.id, 'C$')}{renderInput('Mi Prestamito', 'prestamo', row.inputs.prestamo, row.id, 'C$')}{renderInput('GRECE Comida', 'greceComida', row.inputs.greceComida, row.id, 'C$')}{renderInput('Otros', 'otros', row.inputs.otros, row.id, 'C$')}</div></div></CardContent></Card><Card className="min-w-0 border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Desglose de nómina</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{[['Salario quincenal', c.salarioQuincenal],['Básico', c.basico],['Vacaciones', c.vacaciones],['Horas extra', c.horasExtraMonto],['Total devengado', c.totalDevengado],['INSS Laboral (7%)', -c.inssLaboral],['IR Laboral', -c.irLaboral],['Otras deducciones', -c.otrasDeducciones],['Neto a pagar', c.netoPagar]].map(([label, value], index) => <div key={String(label)} className={`flex justify-between ${index === 4 || index === 8 ? 'border-t pt-3 font-semibold' : ''}`}><span>{label}</span><span className={index === 8 ? 'text-lg text-[#007EA7]' : ''}>{formatCurrency(Number(value))}</span></div>)}<Separator /><p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Provisiones patronales</p><div className="grid grid-cols-3 gap-2 text-xs"><span>Aguinaldo<br /><strong>{formatCurrency(c.provisionAguinaldo)}</strong></span><span>Indemnización<br /><strong>{formatCurrency(c.provisionIndemnizacion)}</strong></span><span>Vacaciones<br /><strong>{formatCurrency(c.provisionVacaciones)}</strong></span></div></CardContent></Card></div>;
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
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-[#007EA7]" />Totales por Pagar</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(value))}</p></div>)}</div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Concepto</th><th className="py-2 text-right">Monto</th></tr></thead><tbody>{[['INSS laboral retenido', totals.inssLaboral],['IR retenido', totals.irLaboral],['Consumos y préstamos', totals.otrasDeducciones]].map(([label, value]) => <tr key={String(label)} className="border-b"><td className="py-2">{label}</td><td className="py-2 text-right">{formatCurrency(Number(value))}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">El resumen se calcula con los {rows.length} empleados activos del filtro actual y queda listo para exportar al periodo.</p></CardContent></Card>;
}