import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileHeader } from './Sidebar';
import { useStore } from '@/hooks/useStore';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useEffect } from 'react';


const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/alumnos': 'Alumnos',
  '/niveles': 'Niveles',
  '/libros': 'Libros',
  '/pagos': 'Pagos',
  '/gastos': 'Gastos',
  '/preinscripciones': 'Pre-inscripciones',
  '/caja-rapida': 'Caja Rápida',
  '/configuracion': 'Configuración',
};

export function Layout() {
  const { sidebarOpen, toast: toastData, setToast } = useStore();
  const location = useLocation();
  const pageTitle = location.pathname.startsWith('/alumnos/') ? 'Detalle del Alumno' : (routeTitles[location.pathname] || 'ALEI');

  useEffect(() => {
    if (toastData) {
      toast[toastData.type](toastData.message);
      setToast(null);
    }
  }, [toastData, setToast]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <MobileHeader />
      
      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          'lg:ml-64',
          sidebarOpen ? '' : ''
        )}
      >
        <div className="p-4 lg:p-8">
          <div className="mb-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-red-50 px-4 py-2">
            <p className="text-sm font-semibold text-blue-900">🇬🇧 {pageTitle}</p>
          </div>
          <Outlet />
        </div>
      </main>
      
      <Toaster position="top-right" richColors />
    </div>
  );
}
