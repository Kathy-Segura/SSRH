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
import { Save, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { calcularDiasTrabajados } from '@/utiles/dateutils';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Employee) => void;
  employee?: Employee;
  isEditing?: boolean;
}

// Lista de respaldo, solo se usa si falla la carga desde el Sheet
const RESTAURANTES_FALLBACK = ['AJÍ', 'DF', 'ADMIN', 'BARRIO CAFÉ', 'LA CONTENTERA', 'FRITONI', 'CANTABAR'];

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

  // ── Restaurantes: se cargan desde el Google Sheet vía /api/restaurantes ──
  const [restaurantes, setRestaurantes] = useState<string[]>(RESTAURANTES_FALLBACK);
  const [isLoadingRestaurantes, setIsLoadingRestaurantes] = useState(false);

  useEffect(() => {
    if (!isOpen) return; // solo consultamos cuando el modal está abierto

    let cancelado = false;
    const fetchRestaurantes = async () => {
      setIsLoadingRestaurantes(true);
      try {
        const res = await fetch('/api/restaurantes');
        if (!res.ok) throw new Error('No se pudo obtener la lista de restaurantes');
        const data = await res.json();
        const lista: string[] = Array.isArray(data?.restaurantes) ? data.restaurantes : [];
        if (!cancelado && lista.length > 0) {
          setRestaurantes(lista);
        }
      } catch (err) {
        console.error('Error al cargar restaurantes:', err);
        // Nos quedamos con el fallback estático si falla la carga
      } finally {
        if (!cancelado) setIsLoadingRestaurantes(false);
      }
    };

    fetchRestaurantes();
    return () => { cancelado = true; };
  }, [isOpen]);

  useEffect(() => {
  if (employee) {
    setFormData({
      ...employee,
      estadoCivil: employee.estadoCivil || 'soltero',  
      estado: employee.estado || 'activo',              
      restaurante: employee.restaurante || 'DF',
      // Normalizar todas las fechas
      cumpleanos:   toInputDate(employee.cumpleanos),
      fechaIngreso: toInputDate(employee.fechaIngreso),
      fechaEgreso:  toInputDate(employee.fechaEgreso),
      fechaRetiro:  toInputDate(employee.fechaRetiro),        
    });
  } else{
    setFormData(EMPTY_EMPLOYEE); // limpia el form al abrir en modo creación
  }
}, [employee, isOpen]);
   
  // Nuevo useEffect — solo para calcular días trabajados
  useEffect(() => {
    const dias = calcularDiasTrabajados(
      formData.fechaIngreso,
      formData.fechaEgreso,
      formData.fechaRetiro
    );
    setFormData(prev => ({ ...prev, diasTrabajados: dias }));
  }, [formData.fechaIngreso, formData.fechaEgreso, formData.fechaRetiro]);

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

  function toInputDate(value: string | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [month, day, year] = value.split('/');
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split('-');
    return `${year}-${month}-${day}`;
  }
  return '';
}

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Modal a 90% del ancho de pantalla: flex-col con header y footer fijos,
          y una única zona central con scroll (así el header/footer nunca se mueven). */}
      <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[94vh] max-h-[94vh] overflow-hidden bg-[#f8fafb] rounded-2xl p-0 shadow-xl border border-gray-100 flex flex-col">

        {/* Header (fijo) */}
        <DialogHeader className="flex-shrink-0 bg-white px-10 pt-7 pb-6 border-b border-gray-100 rounded-t-2xl">
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

        {/* Zona con scroll: todas las secciones viven aquí */}
        <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* ── CARD 1 (2/3 del ancho): Datos Personales + Laboral + Contacto ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-7 border border-gray-100 shadow-sm space-y-8">

            {/* Datos Personales */}
            <div>
              <SectionTitle title="Datos Personales" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                <div className="md:col-span-3">
                  <Field label="Nombre Completo *">
                    <input
                      placeholder="Juan Manuel García López"
                      value={formData.nombreCompleto ?? ''}
                      onChange={e =>
                        set('nombreCompleto', e.target.value.toUpperCase())
                      }
                      className={inp}
                      required
                    />
                </Field>
            </div>
                <div className="md:col-span-2">
                  <Field label="Cédula *">
                    <input
                      placeholder="001-180901-1023U"
                      value={formData.cedula}
                      onChange={e => {
                        // Elimina todo excepto alfanuméricos
                        const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        let formatted = raw;
                        if (raw.length > 3 && raw.length <= 9) {
                          formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
                        } else if (raw.length > 9) {
                          formatted = `${raw.slice(0, 3)}-${raw.slice(3, 9)}-${raw.slice(9, 14)}`;
                        }
                        set('cedula', formatted);
                      }}
                      className={inp}
                      maxLength={16}
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

            {/* Información Laboral */}
            <div className="pt-8 border-t border-gray-100">
              <SectionTitle title="Información Laboral" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">

                {/* Fila 1: Cargo - Restaurante */}
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
                      <SelectTrigger className={sel}>
                        <SelectValue placeholder={isLoadingRestaurantes ? 'Cargando...' : 'Selecciona'} />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingRestaurantes && restaurantes.length === 0 ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando restaurantes...
                          </div>
                        ) : (
                          restaurantes.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Fila 2: Salario - Beneficios */}
                <div>
                  <Field label="Salario">
                    <input
                      type="number"
                      min={0}
                      value={formData.salario || ''}
                      onChange={e => set('salario', e.target.value)}
                      className={inp}
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Beneficios">
                    <input
                      placeholder="Bonos, alimentación, transporte..."
                      value={formData.beneficios || ''}
                      onChange={e => set('beneficios', e.target.value)}
                      className={inp}
                    />
                  </Field>
                </div>

                {/* Fila 3: Estado - Días Trabajados */}
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
                      readOnly
                      className={`${inp} bg-gray-100 cursor-not-allowed`}
                    />
                  </Field>
               </div>
              </div>
            </div>

            {/* Contacto y Datos Financieros */}
            <div className="pt-8 border-t border-gray-100">
              <SectionTitle title="Contacto y Datos Financieros" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
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

          </div>
          {/* ── fin CARD 1 ── */}

          {/* ── CARD 2 (1/3 del ancho): Fechas arriba, Observaciones debajo ── */}
          <div className="lg:col-span-1 space-y-8">

            {/* Fechas */}
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
              <SectionTitle title="Fechas" />
              <div className="grid grid-cols-1 gap-y-6">
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
              </div>
            </div>

            {/* Observaciones */}
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
              <SectionTitle title="Observaciones" />
              <Field label="Notas adicionales">
                <textarea
                  placeholder="Información adicional sobre el empleado..."
                  value={formData.observaciones}
                  onChange={e => set('observaciones', e.target.value)}
                  rows={7}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#4BBFCC] focus:ring-2 focus:ring-[#4BBFCC]/15 transition-all resize-none"
                />
              </Field>
            </div>
          </div>
          {/* ── fin CARD 2 ── */}

        </div>
        </div>

        {/* ── Botones (fijos, siempre visibles) ── */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 px-10 py-5 bg-white border-t border-gray-100 rounded-b-2xl">
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

      </DialogContent>
    </Dialog>
  );
}