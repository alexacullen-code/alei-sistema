import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  CreditCard, 
  TrendingDown, 
  Settings, 
  UserPlus,
  Menu,
  X,
  GraduationCap
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/alumnos', icon: Users, label: 'Alumnos' },
  { path: '/niveles', icon: GraduationCap, label: 'Niveles' },
  { path: '/libros', icon: BookOpen, label: 'Libros' },
  { path: '/pagos', icon: CreditCard, label: 'Pagos' },
  { path: '/gastos', icon: TrendingDown, label: 'Gastos' },
  { path: '/preinscripciones', icon: UserPlus, label: 'Pre-inscripciones' },
  { path: '/caja-rapida', icon: CreditCard, label: 'Caja Rápida' },
  { path: '/configuracion', icon: Settings, label: 'Configuración' },
];

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, anioLectivoActivo } = useStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 bg-slate-900 text-white transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-700 px-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="font-bold text-lg">ALEI</h1>
                <p className="text-xs text-slate-400">
                  {anioLectivoActivo ? anioLectivoActivo.anio : 'Cargando...'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-slate-800"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }: { isActive: boolean }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-slate-700 p-4">
            <div className="flex items-center gap-3 rounded-lg bg-slate-800 p-3">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-sm font-bold">A</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Administrador</p>
                <p className="text-xs text-slate-400">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileHeader() {
  const { setSidebarOpen } = useStore();

  return (
    <header className="lg:hidden h-16 bg-slate-900 text-white flex items-center px-4 sticky top-0 z-30">
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:bg-slate-800"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>
      <span className="ml-3 font-bold text-lg">ALEI</span>
    </header>
  );
}
