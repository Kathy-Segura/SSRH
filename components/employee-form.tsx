'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Employee } from '@/types/employee';
import { Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface EmployeeFormProps {
  onSubmit?: (employee: Employee) => void;
  onReset?: () => void;
}

export function EmployeeForm({ onSubmit, onReset }: EmployeeFormProps) {
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
    onReset?.();
  };

  return (
    <div className="bg-gradient-to-br from-[#80CED7]/10 via-[#007EA7]/5 to-white border border-[#80CED7]/30 rounded-xl p-8 space-y-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold text-black">Registrar Nuevo Empleado</h2>
        <p className="text-sm text-gray-600 mt-1">Completa los datos del empleado a registrar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Grid de campos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nombre Completo - Requerido */}
          <div className="space-y-2 lg:col-span-2">
            <label className="text-sm font-medium text-black">Nombre Completo *</label>
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
            <label className="text-sm font-medium text-black">Cédula *</label>
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
            <label className="text-sm font-medium text-black">Cargo</label>
            <Input
              placeholder="Chef, Mesero, etc."
              value={formData.cargo || ''}
              onChange={(e) => handleChange('cargo', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Restaurante */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Restaurante</label>
            <Select value={formData.restaurante || 'DF'} onValueChange={(value) => handleChange('restaurante', value)}>
              <SelectTrigger className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BARRIO CAFÉ">BARRIO CAFÉ</SelectItem>
                <SelectItem value="BARRIO CAFÉ (CENTRAL)">BARRIO CAFÉ (CENTRAL)</SelectItem>
                <SelectItem value="CONTENTERA">CONTENTERA</SelectItem>
                <SelectItem value="DF">DF</SelectItem>
                <SelectItem value="AJÍ">AJÍ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha Ingreso */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Fecha Ingreso</label>
            <Input
              type="date"
              value={formData.fechaIngreso || ''}
              onChange={(e) => handleChange('fechaIngreso', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Cumpleaños */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Cumpleaños</label>
            <Input
              type="date"
              value={formData.cumpleanos || ''}
              onChange={(e) => handleChange('cumpleanos', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Teléfono */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Teléfono</label>
            <Input
              placeholder="+505 1234-8732"
              value={formData.numeroTelefono || ''}
              onChange={(e) => handleChange('numeroTelefono', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Teléfono Emergencia */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Teléfono Emergencia</label>
            <Input
              placeholder="+505 1234-8732"
              value={formData.numeroEmergencia || ''}
              onChange={(e) => handleChange('numeroEmergencia', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* INSS */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">INSS</label>
            <Input
              placeholder="INSS-001"
              value={formData.inss || ''}
              onChange={(e) => handleChange('inss', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Cuenta BAC */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Cuenta BAC</label>
            <Input
              placeholder="123456789"
              value={formData.cuentaBac || ''}
              onChange={(e) => handleChange('cuentaBac', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Estado Civil */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Estado Civil</label>
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
            <label className="text-sm font-medium text-black">Estado</label>
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
            <label className="text-sm font-medium text-black">Días Trabajados</label>
            <Input
              type="number"
              value={formData.diasTrabajados || 0}
              onChange={(e) => handleChange('diasTrabajados', parseInt(e.target.value) || 0)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Fecha Egreso */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Fecha Egreso</label>
            <Input
              type="date"
              value={formData.fechaEgreso || ''}
              onChange={(e) => handleChange('fechaEgreso', e.target.value)}
              className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            />
          </div>

          {/* Fecha Retiro */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Fecha Retiro</label>
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
          <label className="text-sm font-medium text-black">Dirección</label>
          <Input
            placeholder="Calle, número, apartamento..."
            value={formData.direccion || ''}
            onChange={(e) => handleChange('direccion', e.target.value)}
            className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
          />
        </div>

        {/* Observaciones */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-black">Observaciones</label>
          <Textarea
            placeholder="Notas adicionales del empleado..."
            value={formData.observaciones || ''}
            onChange={(e) => handleChange('observaciones', e.target.value)}
            className="bg-[#80CED7]/10 border-[#80CED7]/30 text-black"
            rows={3}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="gap-2 border-[#80CED7]/50 text-black hover:bg-[#80CED7]/10"
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
    </div>
  );
}
