'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Eraser, RefreshCw, Save } from 'lucide-react';
import { calcularTotales, formatCurrency, PAYROLL_CONSTANTS, type PayrollInputs } from '@/lib/payroll-calculations';
import { inputsToForm, parseFormValues, sameInputs, type FormValues, type PayrollField } from '@/lib/payroll-validation';
import { formatDateTime, type PayrollRow, type SaveOutcome } from '@/components/payroll-shared';

// ── Campos del formulario del detalle, en el orden en que se muestran ────────
type FieldMeta = { field: PayrollField; title: string; hint: string; prefix?: string; suffix?: string; wide?: boolean };

// 1. Ingresos y extras
const SALARY_FIELDS: readonly FieldMeta[] = [
  { field: 'salarioMensual', title: 'Salario mensual', hint: 'Salario base del mes completo.', prefix: 'C$', wide: true },
  { field: 'diasLaborados', title: 'Días laborados', hint: 'Días trabajados en esta quincena.', suffix: 'días' },
  { field: 'diasVacaciones', title: 'Días de vacaciones', hint: 'Vacaciones pagadas (también si se pagan en efectivo).', suffix: 'días' },
];
const EXTRA_FIELDS: readonly FieldMeta[] = [
  { field: 'horasExtra', title: 'Horas extra', hint: 'Cantidad de horas, no monto.', suffix: 'horas' },
  { field: 'otrosIngresos', title: 'Otros ingresos', hint: 'Bonos u otros pagos de esta quincena.', prefix: 'C$' },
];
// 2. Deducciones (se restan del neto)
const DEDUCTION_FIELDS: readonly FieldMeta[] = [
  { field: 'consumo', title: 'Consumo', hint: 'Consumo en el restaurante a descontar.', prefix: 'C$' },
  { field: 'prestamo', title: 'Mi Prestamito', hint: 'Cuota de Mi Prestamito a descontar.', prefix: 'C$' },
  { field: 'greceComida', title: 'GRECE Comida', hint: 'Descuento de comida GRECE.', prefix: 'C$' },
  { field: 'otros', title: 'Otras deducciones', hint: 'Cualquier otra deducción.', prefix: 'C$' },
];
// "Limpiar" deja en cero extras y deducciones; salario y días laborados no se tocan.
const CLEARABLE_FIELDS: readonly PayrollField[] = [
  'diasVacaciones', 'horasExtra', 'otrosIngresos', 'consumo', 'prestamo', 'greceComida', 'otros',
];
const DEDUCTION_LABELS: Record<string, string> = {
  consumo: 'Consumo', prestamo: 'Mi Prestamito', greceComida: 'GRECE Comida', otros: 'Otros',
};

type Tone = 'income' | 'deduction';
const TONES: Record<Tone, { badge: string; box: string; total: string; focus: string }> = {
  income: { badge: 'bg-[#007EA7] text-white', box: 'border-[#80CED7]/60 bg-[#80CED7]/5', total: 'text-[#007EA7]', focus: 'focus-visible:ring-[#007EA7]' },
  deduction: { badge: 'bg-red-600 text-white', box: 'border-red-200 bg-red-50/40', total: 'text-red-700', focus: 'focus-visible:ring-red-500' },
};

