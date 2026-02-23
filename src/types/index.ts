// ============================================
// TIPOS DEL SISTEMA ALEI
// ============================================

export interface AnioLectivo {
  id: string;
  anio: number;
  activo: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  created_at?: string;
}

export interface Nivel {
  id: string;
  anio_lectivo_id: string;
  nombre: string;
  descripcion?: string;
  capacidad_maxima: number;
  cuota_mensual: number;
  horario?: string;
  profesor?: string;
  activo: boolean;
  alumnos_count?: number;
}

export interface Alumno {
  id: string;
  anio_lectivo_id: string;
  cedula: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string;
  email?: string;
  telefono?: string;
  telefono_alternativo?: string;
  direccion?: string;
  nombre_tutor?: string;
  telefono_tutor?: string;
  email_tutor?: string;
  relacion_tutor?: string;
  nivel_id?: string;
  nivel_nombre?: string;
  fecha_matricula?: string;
  es_hermano: boolean;
  grupo_hermanos?: string;
  cuota_especial?: number;
  estado: 'activo' | 'inactivo' | 'egresado' | 'suspendido';
  total_deuda?: number;
  pagos?: Pago[];
  prestamos?: PrestamoLibro[];
}

export interface Libro {
  id: string;
  anio_lectivo_id: string;
  codigo: string;
  titulo: string;
  autor?: string;
  editorial?: string;
  materia?: string;
  nivel_id?: string;
  nivel_nombre?: string;
  precio: number;
  stock_total: number;
  stock_disponible: number;
  descripcion?: string;
  activo: boolean;
}

export interface Pago {
  id: string;
  alumno_id: string;
  alumno_nombre?: string;
  alumno_apellido?: string;
  tipo: 'matricula' | 'mensualidad' | 'libro' | 'examen' | 'otro';
  concepto: string;
  mes?: number;
  anio?: number;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  descuento: number;
  tipo_descuento?: string;
  recargo: number;
  tipo_recargo?: string;
  estado: 'pendiente' | 'parcial' | 'pagado' | 'anulado';
  fecha_vencimiento?: string;
  fecha_pago?: string;
  comentarios?: string;
  created_at?: string;
}

export interface PagoDetalle {
  id: string;
  pago_id: string;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'debito' | 'credito' | 'otro';
  fecha_pago: string;
  comentarios?: string;
  created_by?: string;
}

export interface Gasto {
  id: string;
  anio_lectivo_id: string;
  concepto: string;
  categoria: string;
  proveedor?: string;
  monto_total: number;
  monto_pagado: number;
  es_cuota: boolean;
  numero_cuotas: number;
  cuota_actual: number;
  estado: 'pendiente' | 'parcial' | 'pagado' | 'anulado';
  fecha_gasto: string;
  fecha_vencimiento?: string;
  numero_comprobante?: string;
  tipo_comprobante?: string;
  comentarios?: string;
}

export interface GastoDetalle {
  id: string;
  gasto_id: string;
  monto: number;
  metodo_pago: string;
  fecha_pago: string;
  numero_cuota?: number;
  comentarios?: string;
  created_by?: string;
}

export interface PrestamoLibro {
  id: string;
  alumno_id: string;
  alumno_nombre?: string;
  alumno_apellido?: string;
  libro_id: string;
  libro_titulo?: string;
  fecha_prestamo: string;
  fecha_devolucion_esperada?: string;
  fecha_devolucion_real?: string;
  estado: 'prestado' | 'devuelto' | 'perdido' | 'danado';
  observaciones?: string;
}

export interface Examen {
  id: string;
  anio_lectivo_id: string;
  nivel_id?: string;
  nombre: string;
  tipo?: string;
  materia?: string;
  fecha_examen?: string;
  fecha_recuperatorio?: string;
  costo: number;
  descripcion?: string;
  activo: boolean;
}

export interface Preinscripcion {
  id: string;
  anio_lectivo_id: string;
  nombre: string;
  apellido: string;
  cedula?: string;
  fecha_nacimiento?: string;
  email?: string;
  telefono?: string;
  telefono_alternativo?: string;
  nombre_tutor?: string;
  telefono_tutor?: string;
  nivel_interesado_id?: string;
  nivel_nombre?: string;
  horario_preferido?: string;
  estado: 'pendiente' | 'contactado' | 'convertido' | 'rechazado' | 'lista_espera';
  fecha_conversion?: string;
  alumno_id?: string;
  fuente?: string;
  comentarios?: string;
  created_at?: string;
}

export interface Alerta {
  id: string;
  anio_lectivo_id: string;
  tipo: 'cumpleanos' | 'pago_atrasado' | 'libro_no_retirado' | 'curso_lleno' | 'general';
  titulo: string;
  mensaje?: string;
  referencia_tipo?: string;
  referencia_id?: string;
  leida: boolean;
  fecha_alerta?: string;
  created_at?: string;
}

export interface Configuracion {
  descuento_pronto_pago: string;
  recargo_mora: string;
  dia_limite_descuento: string;
  dia_inicio_recargo: string;
  moneda: string;
  nombre_instituto: string;
  telefono_instituto: string;
  email_instituto: string;
  direccion_instituto: string;
}

export interface DashboardData {
  alumnos_activos: number;
  pagos_mes: {
    total: number;
    recaudado: number;
    completos: number;
    pendientes: number;
  };
  deuda_total: number;
  gastos_mes: number;
  alumnos_con_deuda: number;
  libros_prestados: number;
  preinscripciones_pendientes: number;
  flujo_caja: number;
}

export interface CajaDiaria {
  fecha: string;
  ingresos: any[];
  egresos: any[];
  total_ingresos: number;
  total_egresos: number;
  balance: number;
}

export interface BackupData {
  anio_lectivo: AnioLectivo[];
  niveles: Nivel[];
  alumnos: Alumno[];
  libros: Libro[];
  pagos: Pago[];
  gastos: Gasto[];
  examenes: Examen[];
  preinscripciones: Preinscripcion[];
  prestamos: PrestamoLibro[];
  fecha_backup: string;
}

export type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito' | 'otro';

export const CATEGORIAS_GASTO = [
  'servicios',
  'materiales',
  'sueldos',
  'alquiler',
  'mantenimiento',
  'otro'
] as const;

export const TIPOS_PAGO = [
  'matricula',
  'mensualidad',
  'libro',
  'examen',
  'otro'
] as const;

export const ESTADOS_ALUMNO = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'egresado', label: 'Egresado' },
  { value: 'suspendido', label: 'Suspendido' }
] as const;

export const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
] as const;
