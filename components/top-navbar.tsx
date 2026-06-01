'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopNavbarProps {
  onMenuToggle?: () => void;
}

export function TopNavbar({ onMenuToggle }: TopNavbarProps) {
  return (
    <nav className="h-14 bg-gradient-to-r from-[#80CED7] to-[#007EA7] shadow-md sticky top-0 z-40 flex items-center px-4 sm:px-6 lg:px-8">
      <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-bold text-lg tracking-tight">Sistema RRHH</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuToggle}
          className="text-white hover:bg-white/10 md:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    </nav>
  );
}