function NumberField({ label, hint, prefix, suffix, value, error, tone, className, onChange }: {
  label: string; hint?: string; prefix?: string; suffix?: string; value: string; error?: string; tone: Tone; className?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return <div className={cn('min-w-0 space-y-2', className)}>
    <label htmlFor={id} className="block text-base font-semibold text-foreground">{label}</label>
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">{prefix}</span>}
      <Input
        id={id} inputMode="decimal" value={value} aria-invalid={!!error}
        onFocus={(event) => event.target.select()} onChange={(event) => onChange(event.target.value)}
        className={cn('h-14 rounded-xl bg-background text-xl font-semibold tabular-nums', prefix && 'pl-12', suffix && 'pr-20', TONES[tone].focus, error && 'border-red-500 focus-visible:ring-red-500')}
      />
      {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{suffix}</span>}
    </div>
    {error ? <p className="text-sm font-medium text-red-600">{error}</p> : hint && <p className="text-sm text-muted-foreground">{hint}</p>}
  </div>;
}

function FormSection({ step, title, description, summaryLabel, summaryValue, tone, children }: {
  step: number; title: string; description: string; summaryLabel: string; summaryValue: string; tone: Tone; children: ReactNode;
}) {
  const style = TONES[tone];
  return <section className={cn('rounded-2xl border p-5 sm:p-6', style.box)}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold', style.badge)}>{step}</span>
        <div>
          <h3 className="text-lg font-semibold leading-tight text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="rounded-xl bg-background px-4 py-2 text-right shadow-sm">
        <p className="text-xs text-muted-foreground">{summaryLabel}</p>
        <p className={cn('text-lg font-bold tabular-nums', style.total)}>{summaryValue}</p>
      </div>
    </header>
    <div className="mt-6 space-y-6">{children}</div>
  </section>;
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
  </div>;
}

function BreakdownBlock({ title, lines, totalLabel, total }: { title: string; lines: [string, number][]; totalLabel: string; total: number }) {
  return <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <div className="space-y-1.5 text-sm">
      {lines.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('whitespace-nowrap font-medium tabular-nums', value < 0 && 'text-red-600')}>{formatCurrency(value)}</span>
      </div>)}
    </div>
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 font-semibold">
      <span>{totalLabel}</span>
      <span className={cn('whitespace-nowrap tabular-nums', total < 0 && 'text-red-600')}>{formatCurrency(total)}</span>
    </div>
  </div>;
}

