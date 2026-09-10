[1mdiff --git a/app/page.tsx b/app/page.tsx[m
[1mindex d513029..97382f3 100644[m
[1m--- a/app/page.tsx[m
[1m+++ b/app/page.tsx[m
[36m@@ -26,6 +26,12 @@[m [mconst getMesDesdeCedula = (cedula: string): string => {[m
   return tieneGuion ? cedula.substring(6, 8) : cedula.substring(5, 7);[m
 };[m
 [m
[32m+[m[32minterface EmployeeRowProps {[m
[32m+[m[32m  employee: Employee;[m
[32m+[m[32m  onEdit?: (employee: Employee) => void;[m
[32m+[m[32m  onDelete?: (employee: Employee) => void;[m
[32m+[m[32m}[m
[32m+[m
 /**[m
  * Extrae el mes de una fecha en formato d/m/aaaa o dd/mm/aaaa[m
  * (también soporta "-" como separador).[m
[1mdiff --git a/components/employee-table.tsx b/components/employee-table.tsx[m
[1mindex 849ef4c..95cff89 100644[m
[1m--- a/components/employee-table.tsx[m
[1m+++ b/components/employee-table.tsx[m
[36m@@ -14,12 +14,14 @@[m [mimport {[m
 import { Employee } from '@/types/employee';[m
 import { EmployeePrintButton } from '@/components/employee-print';[m
 import { Button } from '@/components/ui/button';[m
[31m-import { Pencil } from 'lucide-react';[m
[32m+[m[32mimport { Delete, DeleteIcon, Pencil } from 'lucide-react';[m
[32m+[m[32mimport { DeleteEmployeeDialog } from '@/components/delete-employee-dialog';[m
 [m
 interface EmployeeTableProps {[m
   employees: Employee[];[m
   isLoading?: boolean;[m
   onEdit?: (employee: Employee) => void;[m
[32m+[m[32m  onDelete?: (employee: Employee) => void;[m
 }[m
 [m
 export function EmployeeTable({ employees, isLoading, onEdit }: EmployeeTableProps) {[m
[36m@@ -54,7 +56,7 @@[m [mexport function EmployeeTable({ employees, isLoading, onEdit }: EmployeeTablePro[m
             <TableHead className="font-semibold text-foreground">Estado Civil</TableHead>[m
             <TableHead className="font-semibold text-foreground">Fecha de Ingreso</TableHead>[m
             <TableHead className="font-semibold text-foreground">Estado</TableHead>[m
[31m-            <TableHead className="font-semibold text-foreground min-w-[50px]">Actualizar</TableHead>[m
[32m+[m[32m            <TableHead className="font-semibold text-foreground min-w-[50px]">Accciones</TableHead>[m
           </TableRow>[m
         </TableHeader>[m
         <TableBody>[m
[36m@@ -78,23 +80,30 @@[m [mexport function EmployeeTable({ employees, isLoading, onEdit }: EmployeeTablePro[m
                   {employee.estado === 'activo' ? 'Activo' : 'Inactivo'}[m
                 </span>[m
               </TableCell>[m
[31m-              <TableCell>[m
[31m-                {/*Boton de Editar*/}[m
[31m-                <div className="flex items-center gap-1">[m
[31m-                <Button[m
[31m-                  variant="ghost"[m
[31m-                  size="sm"[m
[31m-                  onClick={() => onEdit?.(employee)}[m
[31m-                  className="p-1 h-auto"[m
[31m-                  title="Editar empleado"[m
[31m-                >[m
[31m-                  <Pencil className="w-4 h-4 text-color:blue-200" />[m
[31m-                </Button>[m
[32m+[m[32m            <TableCell>[m
[32m+[m[32m            {/* Botón de Editar */}[m
[32m+[m[32m            <div className="flex items-center gap-1">[m
[32m+[m[32m              <Button[m
[32m+[m[32m                variant="ghost"[m
[32m+[m[32m                size="sm"[m
[32m+[m[32m                onClick={() => onEdit?.(employee)}[m
[32m+[m[32m                className="p-1 h-auto"[m
[32m+[m[32m                title="Editar empleado"[m
[32m+[m[32m              >[m
[32m+[m[32m                <Pencil className="w-4 h-4 text-blue-500" />[m
[32m+[m[32m              </Button>[m
[32m+[m
[32m+[m[32m              {/* Botón de Eliminar — con confirmación */}[m
[32m+[m[32m              <DeleteEmployeeDialog[m
[32m+[m[32m                employeeName={employee.nombreCompleto}[m
[32m+[m[32m                onConfirm={() => onDelete?.(employee)}[m
[32m+[m[32m              />[m
[32m+[m
[32m+[m[32m              {/* Botón de Imprimir */}[m
[32m+[m[32m              <EmployeePrintButton employee={employee} />[m[41m [m
[32m+[m[32m            </div>[m
[32m+[m[32m          </TableCell>[m
 [m
[31m-                {/*Boton de Imprimir*/}[m
[31m-                  <EmployeePrintButton employee={employee} />[m
[31m-                </div>[m
[31m-              </TableCell>[m
             </TableRow>[m
           ))}[m
         </TableBody>[m
