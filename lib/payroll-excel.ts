// Archivo nuevo: lib/payroll-excel.ts
//
// Exporta la planilla del periodo a Excel (.xlsx). Usa los MISMOS datos que el reporte impreso
// (filas ya filtradas por restaurante/búsqueda) y los mismos totales (aggregateRows), así el Excel
// siempre coincide con lo que se ve en pantalla y en el PDF.
//
// Requiere la librería exceljs:   npm i exceljs
// Se importa de forma dinámica: solo se descarga cuando alguien pulsa "Excel".

import { aggregateRows, groupByRestaurant } from '@/lib/payroll-aggregates';
import { PAYROLL_CONSTANTS } from '@/lib/payroll-calculations';
import type { PayrollRow } from '@/components/payroll-shared';

export interface PayrollExcelOptions {
  rows: PayrollRow[];
  catalog: readonly string[];
  /** Ej.: "1.ª quincena de octubre 2026" */
  periodTitle: string;
  /** Ej.: "01/10/2026 — 15/10/2026" */
  periodLabel: string;
  restaurantFilter: string;
  companyName?: string;
}

const MONEY_FORMAT = '#,##0.00;[Red]-#,##0.00;"–"';
const BLUE = 'FF007EA7';
const LIGHT_BLUE = 'FF80CED7';
const PALE = 'FFEAF6F8';
const THIN = { style: 'thin' as const, color: { argb: 'FF9FB3BA' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const COLUMNS = [
  { header: '#', key: 'n', width: 5 },
  { header: 'Empleado', key: 'name', width: 34 },
  { header: 'Cédula', key: 'cedula', width: 20 },
  { header: 'Cargo', key: 'cargo', width: 22 },
  { header: 'Salario mensual', key: 'salario', width: 16 },
  { header: 'Días', key: 'dias', width: 7 },
  { header: 'Devengado', key: 'dev', width: 15 },
  { header: 'INSS', key: 'inss', width: 13 },
  { header: 'Consumo', key: 'consumo', width: 13 },
  { header: 'Mi Prestamito', key: 'prest', width: 15 },
  { header: 'Otros', key: 'otros', width: 13 },
  { header: 'Total deducciones', key: 'ded', width: 17 },
  { header: 'Neto a pagar', key: 'neto', width: 16 },
  { header: 'Estado', key: 'estado', width: 13 },
  { header: 'Recibí conforme (firma)', key: 'firma', width: 28 },
] as const;
const LAST_COL = COLUMNS.length;
const MONEY_COLS = [5, 7, 8, 9, 10, 11, 12, 13]; // columnas (1-based) con importes

const STATUS_LABEL: Record<PayrollRow['status'], string> = {
  saved: 'Guardado', pending: 'Sin guardar', draft: 'Borrador', conflict: 'Conflicto',
};

const safeFileName = (text: string) => text.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

export async function exportPayrollExcel({ rows, catalog, periodTitle, periodLabel, restaurantFilter, companyName = 'Grupo Barrio' }: PayrollExcelOptions) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = companyName;
  workbook.created = new Date();

  const groups = groupByRestaurant(rows, catalog);
  const totals = aggregateRows(rows);

  // ── Hoja 1: Planilla ─────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet('Planilla', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  sheet.columns = COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  const titleRow = sheet.addRow([`${companyName} — Planilla de deducciones`]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, LAST_COL);
  titleRow.getCell(1).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  titleRow.height = 26;
  titleRow.getCell(1).alignment = { vertical: 'middle', indent: 1 };

  const infoRow = sheet.addRow([`${periodTitle}  ·  ${periodLabel}  ·  Restaurante: ${restaurantFilter}  ·  Montos en córdobas (C$)  ·  ${totals.employees} empleado(s)`]);
  sheet.mergeCells(infoRow.number, 1, infoRow.number, LAST_COL);
  infoRow.getCell(1).font = { size: 10, color: { argb: 'FF14232B' } };
  infoRow.getCell(1).alignment = { indent: 1 };

  const unsaved = rows.filter((row) => row.status !== 'saved').length;
  const warnRow = sheet.addRow([unsaved > 0 ? `Atención: ${unsaved} empleado(s) aún no están guardados en la hoja DEDUCCIONES (columna Estado).` : '']);
  sheet.mergeCells(warnRow.number, 1, warnRow.number, LAST_COL);
  warnRow.getCell(1).font = { bold: true, color: { argb: 'FFB45309' } };
  warnRow.getCell(1).alignment = { indent: 1 };

  sheet.addRow([]);

  const styleHeader = (row: ReturnType<typeof sheet.addRow>) => {
    row.height = 30;
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = BORDER;
    });
  };
  // Fila 5: encabezado de columnas (queda congelado al desplazarse).
  styleHeader(sheet.addRow(COLUMNS.map((column) => column.header)));

  const moneyCells = (row: ReturnType<typeof sheet.addRow>, bold = false) => {
    MONEY_COLS.forEach((col) => {
      const cell = row.getCell(col);
      cell.numFmt = MONEY_FORMAT;
      cell.alignment = { horizontal: 'right' };
      if (bold) cell.font = { bold: true };
    });
  };

  groups.forEach((group) => {
    const groupRow = sheet.addRow([`${group.label} — ${group.rows.length} empleado(s)`]);
    sheet.mergeCells(groupRow.number, 1, groupRow.number, LAST_COL);
    groupRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF07323F' } };
    groupRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
    groupRow.getCell(1).alignment = { indent: 1 };

    const sorted = [...group.rows].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
    sorted.forEach((row, index) => {
      const c = row.calculation;
      const excelRow = sheet.addRow([
        index + 1, row.nombreCompleto, String(row.cedula ?? ''), row.cargo || '-',
        row.inputs.salarioMensual, row.inputs.diasLaborados, c.totalDevengado, c.inssLaboral,
        row.inputs.consumo, row.inputs.prestamo, row.inputs.otros,
        c.totalDeducciones, c.netoPagar, STATUS_LABEL[row.status], '',
      ]);
      excelRow.getCell(3).numFmt = '@'; // la cédula siempre como texto (no perder letra final ni ceros)
      excelRow.getCell(6).alignment = { horizontal: 'center' };
      excelRow.getCell(13).font = { bold: true };
      moneyCells(excelRow);
      excelRow.getCell(13).font = { bold: true };
      excelRow.eachCell({ includeEmpty: true }, (cell) => { cell.border = BORDER; });
      if (index % 2 === 1) excelRow.eachCell({ includeEmpty: true }, (cell, col) => { if (col < LAST_COL) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4FAFB' } }; });
    });

    const t = group.totals;
    const subtotal = sheet.addRow([
      `Subtotal ${group.label}`, '', '', '', t.salarioBase, '', t.totalDevengado, t.inssLaboral,
      t.consumo, t.prestamo, t.otros, t.totalDeducciones, t.netoPagar, '', '',
    ]);
    sheet.mergeCells(subtotal.number, 1, subtotal.number, 4);
    moneyCells(subtotal, true);
    subtotal.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } };
      cell.border = BORDER;
      cell.font = { bold: true };
    });
    sheet.addRow([]);
  });

  const grand = sheet.addRow([
    `Total general (${totals.employees} empleados)`, '', '', '', totals.salarioBase, '', totals.totalDevengado, totals.inssLaboral,
    totals.consumo, totals.prestamo, totals.otros, totals.totalDeducciones, totals.netoPagar, '', '',
  ]);
  sheet.mergeCells(grand.number, 1, grand.number, 4);
  moneyCells(grand, true);
  grand.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = BORDER;
  });

  // ── Hoja 2: Resumen ──────────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Resumen', {
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  summary.columns = [{ width: 34 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }];

  const section = (title: string) => {
    const row = summary.addRow([title]);
    summary.mergeCells(row.number, 1, row.number, 5);
    row.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    row.getCell(1).alignment = { indent: 1 };
  };
  const line = (label: string, value: number, note = '', bold = false) => {
    const row = summary.addRow([label, note, value]);
    row.getCell(3).numFmt = MONEY_FORMAT;
    row.getCell(3).alignment = { horizontal: 'right' };
    row.eachCell({ includeEmpty: true }, (cell, col) => { if (col <= 3) cell.border = BORDER; });
    if (bold) row.eachCell((cell) => { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } }; });
  };

  section(`${periodTitle} — ${periodLabel}`);
  summary.addRow([]);
  section('Pago a empleados');
  line('Total devengado', totals.totalDevengado);
  line('− INSS laboral', totals.inssLaboral);
  line('− Consumo', totals.consumo);
  line('− Mi Prestamito', totals.prestamo);
  line('− Otras deducciones', totals.otros);
  line('Total deducciones', totals.totalDeducciones, '', true);
  line('Salario por pagar', totals.netoPagar, '', true);
  summary.addRow([]);
  section('Costo para la empresa');
  line('Total devengado', totals.totalDevengado);
  line('INSS patronal', totals.inssPatronal, `${Math.round(PAYROLL_CONSTANTS.employerInssRate * 1000) / 10}%`);
  line('INATEC', totals.inatec, `${Math.round(PAYROLL_CONSTANTS.inatecRate * 1000) / 10}%`);
  line('Aguinaldo', totals.provisionAguinaldo, 'provisión');
  line('Indemnización', totals.provisionIndemnizacion, 'provisión');
  line('Vacaciones', totals.provisionVacaciones, 'provisión');
  line('Costo total del periodo', totals.costoEmpresa, '', true);
  summary.addRow([]);
  section('Resumen por restaurante');
  const head = summary.addRow(['Restaurante', 'Empleados', 'Devengado', 'Deducciones', 'Neto a pagar']);
  head.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } };
    cell.border = BORDER;
    cell.alignment = { horizontal: 'center' };
  });
  [...groups.map((group) => ({ label: group.label, t: group.totals })), { label: 'Total', t: totals }].forEach(({ label, t }, index, all) => {
    const row = summary.addRow([label, t.employees, t.totalDevengado, t.totalDeducciones, t.netoPagar]);
    [3, 4, 5].forEach((col) => { row.getCell(col).numFmt = MONEY_FORMAT; });
    row.eachCell((cell) => { cell.border = BORDER; });
    if (index === all.length - 1) row.eachCell((cell) => { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } }; });
  });

  // ── Descarga ─────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(`Planilla ${periodTitle}${restaurantFilter !== 'Todos' ? ` - ${restaurantFilter}` : ''}`)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
