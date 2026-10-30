'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PAYROLL_CONSTANTS } from '@/lib/payroll-calculations';
import { aggregateRows, groupByRestaurant, type PayrollTotals } from '@/lib/payroll-aggregates';
import { formatPercent, type PayrollRow } from '@/components/payroll-shared';

// Reporte impreso de la planilla del periodo (hoja carta horizontal).
// Se dibuja en un portal colgado de <body>: al imprimir se oculta todo lo demás de la aplicación
// (menús, filtros, pestañas), así que sale solo el reporte, sin importar en qué pantalla esté.

const number = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (value: number) => (value === 0 ? '–' : number.format(value));
const total = (value: number) => number.format(value);

const PRINT_CSS = `
#payroll-print-portal { display: none; }
@media print {
  @page { size: letter landscape; margin: 10mm; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body > *:not(#payroll-print-portal) { display: none !important; }
  #payroll-print-portal { display: block; color: #14232b; font-size: 8pt; line-height: 1.35; }
  #payroll-print-portal * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #payroll-print-portal table { width: 100%; border-collapse: collapse; }
  #payroll-print-portal th, #payroll-print-portal td { border: 0.5pt solid #9fb3ba; padding: 2pt 4pt; vertical-align: middle; }
  #payroll-print-portal .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  #payroll-print-portal .nowrap { white-space: nowrap; }

  .pr-head { display: flex; justify-content: space-between; align-items: stretch; gap: 10pt; margin-bottom: 8pt; }
  .pr-title { flex: 1; background: #007EA7; color: #fff; padding: 8pt 12pt; border-radius: 3pt; }
  .pr-title .pr-company { font-size: 8pt; opacity: .9; margin: 0; }
  .pr-title h1 { font-size: 16pt; line-height: 1.15; margin: 1pt 0; font-weight: 700; }
  .pr-title .pr-sub { font-size: 10pt; margin: 0; }
  .pr-meta { width: 46%; }
  .pr-meta th { background: #EAF6F8; text-align: left; width: 22%; font-weight: 600; }

  .pr-warn { border: 0.75pt solid #d97706; background: #FEF3C7; padding: 4pt 8pt; margin: 0 0 8pt; font-weight: 600; }

  .pr-summary { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 10pt; margin-bottom: 10pt; align-items: start; break-inside: avoid; }
  .pr-box-title { margin: 0 0 3pt; font-size: 9pt; font-weight: 700; color: #00536F; }
  .pr-summary th { background: #EAF6F8; text-align: left; font-weight: 600; }
  .pr-summary .pr-key td, .pr-summary .pr-key th { background: #007EA7; color: #fff; font-weight: 700; }
  .pr-summary .pr-sub-row th, .pr-summary .pr-sub-row td { font-weight: 700; background: #F4FAFB; }
  .pr-summary .pr-muted { color: #5b6f77; font-weight: 400; }

  .pr-group { margin-bottom: 10pt; }
  .pr-group-title { display: flex; justify-content: space-between; margin: 0; padding: 3pt 6pt; font-size: 10pt; font-weight: 700; background: #80CED7; color: #07323f; border: 0.5pt solid #5aa9b4; break-after: avoid; }
  .pr-table { table-layout: fixed; }
  .pr-table thead { display: table-header-group; }
  .pr-table tfoot { display: table-row-group; }
  .pr-table tr { break-inside: avoid; }
  .pr-table thead th { background: #007EA7; color: #fff; font-weight: 600; text-align: center; font-size: 7pt; border-color: #00688a; }
  .pr-table tbody td { height: 16pt; }
  .pr-table tbody tr:nth-child(even) td { background: #F4FAFB; }
  .pr-table tfoot td { background: #EAF6F8; font-weight: 700; }
  .pr-table .pr-grand td { background: #007EA7; color: #fff; font-weight: 700; border-color: #00688a; }
  .pr-table .pr-id { font-size: 7pt; }
  .pr-name { font-weight: 600; }
  .pr-sign { background: #fff !important; }

  .pr-legend { margin: 4pt 0 0; font-size: 7pt; color: #5b6f77; }
  .pr-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16pt; margin-top: 18pt; break-inside: avoid; }
  .pr-signature { border: 0.5pt solid #9fb3ba; height: 52pt; padding: 4pt 6pt; position: relative; }
  .pr-signature span { position: absolute; left: 6pt; right: 6pt; bottom: 4pt; border-top: 0.5pt solid #14232b; padding-top: 2pt; font-size: 7pt; text-align: center; }
}
`;

type Props = {
  rows: PayrollRow[];
  catalog: readonly string[];
  /** Ej.: "1.ª quincena de octubre 2026" */
  periodTitle: string;
  /** Ej.: "01/10/2026 — 15/10/2026" */
  periodLabel: string;
  restaurantFilter: string;
  unsavedCount: number;
  companyName?: string;
  /** Columna "Recibí conforme" para que el empleado firme al recibir su pago. */
  showSignatureColumn?: boolean;
  /** Se llama al cerrar el diálogo de impresión. */
  onDone: () => void;
};

