'use client';

import { Button } from '@/components/ui/button';
import { Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HorizontalMenuProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isOpen?: boolean;
}

const sections = [
  {
    id: 'employees',
    label: 'Registro de Empleados',
    icon: Users,
    description: 'Gestiona los datos de tus empleados'
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: Settings,
    description: 'Ajusta los parámetros del sistema'
  },
];

export function HorizontalMenu({ activeSection, onSectionChange, isOpen = true }: HorizontalMenuProps) {
  return (
    <div className="bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          'flex gap-2 overflow-x-auto py-3',
          !isOpen && 'hidden'
        )}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all text-sm font-medium',
                  activeSection === section.id
                    ? 'bg-[#80CED7] text-white shadow-md' 
                    : 'bg-[#80CED7] text-white hover:bg-[#80CED7]/90'
                )}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
