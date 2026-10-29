'use client';
/**
  COMPONENTE ENCARGADO DE FILTRAR TODOS LOS DATOS DE UN EMPLEADO
  REALIZA BUSQUEDA POR CAMPOS COMO:
  --NOMBRE
  --CEDULA
  --INSS
  --ESTADO
  --ESTADO CIVIL
  --RESTAURANTE (dinámico: se pueden agregar nuevos)
  --CARGO (dinámico: se pueden agregar nuevos)
  --MOTIVO DE SALIDA (3 opciones fijas)
  --MES(CUMPLEAÑOS)
  --MES(INGRESO)
*/

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterState } from '@/types/filter';
import { MOTIVOS_SALIDA } from '@/lib/motivos-salida';
import { Search, X, Plus, Check, Loader2 } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  onClear: () => void;
  /** Lista de restaurantes: SIEMPRE debe venir del padre (leída desde /api/restaurantes -> Google Sheet).
   *  Es la fuente de verdad; ya no hay una lista local "temporal". */
  restaurantes: string[];
  /**
   * Persiste el nuevo restaurante en el backend (Google Sheet).
   * Debe lanzar un error si falla, y el padre debe actualizar su estado
   * `restaurantes` cuando la promesa resuelve, para que el cambio se
   * propague a este componente y a cualquier otro filtro que lo use.
   */
  onAddRestaurante: (nombre: string) => Promise<void>;
  /** Lista de cargos (hoja RESTAURANTES, columna Cargo + cargos ya usados por empleados). Viene del padre. */
  cargos: string[];
  /**
   * Persiste el nuevo cargo (RESTAURANTES!B) y devuelve el nombre OFICIAL con el que quedó guardado
   * (si ya existía con otras mayúsculas devuelve el existente). Debe lanzar un error si falla.
   */
  onAddCargo: (nombre: string) => Promise<string>;
}

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/* ─────────────────────────────────────────────────────────────────────────────
 * Select con botón "+" para agregar una opción nueva que se guarda en el backend.
 * Lo usan Restaurante y Cargo, así el flujo (validar, guardar, seleccionar) es idéntico.
 * ───────────────────────────────────────────────────────────────────────────── */
interface AddableSelectProps {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  addPlaceholder: string;
  addTitle: string;
  errorFallback: string;
  /** Normaliza lo escrito antes de comparar/guardar (p. ej. mayúsculas). */
  normalize?: (value: string) => string;
  onValueChange: (value: string) => void;
  /** Guarda en el backend. Puede devolver el nombre oficial; si no, se usa el normalizado. */
  onAdd: (nombre: string) => Promise<string | void>;
}

function AddableSelect({
  label,
  value,
  options,
  placeholder,
  addPlaceholder,
  addTitle,
  errorFallback,
  normalize = (v) => v,
  onValueChange,
  onAdd,
}: AddableSelectProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setNuevo('');
    setShowAdd(false);
    setError(null);
  };

  const handleConfirm = async () => {
    const nombre = normalize(nuevo.trim().replace(/\s+/g, ' '));
    if (!nombre) return;

    // Ya existe: simplemente se selecciona, no hace falta guardarlo de nuevo.
    const existente = options.find((option) => sameName(option, nombre));
    if (existente) {
      onValueChange(existente);
      reset();
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      // Espera a que quede guardado en el Google Sheet antes de continuar.
      const guardado = (await onAdd(nombre)) ?? nombre;
      // Al resolver, el padre ya actualizó `options`, así que queda disponible de inmediato.
      onValueChange(guardado);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : errorFallback);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>

      <div className="flex gap-2">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => setShowAdd((prev) => !prev)}
          title={addTitle}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {showAdd && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder={addPlaceholder}
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
                if (e.key === 'Escape') reset();
              }}
              disabled={guardando}
              maxLength={60}
              className="bg-background"
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0"
              onClick={handleConfirm}
              disabled={guardando || !nuevo.trim()}
              title="Confirmar"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={reset}
              disabled={guardando}
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  restaurantes,
  onAddRestaurante,
  cargos,
  onAddCargo,
}: FilterBarProps) {
  const handleInputChange = (field: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4 p-6 bg-card border border-border rounded-lg">
      <h2 className="text-lg font-semibold text-foreground">Filtros de Búsqueda</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Nombre */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Nombre</label>
          <Input
            placeholder="Buscar por nombre..."
            value={filters.nombre}
            onChange={(e) => handleInputChange('nombre', e.target.value)}
            className="bg-background"
          />
        </div>

        {/* INSS */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">INSS</label>
          <Input
            placeholder="Buscar por INSS..."
            value={filters.inss}
            onChange={(e) => handleInputChange('inss', e.target.value)}
            className="bg-background"
          />
        </div>

        {/* Cumpleaños (Mes) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Mes (Cumpleaños)</label>
          <Select
            value={filters.mescumple}
            onValueChange={(value) => handleInputChange('mescumple', value)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar un mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MESES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fecha de Ingreso (Mes) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Mes (Ingreso)</label>
          <Select
            value={filters.mesIngreso}
            onValueChange={(value) => handleInputChange('mesIngreso', value)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar un mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MESES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Restaurante (la lista sale siempre del padre, que la lee del Google Sheet) */}
        <AddableSelect
          label="Restaurante"
          value={filters.restaurante}
          options={restaurantes}
          placeholder="Seleccionar restaurante"
          addPlaceholder="Nombre del nuevo restaurante"
          addTitle="Agregar restaurante"
          errorFallback="No se pudo guardar el restaurante"
          normalize={(value) => value.toUpperCase()}
          onValueChange={(value) => handleInputChange('restaurante', value)}
          onAdd={async (nombre) => {
            await onAddRestaurante(nombre);
          }}
        />

        {/* Cargo (dinámico: el nuevo se guarda en la columna Cargo de la hoja RESTAURANTES) */}
        <AddableSelect
          label="Cargo"
          value={filters.cargo}
          options={cargos}
          placeholder="Seleccionar cargo"
          addPlaceholder="Nombre del nuevo cargo"
          addTitle="Agregar cargo"
          errorFallback="No se pudo guardar el cargo"
          onValueChange={(value) => handleInputChange('cargo', value)}
          onAdd={onAddCargo}
        />

        {/* Motivo de salida (3 opciones fijas) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Motivo de salida</label>
          <Select
            value={filters.motivoSalida}
            onValueChange={(value) => handleInputChange('motivoSalida', value)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar motivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MOTIVOS_SALIDA.map((motivo) => (
                <SelectItem key={motivo} value={motivo}>
                  {motivo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Estado */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Estado</label>
          <Select value={filters.estado} onValueChange={(value) => handleInputChange('estado', value)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Estado Civil */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Estado Civil</label>
          <Select value={filters.estadoCivil} onValueChange={(value) => handleInputChange('estadoCivil', value)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar estado civil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="soltero">Soltero/a</SelectItem>
              <SelectItem value="casado">Casado/a</SelectItem>
              <SelectItem value="divorciado">Divorciado/a</SelectItem>
              <SelectItem value="viudo">Viudo/a</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-2 pt-4">
        <Button onClick={onSearch} variant="outline" className="gap-2">
          <Search className="w-4 h-4" />
          Buscar
        </Button>
        <Button onClick={onClear} variant="outline" className="gap-2">
          <X className="w-4 h-4" />
          Limpiar
        </Button>
      </div>
    </div>
  );
}
