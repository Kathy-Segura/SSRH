'use client';

import { Employee } from '@/types/employee';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Employee) => void;
  employee?: Employee;
  isEditing?: boolean;
}

const RESTAURANTS = ['DF', 'Barrio Café', 'La Contentera', 'Food Stop'];
const STATES = ['activo', 'inactivo'];
const MARITAL_STATUS = ['soltero', 'casado', 'divorciado', 'viudo'];

export function EmployeeModal({
  isOpen,
  onClose,
  onSave,
  employee,
  isEditing = false,
}: EmployeeModalProps) {
  const [formData, setFormData] = useState<Employee>(
    employee || {
      id: Math.random().toString(),
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
      barrio: '',
      inss: '',
      cuentaBac: '',
      diasTrabajados: 0,
      fechaRetiro: '',
      observaciones: '',
      estadoCivil: 'soltero',
      estado: 'activo',
    }
  );

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    }
  }, [employee, isOpen]);

  const handleChange = (field: keyof Employee, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    if (!formData.nombreCompleto || !formData.cedula) {
      alert('Por favor completa los campos obligatorios (Nombre y Cédula)');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Nombre Completo */}
          <div className="col-span-2">
            <label className="text-sm font-medium">Nombre Completo *</label>
            <Input
              value={formData.nombreCompleto}
              onChange={(e) => handleChange('nombreCompleto', e.target.value)}
              placeholder="Ej: Juan García López"
              className="mt-1"
            />
          </div>

          {/* Cédula */}
          <div>
            <label className="text-sm font-medium">Cédula *</label>
            <Input
              value={formData.cedula}
              onChange={(e) => handleChange('cedula', e.target.value)}
              placeholder="Ej: 001-1234567-8"
              className="mt-1"
            />
          </div>

          {/* INSS */}
          <div>
            <label className="text-sm font-medium">INSS</label>
            <Input
              value={formData.inss}
              onChange={(e) => handleChange('inss', e.target.value)}
              placeholder="Ej: INSS-001"
              className="mt-1"
            />
          </div>

          {/* Fecha Ingreso */}
          <div>
            <label className="text-sm font-medium">Fecha Ingreso</label>
            <Input
              type="date"
              value={formData.fechaIngreso}
              onChange={(e) => handleChange('fechaIngreso', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Fecha Egreso */}
          <div>
            <label className="text-sm font-medium">Fecha Egreso</label>
            <Input
              type="date"
              value={formData.fechaEgreso}
              onChange={(e) => handleChange('fechaEgreso', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Cargo */}
          <div>
            <label className="text-sm font-medium">Cargo</label>
            <Input
              value={formData.cargo}
              onChange={(e) => handleChange('cargo', e.target.value)}
              placeholder="Ej: Mesero"
              className="mt-1"
            />
          </div>

          {/* Restaurante */}
          <div>
            <label className="text-sm font-medium">Restaurante</label>
            <Select value={formData.restaurante} onValueChange={(value) => handleChange('restaurante', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESTAURANTS.map((rest) => (
                  <SelectItem key={rest} value={rest}>
                    {rest}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cumpleaños */}
          <div>
            <label className="text-sm font-medium">Cumpleaños</label>
            <Input
              type="date"
              value={formData.cumpleanos}
              onChange={(e) => handleChange('cumpleanos', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Dirección */}
          <div className="col-span-2">
            <label className="text-sm font-medium">Dirección</label>
            <Input
              value={formData.direccion}
              onChange={(e) => handleChange('direccion', e.target.value)}
              placeholder="Ej: Calle Principal 123"
              className="mt-1"
            />
          </div>

          {/* Barrio */}
          <div>
            <label className="text-sm font-medium">Barrio</label>
            <Input
              value={formData.barrio}
              onChange={(e) => handleChange('barrio', e.target.value)}
              placeholder="Ej: Centro"
              className="mt-1"
            />
          </div>

          {/* Número de Teléfono */}
          <div>
            <label className="text-sm font-medium">Teléfono</label>
            <Input
              value={formData.numeroTelefono}
              onChange={(e) => handleChange('numeroTelefono', e.target.value)}
              placeholder="Ej: 809-123-4567"
              className="mt-1"
            />
          </div>

          {/* Número de Emergencia */}
          <div>
            <label className="text-sm font-medium">Emergencia</label>
            <Input
              value={formData.numeroEmergencia}
              onChange={(e) => handleChange('numeroEmergencia', e.target.value)}
              placeholder="Ej: 809-987-6543"
              className="mt-1"
            />
          </div>

          {/* Cuenta BAC */}
          <div>
            <label className="text-sm font-medium">Cuenta BAC</label>
            <Input
              value={formData.cuentaBac}
              onChange={(e) => handleChange('cuentaBac', e.target.value)}
              placeholder="Ej: 1234567890"
              className="mt-1"
            />
          </div>

          {/* Días Trabajados */}
          <div>
            <label className="text-sm font-medium">Días Trabajados</label>
            <Input
              type="number"
              value={formData.diasTrabajados}
              onChange={(e) => handleChange('diasTrabajados', parseInt(e.target.value) || 0)}
              className="mt-1"
            />
          </div>

          {/* Fecha Retiro */}
          <div>
            <label className="text-sm font-medium">Fecha Retiro</label>
            <Input
              type="date"
              value={formData.fechaRetiro}
              onChange={(e) => handleChange('fechaRetiro', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Estado Civil */}
          <div>
            <label className="text-sm font-medium">Estado Civil</label>
            <Select value={formData.estadoCivil} onValueChange={(value) => handleChange('estadoCivil', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_STATUS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
          <div>
            <label className="text-sm font-medium">Estado</label>
            <Select value={formData.estado} onValueChange={(value) => handleChange('estado', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state.charAt(0).toUpperCase() + state.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observaciones */}
          <div className="col-span-2">
            <label className="text-sm font-medium">Observaciones</label>
            <Textarea
              value={formData.observaciones}
              onChange={(e) => handleChange('observaciones', e.target.value)}
              placeholder="Notas adicionales..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
