// ============================================
// STORE GLOBAL CON ZUSTAND
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  AnioLectivo, 
  Nivel, 
  Alumno, 
  Libro, 
  Pago, 
  Gasto, 
  Preinscripcion,
  DashboardData,
  Configuracion 
} from '@/types';

interface AppState {
  // Año lectivo activo
  anioLectivoActivo: AnioLectivo | null;
  setAnioLectivoActivo: (anio: AnioLectivo | null) => void;
  
  // Listados
  aniosLectivos: AnioLectivo[];
  setAniosLectivos: (anios: AnioLectivo[]) => void;
  
  niveles: Nivel[];
  setNiveles: (niveles: Nivel[]) => void;
  
  alumnos: Alumno[];
  setAlumnos: (alumnos: Alumno[]) => void;
  
  libros: Libro[];
  setLibros: (libros: Libro[]) => void;
  
  pagos: Pago[];
  setPagos: (pagos: Pago[]) => void;
  
  gastos: Gasto[];
  setGastos: (gastos: Gasto[]) => void;
  
  preinscripciones: Preinscripcion[];
  setPreinscripciones: (preinscripciones: Preinscripcion[]) => void;
  
  // Dashboard
  dashboard: DashboardData | null;
  setDashboard: (data: DashboardData) => void;
  
  // Configuración
  configuracion: Configuracion | null;
  setConfiguracion: (config: Configuracion) => void;
  
  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // Notificaciones
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  
  // Búsqueda global
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any;
  setSearchResults: (results: any) => void;
  
  // Refresh triggers
  refreshAlumnos: number;
  triggerRefreshAlumnos: () => void;
  refreshPagos: number;
  triggerRefreshPagos: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Año lectivo
      anioLectivoActivo: null,
      setAnioLectivoActivo: (anio) => set({ anioLectivoActivo: anio }),
      
      // Listados
      aniosLectivos: [],
      setAniosLectivos: (anios) => set({ aniosLectivos: anios }),
      
      niveles: [],
      setNiveles: (niveles) => set({ niveles }),
      
      alumnos: [],
      setAlumnos: (alumnos) => set({ alumnos }),
      
      libros: [],
      setLibros: (libros) => set({ libros }),
      
      pagos: [],
      setPagos: (pagos) => set({ pagos }),
      
      gastos: [],
      setGastos: (gastos) => set({ gastos }),
      
      preinscripciones: [],
      setPreinscripciones: (preinscripciones) => set({ preinscripciones }),
      
      // Dashboard
      dashboard: null,
      setDashboard: (data) => set({ dashboard: data }),
      
      // Configuración
      configuracion: null,
      setConfiguracion: (config) => set({ configuracion: config }),
      
      // UI
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      // Notificaciones
      toast: null,
      setToast: (toast) => set({ toast }),
      
      // Búsqueda
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchResults: null,
      setSearchResults: (results) => set({ searchResults: results }),
      
      // Refresh triggers
      refreshAlumnos: 0,
      triggerRefreshAlumnos: () => set((state) => ({ refreshAlumnos: state.refreshAlumnos + 1 })),
      refreshPagos: 0,
      triggerRefreshPagos: () => set((state) => ({ refreshPagos: state.refreshPagos + 1 })),
    }),
    {
      name: 'alei-storage',
      partialize: (state) => ({
        anioLectivoActivo: state.anioLectivoActivo,
        configuracion: state.configuracion,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
