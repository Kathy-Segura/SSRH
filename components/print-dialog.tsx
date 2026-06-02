'use client';
/**
  COMPONENTE ENCARGADO DE MOSTRAR EL PREVIEW DEL REPORTE E IMPRIMIR EL PDF.
  FORMULARIO DE PREVIEW ANTES DE ENTRAR AL CUADRO DE IMPRESION.
/**/
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Employee } from '@/types/employee';
import { Printer } from 'lucide-react';

interface PrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  filters: Record<string, string>;
}

export function PrintDialog({
  isOpen,
  onClose,
  employees,
  filters,
}: PrintDialogProps) {
  const handleDownloadPDF = () => {
    const filterText = Object.entries(filters)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Empleados - Sistema RRHH</title>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #ffffff;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 30px 20px;
          }
          .header {
            border-bottom: 3px solid #80CED7;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header-title {
            text-align: center;
            color: #007EA7;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .header-subtitle {
            text-align: center;
            color: #80CED7;
            font-size: 14px;
            font-weight: 500;
          }
          .report-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding: 15px;
            background-color: #f0f9fb;
            border-radius: 8px;
            border-left: 4px solid #80CED7;
          }
          .report-date {
            font-size: 13px;
            color: #555;
          }
          .report-count {
            font-size: 13px;
            color: #007EA7;
            font-weight: 600;
          }
          .filter-info {
            background: linear-gradient(135deg, rgba(128, 206, 215, 0.1) 0%, rgba(0, 126, 167, 0.05) 100%);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #80CED7;
          }
          .filter-info strong {
            color: #007EA7;
            font-weight: 600;
          }
          .filter-info p {
            color: #666;
            font-size: 13px;
            margin-top: 8px;
            word-break: break-word;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0, 126, 167, 0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          thead {
            background: linear-gradient(135deg, #80CED7 0%, #007EA7 100%);
            color: white;
          }
          th {
            padding: 16px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 14px 16px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          tbody tr {
            transition: background-color 0.2s;
          }
          tbody tr:nth-child(odd) {
            background-color: #f9fbfc;
          }
          tbody tr:nth-child(even) {
            background-color: #ffffff;
          }
          tbody tr:last-child td {
            border-bottom: none;
          }
          .status-active {
            background-color: #d4f5ed;
            color: #0d6e4f;
            padding: 6px 10px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            display: inline-block;
          }
          .status-inactive {
            background-color: #fce4e6;
            color: #831b1b;
            padding: 6px 10px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            display: inline-block;
          }
          .footer {
            border-top: 2px solid #80CED7;
            padding-top: 20px;
            margin-top: 20px;
            text-align: right;
          }
          .footer-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #666;
          }
          .total-records {
            font-weight: 600;
            color: #007EA7;
            font-size: 14px;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
            .container {
              padding: 20px;
            }
            table {
              box-shadow: none;
            }
            thead {
              page-break-after: avoid;
            }
            tbody tr {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-title">📊 Reporte de Empleados</div>
            <div class="header-subtitle">Sistema de Gestión de Recursos Humanos</div>
          </div>
          
          <div class="report-info">
            <div class="report-date">
              <strong>Fecha de generación:</strong> ${new Date().toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })} a las ${new Date().toLocaleTimeString('es-ES')}
            </div>
            <div class="report-count">
              <strong>Total de registros:</strong> ${employees.length}
            </div>
          </div>

          ${
            filterText
              ? `<div class="filter-info">
                  <strong>Filtros aplicados:</strong>
                  <p>${filterText}</p>
                </div>`
              : ''
          }

          <table>
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombre Completo</th>
                <th>Cargo</th>
                <th>Restaurante</th>
                <th>Teléfono</th>
                <th>Estado Civil</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${employees
                .map(
                  (emp) => `
                <tr>
                  <td><strong>${emp.cedula}</strong></td>
                  <td>${emp.nombreCompleto}</td>
                  <td>${emp.cargo || '-'}</td>
                  <td>${emp.restaurante || '-'}</td>
                  <td>${emp.numeroTelefono || '-'}</td>
                  <td>${emp.estadoCivil || '-'}</td>
                  <td><span class="status-${emp.estado}">${emp.estado === 'activo' ? '✓ Activo' : '✗ Inactivo'}</span></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="footer">
            <div class="footer-info">
              <span>Reporte generado por: Sistema RRHH</span>
              <span class="total-records">Total: ${employees.length} empleado${employees.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Crear blob y descargar
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Crear elemento iframe para descargar
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    
    // Esperar a que cargue el iframe
    iframe.onload = () => {
      iframe.contentWindow?.print();
      
      // Cerrar después de un tiempo para permitir que se complete la impresión
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
        onClose();
      }, 1000);
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[#007EA7]">Generar Reporte de Empleados</DialogTitle>
          <DialogDescription>
            Se imprimirá un reporte con {employees.length} empleado
            {employees.length !== 1 ? 's' : ''} basado en los filtros.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-[#80CED7]/10 p-4 rounded-lg border border-[#80CED7]/30">
            <p className="text-sm text-gray-700">
              El reporte incluirá todos los registros de empleados que coinciden con los filtros
              aplicados. Se abrirá una ventana de impresión en tu navegador.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="border-[#80CED7]/50 text-black hover:bg-[#80CED7]/10">
              Cancelar
            </Button>
            <Button
              onClick={handleDownloadPDF}
              className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
            >
              <Printer className="w-4 h-4" />
              Descargar e Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
