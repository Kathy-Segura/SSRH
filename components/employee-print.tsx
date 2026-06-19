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

// Función auxiliar — agrégala arriba del componente o en un utils
const formatearFecha = (fecha: string | undefined): string => {
  if (!fecha) return '<span class="empty">No registrado</span>';

  // Soporta formatos DD/MM/YYYY y YYYY-MM-DD
  const partesBarra = fecha.split('/');
  const partesGuion = fecha.split('-');

  let dia: string, mes: string, anio: string;

  if (partesBarra.length === 3) {
    // Asume DD/MM/YYYY (formato nicaragüense)
    [dia, mes, anio] = partesBarra;
  } else if (partesGuion.length === 3) {
    // Asume YYYY-MM-DD (formato ISO de inputs tipo date)
    [anio, mes, dia] = partesGuion;
  } else {
    return fecha; // Si no reconoce el formato, devuelve tal cual
  }

  const meses = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ];

  const nombreMes = meses[parseInt(mes, 10) - 1] ?? mes;
  return `${parseInt(dia, 10)} de ${nombreMes} de ${anio}`;
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
        color: #1a2a3a;
        background: #f0f7fc;
        padding: 32px 40px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #0e7bb5;
        padding-bottom: 14px;
        margin-bottom: 22px;
      }
      .header-identity { display: flex; align-items: center; gap: 10px; }
      .avatar {
        width: 40px; height: 40px; border-radius: 50%;
        background: #0e7bb5;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 700; color: #fff;
        flex-shrink: 0;
      }
      .header-left h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: #0a4d72; }
      .header-left p  { font-size: 11px; color: #3a7ca5; margin-top: 2px; }
      .header-right   { text-align: right; font-size: 11px; color: #5a8fa8; }
      .badge {
        display: inline-block;
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid;
      }
      .badge-activo   { background: #d0eef9; color: #0a4d72; border-color: #7ec8e3; }
      .badge-inactivo { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
      .section        { margin-bottom: 18px; }
      .section-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #0e7bb5;
        border-bottom: 1px solid #b3d9ee;
        padding-bottom: 4px;
        margin-bottom: 12px;
      }
      .grid   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px; }
      .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 16px; }
      .field label {
        display: block;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #5a8fa8;
        margin-bottom: 2px;
      }
      .field span       { font-size: 12px; color: #1a2a3a; }
      .field span.empty { color: #bbb; font-style: italic; }
      .obs-box {
        border: 1px solid #b3d9ee;
        border-radius: 6px;
        padding: 10px 12px;
        min-height: 52px;
        font-size: 12px;
        line-height: 1.6;
        background: #fff;
      }
      .footer {
        margin-top: 28px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0 24px;
      }
      .firma-line {
        border-top: 1px solid #7ec8e3;
        padding-top: 5px;
        font-size: 10px;
        color: #5a8fa8;
        text-align: center;
      }
      @media print {
        body { background: #fff; padding: 20px 28px; }
        @page { size: A4; margin: 1cm; }
      }
    </style>
  </head>
  <body>

    <div class="header">
      <div class="header-identity">
        <div class="avatar">${employee.nombreCompleto.split(' ').map((n: string) => n[0]).slice(0,2).join('')}</div>
        <div class="header-left">
          <h1>${employee.nombreCompleto}</h1>
          <p>${employee.cargo} &nbsp;·&nbsp; ${employee.restaurante}</p>
        </div>
      </div>
      <div class="header-right">
        <span class="badge badge-${employee.estado}">
          ● ${employee.estado === 'activo' ? 'Activo' : 'Inactivo'}
        </span>
        <p style="margin-top:6px;">Ficha generada: ${new Date().toLocaleDateString('es-NI')}</p>
      </div>
    </div>
  
  <div class="section">
    <div class="section-title">Información Personal</div>
      <div class="grid">
        <div class="field"><label>Número de cedula</label>
         <span>${employee.cedula}</div>
        <div class="field"><label>Fecha de Nacimiento</label>
          <span>${formatearFecha(employee.cumpleanos) ||'<span class="empty">No registrado</span>'}</span></div>
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
      <div class="grid">
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
      <Printer className="w-4 h-4 text-color:blue-200" />
    </Button>
  );
}