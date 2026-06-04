'use client';
/**
  COMPONENTE ENCARGADO DEL FORMULARIO DE ACTUALIZAR DATOS DE EMPLEADOS. 
  EN ESTE FORMULARIO NOS PERMITE ACTUALIZAR LOS DATOS Y EL ESTADO DEL EMPLEADO.
/**/
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee } from '@/types/employee';
import { Save } from 'lucide-react';
import { useState, useEffect } from 'react';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Employee) => void;
  employee?: Employee;
  isEditing?: boolean;
}

const inp = "w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#4BBFCC] focus:ring-2 focus:ring-[#4BBFCC]/15 transition-all";
const sel = "h-11 w-full rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:border-[#4BBFCC] focus:ring-2 focus:ring-[#4BBFCC]/15 transition-all";
const lbl = "block text-[12px] font-semibold uppercase tracking-wider text-gray-400 mb-2";

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-[3px] h-5 rounded-full bg-[#4BBFCC]" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#4BBFCC]">{title}</span>
      <div className="flex-1 h-px bg-[#4BBFCC]/15" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className={lbl}>{label}</label>
      {children}
    </div>
  );
}

const EMPTY_EMPLOYEE: Employee = {
  id: '',
  nombreCompleto: '',
  cedula: '',
  fechaIngreso: '',
  fechaEgreso: '',
  cargo: '',
  restaurante: 'DF',
  salario: 0,
  beneficios: '', 
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
};

export function EmployeeModal({
  isOpen,
  onClose,
  onSave,
  employee,
  isEditing = false,
}: EmployeeModalProps) {
  const [formData, setFormData] = useState<Employee>(employee || EMPTY_EMPLOYEE);

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    }
  }, [employee, isOpen]);

  const set = (field: keyof Employee, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!formData.nombreCompleto || !formData.cedula) {
      alert('Por favor completa los campos requeridos: Nombre y Cédula');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-[1500px] max-h-[92vh] overflow-y-auto bg-[#f8fafb] rounded-2xl p-0 shadow-xl border border-gray-100">

        {/* Header */}
        <DialogHeader className="sticky top-0 z-10 bg-white px-10 pt-7 pb-6 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full bg-[#4BBFCC]" />
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-800 leading-none">
                  {isEditing ? 'Editar Empleado' : 'Actualizar Datos Empleado'}
                </DialogTitle>
                <p className="text-sm text-gray-400 mt-1">
                  {isEditing ? 'Modifica la información del colaborador' : 'Información del colaborador'}
                </p>
              </div>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">* Campos requeridos</span>
          </div>
        </DialogHeader>

        <div className="px-10 py-8 space-y-8">

          {/* ── SECCIÓN 1: Datos Personales ── */}
          <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
            <SectionTitle title="Datos Personales" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
              <div className="md:col-span-3">
                <Field label="Nombre Completo *">
                  <input
                    placeholder="Juan Manuel García López"
                    value={formData.nombreCompleto}
                    onChange={e => set('nombreCompleto', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Cédula *">
                  <input
                    placeholder="001-120597-0003A"
                    value={formData.cedula}
                    onChange={e => set('cedula', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Estado Civil">
                  <Select value={formData.estadoCivil || 'soltero'} onValueChange={v => set('estadoCivil', v)}>
                    <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soltero">Soltero/a</SelectItem>
                      <SelectItem value="casado">Casado/a</SelectItem>
                      <SelectItem value="divorciado">Divorciado/a</SelectItem>
                      <SelectItem value="viudo">Viudo/a</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <Field label="Dirección">
                  <input
                    placeholder="Calle, zona, barrio, ciudad..."
                    value={formData.direccion}
                    onChange={e => set('direccion', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 2: Información Laboral ── */}
          <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
            <SectionTitle title="Información Laboral" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <Field label="Cargo">
                  <input
                    placeholder="Chef, Mesero, Cajero..."
                    value={formData.cargo}
                    onChange={e => set('cargo', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Restaurante">
                  <Select value={formData.restaurante || 'DF'} onValueChange={v => set('restaurante', v)}>
                    <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BARRIO CAFÉ">BARRIO CAFÉ</SelectItem>
                      <SelectItem value="BARRIO CAFÉ (CENTRAL)">BARRIO CAFÉ (CENTRAL)</SelectItem>
                      <SelectItem value="CONTENTERA">LA CONTENTERA</SelectItem>
                      <SelectItem value="DF">DF</SelectItem>
                      <SelectItem value="AJÍ">AJÍ</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div>
                <Field label="Estado">
                  <Select value={formData.estado || 'activo'} onValueChange={v => set('estado', v)}>
                    <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div>
                <Field label="Días Trabajados">
                  <input
                    type="number"
                    min={0}
                    value={formData.diasTrabajados ?? ''}
                    onChange={e => set('diasTrabajados', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={inp}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 3: Contacto y Datos Financieros ── */}
          <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
            <SectionTitle title="Contacto y Datos Financieros" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <Field label="Teléfono Principal">
                  <input
                    placeholder="+505 8888-0000"
                    value={formData.numeroTelefono}
                    onChange={e => set('numeroTelefono', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Teléfono Emergencia">
                  <input
                    placeholder="+505 8888-0000"
                    value={formData.numeroEmergencia}
                    onChange={e => set('numeroEmergencia', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Número INSS">
                  <input
                    placeholder="INSS-001"
                    value={formData.inss}
                    onChange={e => set('inss', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Cuenta BAC">
                  <input
                    placeholder="123456789"
                    value={formData.cuentaBac}
                    onChange={e => set('cuentaBac', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 4: Fechas ── */}
          <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
            <SectionTitle title="Fechas" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <Field label="Cumpleaños">
                  <input
                    type="date"
                    value={formData.cumpleanos}
                    onChange={e => set('cumpleanos', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Fecha de Ingreso">
                  <input
                    type="date"
                    value={formData.fechaIngreso}
                    onChange={e => set('fechaIngreso', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Fecha de Egreso">
                  <input
                    type="date"
                    value={formData.fechaEgreso}
                    onChange={e => set('fechaEgreso', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
              <div>
                <Field label="Fecha de Retiro">
                  <input
                    type="date"
                    value={formData.fechaRetiro}
                    onChange={e => set('fechaRetiro', e.target.value)}
                    className={inp}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 5: Observaciones ── */}
          <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
            <SectionTitle title="Observaciones" />
            <Field label="Notas adicionales">
              <textarea
                placeholder="Información adicional sobre el empleado..."
                value={formData.observaciones}
                onChange={e => set('observaciones', e.target.value)}
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#4BBFCC] focus:ring-2 focus:ring-[#4BBFCC]/15 transition-all resize-none"
              />
            </Field>
          </div>

          {/* ── Botones ── */}
          <div className="flex items-center justify-end gap-3 pt-2 pb-1 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-6 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-11 px-7 rounded-xl text-sm font-semibold text-white bg-[#4BBFCC] hover:bg-[#3aabb8] transition-all flex items-center gap-2 shadow-md shadow-[#4BBFCC]/20"
            >
              <Save className="w-4 h-4" /> {isEditing ? 'Guardar Cambios' : 'Actualizar'}
            </button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