// Anchos de columna (suman 100). Sin la columna de firma, su ancho se reparte en el nombre.
const COLUMNS: { key: string; label: string; width: number }[] = [
  { key: 'n', label: '#', width: 2.5 },
  { key: 'name', label: 'Empleado', width: 17 },
  { key: 'cedula', label: 'Cédula', width: 10 },
  { key: 'cargo', label: 'Cargo', width: 9 },
  { key: 'salario', label: 'Salario mensual', width: 6.5 },
  { key: 'dias', label: 'Días', width: 3 },
  { key: 'dev', label: 'Devengado', width: 6.5 },
  { key: 'inss', label: 'INSS', width: 5 },
  { key: 'consumo', label: 'Consumo', width: 5 },
  { key: 'prest', label: 'Mi Prestamito', width: 5 },
  { key: 'otros', label: 'Otros', width: 4.5 },
  { key: 'ded', label: 'Total deducciones', width: 6.5 },
  { key: 'neto', label: 'Neto a pagar', width: 7 },
  { key: 'firma', label: 'Recibí conforme (firma)', width: 12.5 },
];

function TotalsCells({ t }: { t: PayrollTotals }) {
  return <>
    <td className="num">{total(t.salarioBase)}</td><td />
    <td className="num">{total(t.totalDevengado)}</td><td className="num">{total(t.inssLaboral)}</td>
    <td className="num">{total(t.consumo)}</td><td className="num">{total(t.prestamo)}</td><td className="num">{total(t.otros)}</td>
    <td className="num">{total(t.totalDeducciones)}</td><td className="num">{total(t.netoPagar)}</td>
  </>;
}

