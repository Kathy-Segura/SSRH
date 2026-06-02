'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { TopNavbar } from '@/components/top-navbar';
import { HorizontalMenu } from '@/components/horizontal-menu';
import { EmployeeTable } from '@/components/employee-table';
import { FilterBar } from '@/components/filter-bar';
import { EmployeeFormModal } from '@/components/employee-form-modal';
import { PaginationControls } from '@/components/pagination-controls';
import { PrintDialog } from '@/components/print-dialog';
import { EmployeeModal } from '@/components/employee-modal';
import { Employee } from '@/types/employee';
import { FilterState } from '@/types/filter';
import { Printer, ChevronUp, Plus } from 'lucide-react';

// Datos de ejemplo
const SAMPLE_EMPLOYEES: Employee[] = [
  {
    id: '1',
    nombreCompleto: 'Juan García López',
    cedula: '001-1234567-8',
    fechaIngreso: '2022-01-15',
    fechaEgreso: '',
    cargo: 'Mesero',
    restaurante: 'DF',
    cumpleanos: '1990-05-20',
    direccion: 'Calle Principal 123',
    numeroTelefono: '809-123-4567',
    numeroEmergencia: '809-123-4568',
    barrio: 'Centro',
    inss: 'INSS-001',
    cuentaBac: '1234567890',
    diasTrabajados: 750,
    fechaRetiro: '',
    observaciones: 'Empleado confiable',
    estadoCivil: 'casado',
    estado: 'activo',
  },
  {
    id: '2',
    nombreCompleto: 'María Rodríguez González',
    cedula: '002-1234568-9',
    fechaIngreso: '2021-06-10',
    fechaEgreso: '',
    cargo: 'Cocinera',
    restaurante: 'Barrio Café',
    cumpleanos: '1988-03-15',
    direccion: 'Avenida 27 de Febrero 456',
    numeroTelefono: '809-234-5678',
    numeroEmergencia: '809-234-5679',
    barrio: 'La Altagracia',
    inss: 'INSS-002',
    cuentaBac: '0987654321',
    diasTrabajados: 820,
    fechaRetiro: '',
    observaciones: '',
    estadoCivil: 'soltero',
    estado: 'activo',
  },
  {
    id: '3',
    nombreCompleto: 'Carlos Martínez Ruiz',
    cedula: '003-1234569-0',
    fechaIngreso: '2023-03-20',
    fechaEgreso: '',
    cargo: 'Gerente',
    restaurante: 'La Contentera',
    cumpleanos: '1985-07-10',
    direccion: 'Calle Independencia 789',
    numeroTelefono: '809-345-6789',
    numeroEmergencia: '809-345-6780',
    barrio: 'Santo Domingo',
    inss: 'INSS-003',
    cuentaBac: '5555555555',
    diasTrabajados: 450,
    fechaRetiro: '',
    observaciones: 'Líder de equipo',
    estadoCivil: 'casado',
    estado: 'activo',
  },
  {
    id: '4',
    nombreCompleto: 'Ana Pérez Sánchez',
    cedula: '004-1234570-1',
    fechaIngreso: '2020-11-05',
    fechaEgreso: '2024-06-30',
    cargo: 'Recepcionista',
    restaurante: 'Food Stop',
    cumpleanos: '1992-12-08',
    direccion: 'Avenida Luperón 100',
    numeroTelefono: '809-456-7890',
    numeroEmergencia: '809-456-7891',
    barrio: 'Gazcue',
    inss: 'INSS-004',
    cuentaBac: '4444444444',
    diasTrabajados: 1200,
    fechaRetiro: '2024-06-30',
    observaciones: 'Salida voluntaria',
    estadoCivil: 'soltero',
    estado: 'inactivo',
  },
  {
    id: '5',
    nombreCompleto: 'Roberto Flores Gutiérrez',
    cedula: '005-1234571-2',
    fechaIngreso: '2022-09-12',
    fechaEgreso: '',
    cargo: 'Chef',
    restaurante: 'DF',
    cumpleanos: '1987-01-25',
    direccion: 'Calle Las Flores 200',
    numeroTelefono: '809-567-8901',
    numeroEmergencia: '809-567-8902',
    barrio: 'Naco',
    inss: 'INSS-005',
    cuentaBac: '3333333333',
    diasTrabajados: 650,
    fechaRetiro: '',
    observaciones: 'Especialista en cocina caribeña',
    estadoCivil: 'casado',
    estado: 'activo',
  },
  {
    id: '6',
    nombreCompleto: 'Sofía Moreno Castro',
    cedula: '006-1234572-3',
    fechaIngreso: '2021-02-18',
    fechaEgreso: '',
    cargo: 'Administrativa',
    restaurante: 'Barrio Café',
    cumpleanos: '1995-09-30',
    direccion: 'Paseo de los Almendros 50',
    numeroTelefono: '809-678-9012',
    numeroEmergencia: '809-678-9013',
    barrio: 'Piantini',
    inss: 'INSS-006',
    cuentaBac: '2222222222',
    diasTrabajados: 880,
    fechaRetiro: '',
    observaciones: '',
    estadoCivil: 'soltero',
    estado: 'activo',
  },
  {
    id: '7',
    nombreCompleto: 'Diego Herrera López',
    cedula: '007-1234573-4',
    fechaIngreso: '2023-01-09',
    fechaEgreso: '',
    cargo: 'Bartender',
    restaurante: 'La Contentera',
    cumpleanos: '1991-04-14',
    direccion: 'Avenida John F. Kennedy 300',
    numeroTelefono: '809-789-0123',
    numeroEmergencia: '809-789-0124',
    barrio: 'Los Mina',
    inss: 'INSS-007',
    cuentaBac: '1111111111',
    diasTrabajados: 380,
    fechaRetiro: '',
    observaciones: 'Certificado en mixología',
    estadoCivil: 'soltero',
    estado: 'activo',
  },
  {
    id: '8',
    nombreCompleto: 'Lucía Jiménez Mendoza',
    cedula: '008-1234574-5',
    fechaIngreso: '2022-05-22',
    fechaEgreso: '',
    cargo: 'Mesera',
    restaurante: 'Food Stop',
    cumpleanos: '1993-08-17',
    direccion: 'Calle Dr. Delgado 75',
    numeroTelefono: '809-890-1234',
    numeroEmergencia: '809-890-1235',
    barrio: 'Bella Vista',
    inss: 'INSS-008',
    cuentaBac: '9999999999',
    diasTrabajados: 700,
    fechaRetiro: '',
    observaciones: '',
    estadoCivil: 'casado',
    estado: 'activo',
  },
  {
    id: '9',
    nombreCompleto: 'Fernando Reyes Valdés',
    cedula: '009-1234575-6',
    fechaIngreso: '2020-08-03',
    fechaEgreso: '2023-12-15',
    cargo: 'Cocinero',
    restaurante: 'DF',
    cumpleanos: '1986-11-22',
    direccion: 'Avenida de Santo Domingo 400',
    numeroTelefono: '809-901-2345',
    numeroEmergencia: '809-901-2346',
    barrio: 'San Carlos',
    inss: 'INSS-009',
    cuentaBac: '8888888888',
    diasTrabajados: 1250,
    fechaRetiro: '2023-12-15',
    observaciones: 'Jubilación',
    estadoCivil: 'casado',
    estado: 'inactivo',
  },
  {
    id: '10',
    nombreCompleto: 'Patricia Soto Ramírez',
    cedula: '010-1234576-7',
    fechaIngreso: '2021-12-01',
    fechaEgreso: '',
    cargo: 'Supervisora',
    restaurante: 'Barrio Café',
    cumpleanos: '1989-06-05',
    direccion: 'Calle Sánchez 250',
    numeroTelefono: '809-012-3456',
    numeroEmergencia: '809-012-3457',
    barrio: 'Ensanche La Nueva',
    inss: 'INSS-010',
    cuentaBac: '7777777777',
    diasTrabajados: 920,
    fechaRetiro: '',
    observaciones: 'Encargada de calidad',
    estadoCivil: 'soltero',
    estado: 'activo',
  },
];

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>(SAMPLE_EMPLOYEES);
  const [filters, setFilters] = useState<FilterState>({
    nombre: '',
    cedula: '',
    inss: '',
    estadoCivil: '',
    estado: '',
    restaurante: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();
  const [activeSection, setActiveSection] = useState('employees');

  // Filtrar empleados
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchNombre = employee.nombreCompleto
        .toLowerCase()
        .includes(filters.nombre.toLowerCase());
      const matchCedula = employee.cedula
        .toLowerCase()
        .includes(filters.cedula.toLowerCase());
      const matchINSS = employee.inss
        .toLowerCase()
        .includes(filters.inss.toLowerCase());
      const matchEstadoCivil =
        !filters.estadoCivil || filters.estadoCivil === 'all' || employee.estadoCivil === filters.estadoCivil;
      const matchEstado = !filters.estado || filters.estado === 'all' || employee.estado === filters.estado;
      const matchRestaurante =
        !filters.restaurante || filters.restaurante === 'all' || employee.restaurante === filters.restaurante;

      return (
        matchNombre &&
        matchCedula &&
        matchINSS &&
        matchEstadoCivil &&
        matchEstado &&
        matchRestaurante
      );
    });
  }, [employees, filters]);

  // Paginación
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const handleAddEmployee = (employee: Employee) => {
    setEmployees([employee, ...employees]);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleSaveEmployee = (updatedEmployee: Employee) => {
    setEmployees(
      employees.map((emp) =>
        emp.id === updatedEmployee.id ? updatedEmployee : emp
      )
    );
    setIsModalOpen(false);
    setSelectedEmployee(undefined);
  };

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      nombre: '',
      cedula: '',
      inss: '',
      estadoCivil: '',
      estado: '',
      restaurante: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  const handlePrint = () => {
    setIsPrintDialogOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Navbar */}
      <TopNavbar />

      {/* Horizontal Menu */}
      <HorizontalMenu
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isOpen={true}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {activeSection === 'employees' && (
            <>
              {/* Barra de filtros retráctil */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Filtros</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="text-foreground hover:bg-[#80CED7]/10 text-[#80CED7]"
                  >
                    <ChevronUp className={`w-4 h-4 transition-transform ${isFilterOpen ? '' : 'rotate-180'}`} />
                  </Button>
                </div>
                {isFilterOpen && (
                  <FilterBar
                    filters={filters}
                    onFiltersChange={setFilters}
                    onSearch={handleSearch}
                    onClear={handleClearFilters}
                  />
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setIsFormModalOpen(true)}
                  className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Empleado
                </Button>
                <Button
                  onClick={handlePrint}
                  className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Reporte
                </Button>
              </div>

              {/* Tabla de empleados */}
              <EmployeeTable
                employees={paginatedEmployees}
                onEdit={handleEditEmployee}
              />

              {/* Controles de paginación */}
              {filteredEmployees.length > 0 && (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredEmployees.length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              )}
            </>
          )}

          {activeSection === 'reports' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground">Reportes</h2>
              <p className="text-muted-foreground mt-4">Esta sección está en desarrollo</p>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground">Configuración</h2>
              <p className="text-muted-foreground mt-4">Esta sección está en desarrollo</p>
            </div>
          )}
        </div>
      </main>

      {/* Print Dialog */}
      <PrintDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        employees={filteredEmployees}
        filters={{ ...filters }}
      />
      <PrintDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        employees={filteredEmployees}
        filters={{ ...filters }}
      />

      {/* Employee Form Modal */}
      <EmployeeFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={(employee) => {
          handleAddEmployee(employee);
          setIsFormModalOpen(false);
        }}
      />

      {/* Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        employee={selectedEmployee}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEmployee(undefined);
        }}
        onSave={handleSaveEmployee}
      />
    </div>
  );
}
