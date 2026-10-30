'use client';
/**
  COMBOBOX DE CARGOS (compartido por employee-form-modal y employee-modal).
  - Carga la lista desde /api/cargos (RESTAURANTES!B + INDETERMINADO!E, sin duplicados).
  - Permite buscar escribiendo y seleccionar con el mouse o el teclado.
  - Los cargos nuevos se registran desde el filtro de Cargo (se guardan en RESTAURANTES!B)
    y aparecen aquí automáticamente.
/**/
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';

interface CargoComboboxProps {
  value: string;
  onChange: (cargo: string) => void;
  /** Solo carga la lista cuando el modal está abierto */
  isOpen: boolean;
  className?: string;
}

const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function CargoCombobox({ value, onChange, isOpen, className = '' }: CargoComboboxProps) {
  const [cargos, setCargos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Carga los cargos cada vez que se abre el modal (así se ven los recién agregados)
  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    const fetchCargos = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/cargos', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo obtener la lista de cargos');
        const data = await res.json();
        const lista: string[] = Array.isArray(data?.cargos) ? data.cargos : [];
        if (!cancelado) setCargos(lista);
      } catch (err) {
        console.error('Error al cargar cargos:', err);
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    };
    fetchCargos();
    return () => { cancelado = true; };
  }, [isOpen]);

  // Si el empleado tiene un cargo que no está en la lista, igual se muestra como opción
  const opciones = useMemo(() => {
    const lista = [...cargos];
    if (value && !lista.some(c => normalizar(c) === normalizar(value))) lista.unshift(value);
    return lista;
  }, [cargos, value]);

  const filtradas = useMemo(() => {
    const q = normalizar(query);
    return q ? opciones.filter(c => normalizar(c).includes(q)) : opciones;
  }, [opciones, query]);

  // Cierra al hacer clic fuera
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Mantiene visible la opción resaltada al navegar con el teclado
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const seleccionar = (cargo: string) => {
    onChange(cargo);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight(h => Math.min(h + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      // evita que Enter envíe el formulario mientras se elige un cargo
      if (open) {
        e.preventDefault();
        if (filtradas[highlight]) seleccionar(filtradas[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={isLoading ? 'Cargando cargos...' : 'Selecciona o busca un cargo'}
        // Abierto: muestra lo que se escribe para buscar. Cerrado: muestra el cargo elegido.
        value={open ? query : value}
        onFocus={() => { setOpen(true); setQuery(''); setHighlight(0); }}
        onClick={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={handleKeyDown}
        className={`${className} pr-16`}
      />
      <div className="absolute inset-y-0 right-3 flex items-center gap-1">
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
        {value && !open && (
          <button
            type="button"
            aria-label="Quitar cargo"
            onClick={() => onChange('')}
            className="p-1 rounded text-gray-300 hover:text-gray-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filtradas.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-gray-400">
              {isLoading ? 'Cargando...' : 'Sin resultados. Los cargos nuevos se registran desde el filtro de Cargo.'}
            </li>
          ) : (
            filtradas.map((cargo, i) => {
              const seleccionado = normalizar(cargo) === normalizar(value);
              return (
                <li
                  key={cargo}
                  role="option"
                  aria-selected={seleccionado}
                  // onMouseDown (y no onClick) para ganarle al blur del input
                  onMouseDown={e => { e.preventDefault(); seleccionar(cargo); }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${
                    i === highlight ? 'bg-[#4BBFCC]/10 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <span>{cargo}</span>
                  {seleccionado && <Check className="w-4 h-4 text-[#4BBFCC]" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
