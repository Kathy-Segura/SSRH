'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Employee } from '@/types/employee';
import { Plus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (employee: Employee) => void;
}

export function EmployeeFormModal({ isOpen, onClose, onSubmit }: EmployeeFormModalProps) {
  const [formData, setFormData] = useState<Partial<Employee>>({
    nombreCompleto: '',
    cedula: '',
    fechaIngreso: '',
    fechaEgreso: '',
    cargo: '',
    restaurante: 'DF',
    cumpleanos: '',
    direccion: '',
    numeroTelefono: '',
    numeroEmergencia: '',
    inss: '',
    cuentaBac: '',
    diasTrabajados: 0,
    fechaRetiro: '',
    observaciones: '',
    estadoCivil: 'soltero',
    estado: 'activo',
  });

  const handleChange = (field: keyof Employee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreCompleto || !formData.cedula) {
      alert('Por favor completa los campos requeridos: Nombre y Cédula');
      return;
    }
    const employee: Employee = {
      id: Date.now().toString(),
      nombreCompleto: formData.nombreCompleto,
      cedula: formData.cedula,
      fechaIngreso: formData.fechaIngreso || '',
      fechaEgreso: formData.fechaEgreso || '',
      cargo: formData.cargo || '',
      restaurante: (formData.restaurante as any) || 'DF',
      cumpleanos: formData.cumpleanos || '',
      direccion: formData.direccion || '',
      numeroTelefono: formData.numeroTelefono || '',
      numeroEmergencia: formData.numeroEmergencia || '',
      barrio: '',
      inss: formData.inss || '',
      cuentaBac: formData.cuentaBac || '',
      diasTrabajados: formData.diasTrabajados || 0,
      fechaRetiro: formData.fechaRetiro || '',
      observaciones: formData.observaciones || '',
      estadoCivil: (formData.estadoCivil as any) || 'soltero',
      estado: (formData.estado as any) || 'activo',
    };
    onSubmit?.(employee);
    handleReset();
  };

  const handleReset = () => {
    setFormData({
      nombreCompleto: '',
      cedula: '',
      fechaIngreso: '',
      fechaEgreso: '',
      cargo: '',
      restaurante: 'DF',
      cumpleanos: '',
      direccion: '',
      numeroTelefono: '',
      numeroEmergencia: '',
      inss: '',
      cuentaBac: '',
      diasTrabajados: 0,
      fechaRetiro: '',
      observaciones: '',
      estadoCivil: 'soltero',
      estado: 'activo',
    });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="border-b border-[#80CED7]/20 pb-4">
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="text-2xl font-bold text-foreground">Registrar Nuevo Empleado</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Nombre Completo - Requerido */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-foreground">Nombre Completo *</label>
              <Input
                placeholder="Juan García López"
                value={formData.nombreCompleto || ''}
                onChange={(e) => handleChange('nombreCompleto', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
                required
              />
            </div>

            {/* Cédula - Requerido */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cédula *</label>
              <Input
                placeholder="001-1234567-8"
                value={formData.cedula || ''}
                onChange={(e) => handleChange('cedula', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
                required
              />
            </div>

            {/* Cargo */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cargo</label>
              <Input
                placeholder="Chef, Mesero, etc."
                value={formData.cargo || ''}
                onChange={(e) => handleChange('cargo', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Restaurante */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Restaurante</label>
              <Select value={formData.restaurante || 'DF'} onValueChange={(value) => handleChange('restaurante', value)}>
                <SelectTrigger className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BARRIO CAFÉ">BARRIO CAFÉ</SelectItem>
                  <SelectItem value="BARRIO CAFÉ (CENTRAL)">BARRIO CAFÉ (CENTRAL)</SelectItem>
                  <SelectItem value="FOOD STOP">FOOD STOP</SelectItem>
                  <SelectItem value="CONTENTERA">CONTENTERA</SelectItem>
                  <SelectItem value="DF">DF</SelectItem>
                  <SelectItem value="AJÍ">AJÍ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha Ingreso */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fecha Ingreso</label>
              <Input
                type="date"
                value={formData.fechaIngreso || ''}
                onChange={(e) => handleChange('fechaIngreso', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Cumpleaños */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cumpleaños</label>
              <Input
                type="date"
                value={formData.cumpleanos || ''}
                onChange={(e) => handleChange('cumpleanos', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Teléfono</label>
              <Input
                placeholder="+505 1234-8732"
                value={formData.numeroTelefono || ''}
                onChange={(e) => handleChange('numeroTelefono', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Teléfono Emergencia */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Teléfono Emergencia</label>
              <Input
                placeholder="+505 1234-8732"
                value={formData.numeroEmergencia || ''}
                onChange={(e) => handleChange('numeroEmergencia', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* INSS */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">INSS</label>
              <Input
                placeholder="INSS-001"
                value={formData.inss || ''}
                onChange={(e) => handleChange('inss', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Cuenta BAC */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cuenta BAC</label>
              <Input
                placeholder="123456789"
                value={formData.cuentaBac || ''}
                onChange={(e) => handleChange('cuentaBac', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Estado Civil */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Estado Civil</label>
              <Select value={formData.estadoCivil || 'soltero'} onValueChange={(value) => handleChange('estadoCivil', value)}>
                <SelectTrigger className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soltero">Soltero</SelectItem>
                  <SelectItem value="casado">Casado</SelectItem>
                  <SelectItem value="divorciado">Divorciado</SelectItem>
                  <SelectItem value="viudo">Viudo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Estado</label>
              <Select value={formData.estado || 'activo'} onValueChange={(value) => handleChange('estado', value)}>
                <SelectTrigger className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Días Trabajados */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Días Trabajados</label>
              <Input
                type="number"
                value={formData.diasTrabajados || 0}
                onChange={(e) => handleChange('diasTrabajados', parseInt(e.target.value) || 0)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Fecha Egreso */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fecha Egreso</label>
              <Input
                type="date"
                value={formData.fechaEgreso || ''}
                onChange={(e) => handleChange('fechaEgreso', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>

            {/* Fecha Retiro */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fecha Retiro</label>
              <Input
                type="date"
                value={formData.fechaRetiro || ''}
                onChange={(e) => handleChange('fechaRetiro', e.target.value)}
                className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              />
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Dirección</label>
            <Input
              placeholder="Calle, número, apartamento..."
              value={formData.direccion || ''}
              onChange={(e) => handleChange('direccion', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Observaciones</label>
            <Textarea
              placeholder="Notas adicionales del empleado..."
              value={formData.observaciones || ''}
              onChange={(e) => handleChange('observaciones', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
              rows={3}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end border-t border-[#80CED7]/20 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="gap-2 border-[#80CED7]/50 text-black hover:bg-[#80CED7]/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReset}
              className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Limpiar
            </Button>
            <Button
              type="submit"
              className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Registrar Empleado
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
