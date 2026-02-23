import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { DashboardData } from '@/types';
import { 
  Users, 
  CreditCard, 
  TrendingDown, 
  BookOpen, 
  UserPlus,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { get } = useApi();
  const { dashboard, setDashboard, anioLectivoActivo } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [anioLectivoActivo]);

  const loadDashboard = async () => {
    setLoading(true);
    const data = await get<DashboardData>('dashboard');
    if (data) {
      setDashboard(data);
    }
    setLoading(false);
  };

  const stats = [
    {
      title: 'Alumnos Activos',
      value: dashboard?.alumnos_activos || 0,
      icon: Users,
      color: 'bg-blue-500',
      link: '/alumnos'
    },
    {
      title: 'Ingresos del Mes',
      value: formatCurrency(dashboard?.pagos_mes?.recaudado || 0),
      icon: TrendingUp,
      color: 'bg-green-500',
      link: '/pagos'
    },
    {
      title: 'Gastos del Mes',
      value: formatCurrency(dashboard?.gastos_mes || 0),
      icon: TrendingDown,
      color: 'bg-red-500',
      link: '/gastos'
    },
    {
      title: 'Deuda Total',
      value: formatCurrency(dashboard?.deuda_total || 0),
      icon: AlertTriangle,
      color: 'bg-orange-500',
      link: '/pagos'
    },
    {
      title: 'Libros Prestados',
      value: dashboard?.libros_prestados || 0,
      icon: BookOpen,
      color: 'bg-purple-500',
      link: '/libros'
    },
    {
      title: 'Pre-inscripciones',
      value: dashboard?.preinscripciones_pendientes || 0,
      icon: UserPlus,
      color: 'bg-cyan-500',
      link: '/preinscripciones'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">
            Resumen del sistema - {anioLectivoActivo?.anio || 'Cargando...'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/caja-rapida">
              <CreditCard className="h-4 w-4 mr-2" />
              Caja Rápida
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat) => (
              <Card key={stat.title} className="hover:shadow-md transition-shadow">
                <Link to={stat.link}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {stat.title}
                        </p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                          {stat.value}
                        </p>
                      </div>
                      <div className={`${stat.color} p-3 rounded-lg`}>
                        <stat.icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
      </div>

      {/* Flujo de Caja */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Flujo de Caja
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Ingresos</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(dashboard?.pagos_mes?.recaudado || 0)}
                </p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 font-medium">Gastos</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(dashboard?.gastos_mes || 0)}
                </p>
              </div>
              <div className={`text-center p-4 rounded-lg ${
                (dashboard?.flujo_caja || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'
              }`}>
                <p className={`text-sm font-medium ${
                  (dashboard?.flujo_caja || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}>Balance</p>
                <p className={`text-2xl font-bold ${
                  (dashboard?.flujo_caja || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'
                }`}>
                  {formatCurrency(dashboard?.flujo_caja || 0)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagos del Mes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pagos del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total de pagos</span>
                  <span className="font-semibold">{dashboard?.pagos_mes?.total || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-600">Pagos completos</span>
                  <span className="font-semibold text-green-600">
                    {dashboard?.pagos_mes?.completos || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-orange-600">Pagos pendientes</span>
                  <span className="font-semibold text-orange-600">
                    {dashboard?.pagos_mes?.pendientes || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-slate-900 font-medium">Total recaudado</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(dashboard?.pagos_mes?.recaudado || 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alumnos con Deuda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="text-center py-6">
                <p className="text-4xl font-bold text-slate-900">
                  {dashboard?.alumnos_con_deuda || 0}
                </p>
                <p className="text-slate-500 mt-2">alumnos tienen pagos pendientes</p>
                <Button asChild variant="outline" className="mt-4">
                  <Link to="/pagos">Ver pagos pendientes</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
