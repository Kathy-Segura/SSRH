'use client';
/**
  COMPONENTE ENCARGADO DEL FORMULARIO DE REGISTRO DE NUEVOS EMPLEADOS. 
  EL FORMULARIO CUENTA CON CUATRO SECCIONES LAS CUALES SON:
  --DATOS PERSONALES
  --INFORMACION LABORAL
  --FECHAS
  --OBSERVACIONES
/**/
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee } from '@/types/employee';
import { Plus, RotateCcw, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { calcularDiasTrabajados } from '@/utiles/dateutils';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (employee: Employee) => void;
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

export function EmployeeFormModal({ isOpen, onClose, onSubmit }: EmployeeFormModalProps) {
  const [formData, setFormData] = useState<Partial<Employee>>({
    nombreCompleto: '', cedula: '', fechaIngreso: '', fechaEgreso: '',
    cargo: '', restaurante: 'DF', salario: 0, beneficios: '', cumpleanos: '', direccion: '',
    numeroTelefono: '', numeroEmergencia: '', inss: '', cuentaBac: '',
    diasTrabajados: 0, fechaRetiro: '', observaciones: '', estadoCivil: 'soltero', estado: 'activo',
  });

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

  const set = (field: keyof Employee, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreCompleto || !formData.cedula) {
      alert('Por favor completa los campos requeridos: Nombre y Cédula');
      return;
    }
    const employee: Employee = {
      id: Date.now().toString(),
      nombreCompleto: formData.nombreCompleto!, cedula: formData.cedula!,
      fechaIngreso: formData.fechaIngreso || '', fechaEgreso: formData.fechaEgreso || '',
      cargo: formData.cargo || '', restaurante: (formData.restaurante as any) || 'DF',
      salario: formData.salario || 0, beneficios: formData.beneficios || '',
      cumpleanos: formData.cumpleanos || '', direccion: formData.direccion || '',
      numeroTelefono: formData.numeroTelefono || '', numeroEmergencia: formData.numeroEmergencia || '',
      barrio: '', inss: formData.inss || '', cuentaBac: formData.cuentaBac || '',
      diasTrabajados: formData.diasTrabajados || 0, fechaRetiro: formData.fechaRetiro || '',
      observaciones: formData.observaciones || '',
      estadoCivil: (formData.estadoCivil as any) || 'soltero',
      estado: (formData.estado as any) || 'activo',
    };
    onSubmit?.(employee);
    reset();
  };

  const reset = () => setFormData({
    nombreCompleto: '', cedula: '', fechaIngreso: '', fechaEgreso: '',
    cargo: '', restaurante: 'DF', salario: 0, beneficios: '', cumpleanos: '', direccion: '',
    numeroTelefono: '', numeroEmergencia: '', inss: '', cuentaBac: '',
    diasTrabajados: 0, fechaRetiro: '', observaciones: '', estadoCivil: 'soltero', estado: 'activo',
  });

  const handleClose = () => { reset(); onClose(); };

  // Dentro del componente, después de definir formData y set:
  useEffect(() => {
    const dias = calcularDiasTrabajados(
      formData.fechaIngreso,
      formData.fechaEgreso,
      formData.fechaRetiro
    );
    set('diasTrabajados', dias);
  }, [formData.fechaIngreso, formData.fechaEgreso, formData.fechaRetiro]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {/* Modal a pantalla casi completa: flex-col con header y footer fijos,
          y una única zona central con scroll (así el header/footer nunca se mueven). */}
      <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[94vh] max-h-[94vh] overflow-hidden bg-[#f8fafb] rounded-2xl p-0 shadow-xl border border-gray-100 flex flex-col">

        {/* Header (fijo) */}
        <DialogHeader className="flex-shrink-0 bg-white px-10 pt-7 pb-6 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full bg-[#4BBFCC]" />
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-800 leading-none">
                  Registrar Nuevo Empleado
                </DialogTitle>
                <p className="text-sm text-gray-400 mt-1">Completa la información del colaborador</p>
              </div>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">* Campos requeridos</span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">

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
                      value={formData.nombreCompleto || ''}
                      onChange={e => set('nombreCompleto', e.target.value.toUpperCase())}
                      className={inp}
                      required
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Cédula *">
                    <input
                      placeholder="001-120597-0003A"
                      value={formData.cedula || ''}
                      onChange={e => {
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
                      required
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
                    <input placeholder="Calle, zona, barrio, ciudad..." value={formData.direccion || ''} onChange={e => set('direccion', e.target.value)} className={inp} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div className="pt-8 border-t border-gray-100">
                <SectionTitle title="Información Laboral" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
                  <div>
                    <Field label="Cargo">
                      <input placeholder="Chef, Mesero, Cajero..." value={formData.cargo || ''} onChange={e => set('cargo', e.target.value)} className={inp} />
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
                      <input placeholder="+505 8888-0000" value={formData.numeroTelefono || ''} onChange={e => set('numeroTelefono', e.target.value)} className={inp} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Teléfono Emergencia">
                      <input placeholder="+505 8888-0000" value={formData.numeroEmergencia || ''} onChange={e => set('numeroEmergencia', e.target.value)} className={inp} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Número INSS">
                      <input placeholder="INSS-001" value={formData.inss || ''} onChange={e => set('inss', e.target.value)} className={inp} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Cuenta BAC">
                      <input placeholder="345678912" value={formData.cuentaBac || ''} onChange={e => set('cuentaBac', e.target.value)} className={inp} />
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
                      <input type="date" value={formData.fechaIngreso || ''} onChange={e => set('fechaIngreso', e.target.value)} className={inp} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Fecha de Egreso">
                      <input type="date" value={formData.fechaEgreso || ''} onChange={e => set('fechaEgreso', e.target.value)} className={inp} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Fecha de Retiro">
                      <input type="date" value={formData.fechaRetiro || ''} onChange={e => set('fechaRetiro', e.target.value)} className={inp} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Cumpleaños">
                      <input type="date" value={formData.cumpleanos || ''} onChange={e => set('cumpleanos', e.target.value)} className={inp} />
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
                    value={formData.observaciones || ''}
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
            <button type="button" onClick={handleClose}
              className="h-11 px-6 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all">
              Cancelar
            </button>
            <button type="button" onClick={reset}
              className="h-11 px-6 rounded-xl text-sm font-medium text-[#4BBFCC] border border-[#4BBFCC]/30 hover:bg-[#4BBFCC]/8 transition-all flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Limpiar
            </button>
            <button type="submit"
              className="h-11 px-7 rounded-xl text-sm font-semibold text-white bg-[#4BBFCC] hover:bg-[#3aabb8] transition-all flex items-center gap-2 shadow-md shadow-[#4BBFCC]/20">
              <Plus className="w-4 h-4" /> Registrar Empleado
            </button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
