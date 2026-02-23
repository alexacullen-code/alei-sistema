import { Outlet } from 'react-router-dom';
import { Sidebar, MobileHeader } from './Sidebar';
import { useStore } from '@/hooks/useStore';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useEffect } from 'react';

export function Layout() {
  const { sidebarOpen, toast: toastData, setToast } = useStore();

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
          <Outlet />
        </div>
      </main>
      
      <Toaster position="top-right" richColors />
    </div>
  );
}
