'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Employee } from '@/types/employee';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

interface EmployeeTableProps {
  employees: Employee[];
  isLoading?: boolean;
  onEdit?: (employee: Employee) => void;
}

export function EmployeeTable({ employees, isLoading, onEdit }: EmployeeTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando empleados...</p>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No se encontraron empleados</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead className="font-semibold text-foreground">Cédula</TableHead>
            <TableHead className="font-semibold text-foreground">Nombre</TableHead>
            <TableHead className="font-semibold text-foreground">Cargo</TableHead>
            <TableHead className="font-semibold text-foreground">Restaurante</TableHead>
            <TableHead className="font-semibold text-foreground">Estado</TableHead>
            <TableHead className="font-semibold text-foreground w-10">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{employee.cedula}</TableCell>
              <TableCell>{employee.nombreCompleto}</TableCell>
              <TableCell>{employee.cargo}</TableCell>
              <TableCell>{employee.restaurante}</TableCell>
              <TableCell>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    employee.estado === 'activo'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {employee.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit?.(employee)}
                  className="p-1 h-auto"
                  title="Editar empleado"
                >
                  <Pencil className="w-4 h-4 text-accent" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