export function PayrollDetail({ row, periodLabel, fortnightLabel, canPersist, isSaving, onSave, onSaveDraft, onDiscardDraft, onReload, onClose }: {
  row: PayrollRow;
  periodLabel: string;
  fortnightLabel: string;
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
  // 2.7: pasantes/temporales que no cotizan. Por defecto SÍ cotizan INSS.
  const [excluirINSS, setExcluirINSS] = useState<boolean>(!!row.inputs.excluirINSS);

  const maxDays = row.eligibility.days;
  const parsed = useMemo(() => parseFormValues(form, maxDays, aplicaIR, excluirINSS), [form, maxDays, aplicaIR, excluirINSS]);
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

  const renderField = (meta: FieldMeta, tone: Tone) => (
    <NumberField
      key={meta.field} tone={tone} label={meta.title} prefix={meta.prefix} suffix={meta.suffix}
      hint={meta.field === 'diasLaborados' ? `${meta.hint} Le corresponden ${maxDays} de ${PAYROLL_CONSTANTS.fortnightDays}.` : meta.hint}
      className={meta.wide ? 'sm:col-span-2' : undefined}
      value={form[meta.field]} error={parsed.errors[meta.field]} onChange={(value) => setField(meta.field, value)}
    />
  );

  const savedAt = formatDateTime(row.status === 'saved' || row.status === 'draft' || row.status === 'conflict' ? row.version : null);
  const deductionRows: { label: string; amount: number }[] = c && parsed.values ? [
    ...(c.inssLaboral > 0 ? [{ label: `INSS laboral (${PAYROLL_CONSTANTS.employeeInssRate * 100}%)`, amount: c.inssLaboral }] : []),
    ...(c.irLaboral > 0 ? [{ label: 'IR laboral', amount: c.irLaboral }] : []),
    ...(['consumo', 'prestamo', 'greceComida', 'otros'] as const)
      .filter((field) => parsed.values![field] > 0)
      .map((field) => ({ label: DEDUCTION_LABELS[field], amount: parsed.values![field] })),
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
      {' '}{row.status === 'saved' ? 'Datos leídos de la hoja; puede modificarlos y guardar.' : hasDraft ? 'Hay cambios en borrador, todavía no guardados en la hoja.' : 'Aún no hay datos guardados para este periodo.'}
    </p>

    {row.issues.length > 0 && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{row.issues.join(' · ')}. Corrija la ficha del empleado para poder guardar.</div>}
    {row.warnings.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{row.warnings.join(' · ')}</div>}

    {c && parsed.values && <Card className="border-[#80CED7]/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Deducciones de esta quincena</CardTitle>
        <p className="text-xs text-muted-foreground">{fortnightLabel} · {periodLabel} · {savedAt ? `guardado el ${savedAt}` : 'aún sin guardar en la hoja'}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Tipo de deducción</th><th className="py-2">Fecha</th><th className="py-2 text-right">Quincenal</th><th className="py-2 text-right">Mensual (×2)</th>
          </tr></thead>
          <tbody>
            {deductionRows.map(({ label, amount }) => <tr key={label} className="border-b last:border-0">
              <td className="py-2 font-medium">{label}</td>
              <td className="py-2 text-muted-foreground">{periodLabel}</td>
              <td className="py-2 text-right">{formatCurrency(amount)}</td>
              <td className="py-2 text-right">{formatCurrency(amount * 2)}</td>
            </tr>)}
            {deductionRows.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">Sin deducciones en esta quincena.</td></tr>}
          </tbody>
          <tfoot><tr className="border-t font-semibold"><td className="py-2">Total deducciones</td><td /><td className="py-2 text-right">{formatCurrency(c.totalDeducciones)}</td><td className="py-2 text-right">{formatCurrency(c.totalDeducciones * 2)}</td></tr></tfoot>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">El monto mensual es el equivalente (dos quincenas iguales), solo como referencia.</p>
      </CardContent>
    </Card>}

    <div className="grid gap-4 md:grid-cols-3">
      {([['Total devengado', c?.totalDevengado], ['Deducciones', c?.totalDeducciones], ['Neto a pagar', c?.netoPagar]] as const).map(([label, value], index) => (
        <Card key={label} className={index === 2 ? 'border-[#80CED7] bg-[#80CED7]/10' : ''}>
          <CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-[#007EA7]">{value === undefined ? '—' : formatCurrency(value)}</p></CardContent>
        </Card>
      ))}
    </div>

    {/* Formulario (izquierda) + desglose en vivo (derecha, fijo al desplazarse en pantallas grandes) */}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 border-0 shadow-sm">
        <CardHeader><CardTitle>{row.nombreCompleto}</CardTitle><p className="text-sm text-muted-foreground">{row.cargo || 'Sin cargo'} · {row.restaurante}</p></CardHeader>
        <CardContent className="space-y-6">
          <FormSection
            step={1} tone="income" title="Ingresos y extras" description="Todo lo que se le paga al empleado en esta quincena."
            summaryLabel="Total devengado" summaryValue={c ? formatCurrency(c.totalDevengado) : '—'}
          >
            <FieldGroup title="Salario y tiempo trabajado">{SALARY_FIELDS.map((meta) => renderField(meta, 'income'))}</FieldGroup>
            <FieldGroup title="Pagos adicionales">{EXTRA_FIELDS.map((meta) => renderField(meta, 'income'))}</FieldGroup>
          </FormSection>

          <FormSection
            step={2} tone="deduction" title="Deducciones (se restan del neto)" description="Descuentos de esta quincena. El INSS y el IR se manejan abajo, en “Retenciones de ley”."
            summaryLabel="Total a descontar" summaryValue={c ? formatCurrency(c.otrasDeducciones) : '—'}
          >
            <FieldGroup title="Descuentos por concepto">{DEDUCTION_FIELDS.map((meta) => renderField(meta, 'deduction'))}</FieldGroup>
          </FormSection>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Retenciones de ley</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={cn('flex min-h-[72px] cursor-pointer items-start gap-3 rounded-lg border-2 p-4 text-sm', excluirINSS ? 'border-[#007EA7] bg-[#80CED7]/10' : 'border-muted')}>
                <input type="checkbox" className="mt-1 h-5 w-5" checked={excluirINSS} onChange={(event) => { setFeedback(null); setExcluirINSS(event.target.checked); }} />
                <span><span className="text-base font-medium">No cotiza INSS</span><br />
                  <span className="text-xs text-muted-foreground">Para pasantes o empleados temporales. Si se marca, no se deduce el INSS laboral ni se calcula el patronal.</span></span>
              </label>
              <label className={cn('flex min-h-[72px] cursor-pointer items-start gap-3 rounded-lg border-2 p-4 text-sm', aplicaIR ? 'border-[#007EA7] bg-[#80CED7]/10' : 'border-muted')}>
                <input type="checkbox" className="mt-1 h-5 w-5" checked={aplicaIR} onChange={(event) => { setFeedback(null); setAplicaIR(event.target.checked); }} />
                <span><span className="text-base font-medium">Retener IR laboral</span><br />
                  <span className="text-xs text-muted-foreground">Desactivado por defecto: solo se deduce el INSS. Actívelo solo si este empleado debe retener IR.</span></span>
              </label>
            </div>
          </div>
          {parsed.errors.general && <p className="text-sm text-red-600">{parsed.errors.general}</p>}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-0 shadow-sm lg:sticky lg:top-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Desglose de nómina</CardTitle>
          <p className="text-sm text-muted-foreground">Se actualiza mientras escribe.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {c ? <>
            <BreakdownBlock
              title="Ingresos" totalLabel="Total devengado" total={c.totalDevengado}
              lines={[['Salario quincenal', c.salarioQuincenal], ['Básico', c.basico], ['Vacaciones', c.vacaciones], ['Horas extra', c.horasExtraMonto]]}
            />
            <BreakdownBlock
              title="Retenciones y deducciones" totalLabel="Total deducciones" total={-c.totalDeducciones}
              lines={[
                [excluirINSS ? 'INSS Laboral (no cotiza)' : `INSS Laboral (${PAYROLL_CONSTANTS.employeeInssRate * 100}%)`, -c.inssLaboral],
                ...(aplicaIR ? [['IR Laboral', -c.irLaboral] as [string, number]] : []),
                ['Otras deducciones', -c.otrasDeducciones],
              ]}
            />
            <div className="rounded-2xl bg-[#007EA7] p-5 text-white">
              <p className="text-sm opacity-90">Neto a pagar</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{formatCurrency(c.netoPagar)}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provisiones patronales</p>
              <div className="space-y-1.5 text-sm">
                {([['Aguinaldo', c.provisionAguinaldo], ['Indemnización', c.provisionIndemnizacion], ['Vacaciones', c.provisionVacaciones]] as const).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-muted-foreground">{label}</span><strong className="whitespace-nowrap tabular-nums">{formatCurrency(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </> : <p className="text-sm text-muted-foreground">Corrija los campos marcados para ver el desglose.</p>}
        </CardContent>
      </Card>
    </div>

    {feedback && <div role="status" className={cn('flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm', feedback.kind === 'success' ? 'border-[#80CED7]/40 bg-[#80CED7]/10 text-[#007EA7]' : 'border-red-300 bg-red-50 text-red-700')}>
      <span>{feedback.text}</span>
      {feedback.kind === 'error' && <Button size="sm" variant="outline" className="gap-2" onClick={onReload}><RefreshCw className="h-4 w-4" />Recargar periodo</Button>}
    </div>}

    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
      <Button size="lg" variant="outline" className="h-12 gap-2 text-base" onClick={handleClear} disabled={isSaving}><Eraser className="h-4 w-4" />Limpiar extras y deducciones</Button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {hasDraft && <Button size="lg" className="h-12 text-base" variant="ghost" disabled={isSaving} onClick={onDiscardDraft}>Descartar borrador</Button>}
        <Button size="lg" className="h-12 text-base" variant="ghost" onClick={onClose}>Cerrar</Button>
        <Button size="lg" className="h-12 text-base" variant="outline" disabled={!canDraft || isSaving} onClick={() => parsed.values && onSaveDraft(parsed.values)}>Dejar en borrador</Button>
        <Button size="lg" className="h-12 gap-2 bg-[#80CED7] px-8 text-base text-black hover:bg-[#007EA7] hover:text-white" disabled={!canSave} onClick={handleSave}>
          <Save className="h-4 w-4" />{isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  </div>;
}
