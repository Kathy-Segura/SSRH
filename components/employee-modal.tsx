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

/**
 * Normaliza cualquier fecha guardada a ISO (yyyy-mm-dd), que es lo que usa el estado del formulario.
 * Con "/" o "-" y año al final se lee como DÍA/MES/AÑO; solo si eso es imposible (ej. 03/15/1990)
 * se acepta como MES/DÍA. Lo que teclea el usuario en DateField se valida siempre estricto dd/mm/aaaa.
 * OJO: las fechas ambiguas que vienen del Sheet en mes/día no se pueden detectar aquí (ver toBirthdayInputDate).
 */
function toInputDate(value: string | undefined, allowMDYFallback = true): string {
  if (!value) return '';
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // ya es ISO
  const m = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return '';
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const valid = (y: number, mo: number, dd: number) => {
    const d = new Date(y, mo - 1, dd);
    return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === dd;
  };
  const iso = (y: number, mo: number, dd: number) =>
    `${y}-${String(mo).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  if (valid(year, month, day)) return iso(year, month, day);
  // Solo si es imposible como día/mes (ej. 03/15/1990) pero válida como mes/día, es inequívocamente mes/día
  if (allowMDYFallback && valid(year, day, month)) return iso(year, day, month);
  return '';
}

/** Fecha de nacimiento embebida en la cédula nicaragüense: 001-DDMMAA-0000X → ISO, o '' si no se puede leer. */
function birthFromCedula(cedula: string | undefined): string {
  const m = String(cedula || '').replace(/\s/g, '').match(/^\d{3}-?(\d{2})(\d{2})(\d{2})-?\d{4}[A-Za-z]$/);
  if (!m) return '';
  const day = Number(m[1]), month = Number(m[2]), yy = Number(m[3]);
  const currentYY = new Date().getFullYear() % 100;
  const year = yy > currentYY ? 1900 + yy : 2000 + yy;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Cumpleaños: si la fecha guardada es ambigua (dd/mm vs mm/dd), usa la cédula para decidir.
 * Si ninguna lectura coincide con la cédula, se queda con día/mes/año.
 */
function toBirthdayInputDate(value: string | undefined, cedula: string | undefined): string {
  const dmy = toInputDate(value);
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) return dmy;
  const m = String(value).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return dmy;
  const mdy = toInputDate(`${m[2]}/${m[1]}/${m[3]}`, false); // intercambia día y mes
  const fromCedula = birthFromCedula(cedula);
  if (fromCedula && mdy === fromCedula) return mdy;
  return dmy;
}

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Campo de fecha dd/mm/aaaa (no depende del idioma del navegador). Emite ISO o '' al padre. */
function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [text, setText] = useState(isoToDisplay(value));

  // sincroniza cuando el valor externo cambia (al abrir/cambiar de empleado)
  useEffect(() => {
    setText(prev => (toInputDate(prev, false) === value ? prev : isoToDisplay(value)));
  }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    if (digits.length === 0) onChange('');
    else if (digits.length === 8) onChange(toInputDate(out, false)); // '' si es inválida
  };

  const incompleta = text.length > 0 && !toInputDate(text, false);

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      maxLength={10}
      value={text}
      onChange={e => handle(e.target.value)}
      className={`${inp} ${incompleta ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
    />
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
      cumpleanos:   toBirthdayInputDate(employee.cumpleanos, employee.cedula),
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
                    <DateField value={formData.fechaIngreso} onChange={v => set('fechaIngreso', v)} />
                  </Field>
                </div>
                <div>
                  <Field label="Fecha de Egreso">
                    <DateField value={formData.fechaEgreso} onChange={v => set('fechaEgreso', v)} />
                  </Field>
                </div>
                <div>
                  <Field label="Fecha de Retiro">
                    <DateField value={formData.fechaRetiro} onChange={v => set('fechaRetiro', v)} />
                  </Field>
                </div>
                <div>
                  <Field label="Cumpleaños">
                    <DateField value={formData.cumpleanos} onChange={v => set('cumpleanos', v)} />
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