export function PayrollPrintReport({
  rows, catalog, periodTitle, periodLabel, restaurantFilter, unsavedCount, companyName = 'Grupo Barrio', showSignatureColumn = true, onDone,
}: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);

  const groups = useMemo(() => groupByRestaurant(rows, catalog), [rows, catalog]);
  const totals = useMemo(() => aggregateRows(rows), [rows]);
  const printedAt = useMemo(() => new Date().toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' }), []);
  const columns = useMemo(() => {
    if (showSignatureColumn) return COLUMNS;
    const freed = COLUMNS[COLUMNS.length - 1].width;
    return COLUMNS.slice(0, -1).map((column) => (column.key === 'name' ? { ...column, width: column.width + freed } : column));
  }, [showSignatureColumn]);
  const hasUnsaved = rows.some((row) => row.status !== 'saved');

  // Abre el diálogo de impresión cuando el reporte ya está pintado; el nombre del PDF sale del título.
  useEffect(() => {
    if (!host) return;
    const previousTitle = document.title;
    document.title = `Planilla ${periodTitle}`;
    const finish = () => { document.title = previousTitle; onDone(); };
    window.addEventListener('afterprint', finish, { once: true });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finish);
      document.title = previousTitle;
    };
    // Solo al montar: el reporte es una foto de lo que había en pantalla al pulsar "Imprimir".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const payLines: [string, number][] = [
    ['INSS laboral', totals.inssLaboral], ['Consumo', totals.consumo],
    ['Mi Prestamito', totals.prestamo], ['Otras deducciones', totals.otros],
  ];
  const costLines: [string, string, number][] = [
    ['INSS patronal', formatPercent(PAYROLL_CONSTANTS.employerInssRate), totals.inssPatronal],
    ['INATEC', formatPercent(PAYROLL_CONSTANTS.inatecRate), totals.inatec],
    ['Aguinaldo', 'provisión', totals.provisionAguinaldo],
    ['Indemnización', 'provisión', totals.provisionIndemnizacion],
    ['Vacaciones', 'provisión', totals.provisionVacaciones],
  ];

  return createPortal(
    <div id="payroll-print-portal">
      <style>{PRINT_CSS}</style>

      <header className="pr-head">
        <div className="pr-title">
          <p className="pr-company">{companyName}</p>
          <h1>Planilla de deducciones</h1>
          <p className="pr-sub">{periodTitle}</p>
        </div>
        <table className="pr-meta">
          <tbody>
            <tr><th>Fechas</th><td>{periodLabel}</td><th>Restaurante</th><td>{restaurantFilter === 'Todos' ? 'Todos' : restaurantFilter}</td></tr>
            <tr><th>Empleados</th><td>{totals.employees}</td><th>Montos</th><td>Córdobas (C$)</td></tr>
            <tr><th>Impreso</th><td colSpan={3}>{printedAt}</td></tr>
          </tbody>
        </table>
      </header>

      {unsavedCount > 0 && <p className="pr-warn">Atención: este reporte incluye {unsavedCount} empleado(s) que aún no están guardados en la hoja (marcados con *).</p>}

      <section className="pr-summary">
        <div>
          <p className="pr-box-title">Pago a empleados</p>
          <table><tbody>
            <tr><th>Total devengado</th><td className="num">{total(totals.totalDevengado)}</td></tr>
            {payLines.map(([label, value]) => <tr key={label}><th className="pr-muted">− {label}</th><td className="num">{total(value)}</td></tr>)}
            <tr className="pr-sub-row"><th>Total deducciones</th><td className="num">{total(totals.totalDeducciones)}</td></tr>
            <tr className="pr-key"><th>Salario por pagar</th><td className="num">{total(totals.netoPagar)}</td></tr>
          </tbody></table>
        </div>
        <div>
          <p className="pr-box-title">Costo para la empresa</p>
          <table><tbody>
            <tr><th>Total devengado</th><td className="num">{total(totals.totalDevengado)}</td></tr>
            {costLines.map(([label, note, value]) => <tr key={label}><th>{label} <span className="pr-muted">{note}</span></th><td className="num">{total(value)}</td></tr>)}
            <tr className="pr-key"><th>Costo total del periodo</th><td className="num">{total(totals.costoEmpresa)}</td></tr>
          </tbody></table>
        </div>
        <div>
          <p className="pr-box-title">Resumen por restaurante</p>
          <table>
            <thead><tr>
              <th>Restaurante</th><th className="num">Emp.</th><th className="num">Devengado</th><th className="num">Deducciones</th><th className="num">Neto</th>
            </tr></thead>
            <tbody>
              {groups.map((group) => <tr key={group.key}>
                <td>{group.label}</td><td className="num">{group.totals.employees}</td><td className="num">{total(group.totals.totalDevengado)}</td>
                <td className="num">{total(group.totals.totalDeducciones)}</td><td className="num">{total(group.totals.netoPagar)}</td>
              </tr>)}
              <tr className="pr-key">
                <th>Total</th><td className="num">{totals.employees}</td><td className="num">{total(totals.totalDevengado)}</td>
                <td className="num">{total(totals.totalDeducciones)}</td><td className="num">{total(totals.netoPagar)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {groups.map((group) => {
        const sorted = [...group.rows].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
        return <section className="pr-group" key={group.key}>
          <h2 className="pr-group-title"><span>{group.label}</span><span>{group.rows.length} empleado(s)</span></h2>
          <table className="pr-table">
            <colgroup>{columns.map((column) => <col key={column.key} style={{ width: `${column.width}%` }} />)}</colgroup>
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>
              {sorted.map((row, index) => <tr key={row.id}>
                <td className="num">{index + 1}</td>
                <td className="pr-name">{row.nombreCompleto}{row.status !== 'saved' ? ' *' : ''}</td>
                <td className="pr-id nowrap">{row.cedula}</td>
                <td>{row.cargo || '-'}</td>
                <td className="num">{total(row.inputs.salarioMensual)}</td>
                <td className="num">{row.inputs.diasLaborados}</td>
                <td className="num">{total(row.calculation.totalDevengado)}</td>
                <td className="num">{amount(row.calculation.inssLaboral)}</td>
                <td className="num">{amount(row.inputs.consumo)}</td>
                <td className="num">{amount(row.inputs.prestamo)}</td>
                <td className="num">{amount(row.inputs.otros)}</td>
                <td className="num">{total(row.calculation.totalDeducciones)}</td>
                <td className="num"><strong>{total(row.calculation.netoPagar)}</strong></td>
                {showSignatureColumn && <td className="pr-sign" />}
              </tr>)}
            </tbody>
            <tfoot><tr>
              <td colSpan={4}>Subtotal {group.label}</td>
              <TotalsCells t={group.totals} />
              {showSignatureColumn && <td />}
            </tr></tfoot>
          </table>
        </section>;
      })}

      <table className="pr-table">
        <colgroup>{columns.map((column) => <col key={column.key} style={{ width: `${column.width}%` }} />)}</colgroup>
        <tfoot><tr className="pr-grand">
          <td colSpan={4}>Total general ({totals.employees} empleados)</td>
          <TotalsCells t={totals} />
          {showSignatureColumn && <td />}
        </tr></tfoot>
      </table>

      {hasUnsaved && <p className="pr-legend">* Empleado sin guardar en la hoja DEDUCCIONES: los montos corresponden a los valores en pantalla al imprimir.</p>}

      <div className="pr-signatures">
        {['Elaborado por', 'Revisado por', 'Autorizado por'].map((label) => <div className="pr-signature" key={label}><span>{label}: nombre, firma y fecha</span></div>)}
      </div>
    </div>,
    host
  );
}
