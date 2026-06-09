'use client';
/**
  COMPONENTE ENCARGADO DE IMPRIMIR LA FICHA INDIVIDUAL DE UN EMPLEADO
  GENERA UNA VENTANA DE IMPRESIÓN CON EL FORMATO COMPLETO DEL EMPLEADO
/**/

import { Employee } from '@/types/employee';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface EmployeePrintButtonProps {
  employee: Employee;
}

const estadoCivilMap: Record<string, string> = {
  soltero: 'Soltero/a',
  casado: 'Casado/a',
  divorciado: 'Divorciado/a',
  viudo: 'Viudo/a',
};

const generatePrintHTML = (employee: Employee): string => `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Ficha Empleado — ${employee.nombreCompleto}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 12px;
        color: #1a1a1a;
        padding: 32px 40px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #1a1a1a;
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      .header-left h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
      .header-left p  { font-size: 11px; color: #555; margin-top: 2px; }
      .header-right   { text-align: right; font-size: 11px; color: #555; }
      .badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        margin-top: 4px;
      }
      .badge-activo   { background: #dcfce7; color: #166534; }
      .badge-inactivo { background: #fee2e2; color: #991b1b; }
      .section        { margin-bottom: 18px; }
      .section-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #888;
        border-bottom: 0.5px solid #ddd;
        padding-bottom: 4px;
        margin-bottom: 10px;
      }
      .grid   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px; }
      .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 16px; }
      .field label {
        display: block;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #999;
        margin-bottom: 2px;
      }
      .field span       { font-size: 12px; color: #1a1a1a; }
      .field span.empty { color: #bbb; font-style: italic; }
      .obs-box {
        border: 0.5px solid #ddd;
        border-radius: 4px;
        padding: 8px 10px;
        min-height: 48px;
        font-size: 12px;
        line-height: 1.5;
      }
      .footer {
        margin-top: 28px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0 24px;
      }
      .firma-line {
        border-top: 0.5px solid #aaa;
        padding-top: 4px;
        font-size: 10px;
        color: #888;
        text-align: center;
      }
      @media print {
        body { padding: 20px 28px; }
        @page { size: A4; margin: 1cm; }
      }
    </style>
  </head>
  <body>

    <div class="header">
      <div class="header-left">
        <h1>${employee.nombreCompleto}</h1>
        <p>${employee.cargo} &nbsp;·&nbsp; ${employee.restaurante}</p>
      </div>
      <div class="header-right">
        <div>Cédula: <strong>${employee.cedula}</strong></div>
        <div>INSS: <strong>${employee.inss || '—'}</strong></div>
        <span class="badge badge-${employee.estado}">
          ${employee.estado === 'activo' ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Información Personal</div>
      <div class="grid">
        <div class="field"><label>Fecha de Nacimiento</label>
          <span>${employee.cumpleanos || '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Estado Civil</label>
          <span>${estadoCivilMap[employee.estadoCivil] ?? employee.estadoCivil}</span></div>
        <div class="field"><label>Teléfono</label>
          <span>${employee.numeroTelefono || '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Teléfono de Emergencia</label>
          <span>${employee.numeroEmergencia || '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Dirección</label>
          <span>${employee.direccion || '<span class="empty">No registrado</span>'}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Información Laboral</div>
      <div class="grid">
        <div class="field"><label>Fecha de Ingreso</label>
          <span>${employee.fechaIngreso || '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Fecha de Egreso</label>
          <span>${employee.fechaEgreso || '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Fecha de Retiro</label>
          <span>${employee.fechaRetiro || '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Días Trabajados</label>
          <span>${employee.diasTrabajados ?? '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Salario</label>
          <span>${employee.salario ? `C$ ${employee.salario.toLocaleString('es-NI')}` : '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>Beneficios</label>
          <span>${employee.beneficios || '<span class="empty">No registrado</span>'}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Información Financiera</div>
      <div class="grid-2">
        <div class="field"><label>Cuenta BAC</label>
          <span>${employee.cuentaBac || '<span class="empty">No registrado</span>'}</span></div>
        <div class="field"><label>INSS</label>
          <span>${employee.inss || '<span class="empty">No registrado</span>'}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Observaciones</div>
      <div class="obs-box">
        ${employee.observaciones || '<span style="color:#bbb;font-style:italic;">Sin observaciones</span>'}
      </div>
    </div>
  </body>
  </html>
`;

export function EmployeePrintButton({ employee }: EmployeePrintButtonProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(generatePrintHTML(employee));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      className="p-1 h-auto"
      title="Imprimir ficha del empleado"
    >
      <Printer className="w-4 h-4 text-accent" />
    </Button>
  );
}