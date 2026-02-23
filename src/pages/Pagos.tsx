import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Pago, Alumno } from '@/types';
import { 
  Search, 
  Plus, 
  CreditCard, 
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { MESES, TIPOS_PAGO } from '@/types';

export default function Pagos() {
  const { get, post } = useApi();
  const { 
    pagos, 
    setPagos, 
    alumnos, 
    setAlumnos, 
    anioLectivoActivo,
    configuracion,
    refreshPagos,
    triggerRefreshPagos
  } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('all');
  const [filtroMes, setFiltroMes] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPagoParcialDialogOpen, setIsPagoParcialDialogOpen] = useState(false);
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  
  const [formData, setFormData] = useState({
    alumno_id: '',
    tipo: 'mensualidad',
    concepto: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    monto_total: '',
    descuento: '0',
    tipo_descuento: '',
    recargo: '0',
    tipo_recargo: '',
    fecha_vencimiento: '',
    comentarios: '',
  });

  const [pagoParcialForm, setPagoParcialForm] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    comentarios: '',
  });

  useEffect(() => {
    loadData();
  }, [anioLectivoActivo, refreshPagos]);

  const loadData = async () => {
    if (!anioLectivoActivo) return;
    
    setLoading(true);
    const [pagosData, alumnosData] = await Promise.all([
      get<Pago[]>('pagos'),
      get<Alumno[]>('alumnos')
    ]);
    
    if (pagosData) setPagos(pagosData);
    if (alumnosData) setAlumnos(alumnosData);
    setLoading(false);
  };

  const calcularDescuentoRecargo = (alumnoId: string, mes: number, anio: number, _monto: number) => {
    const alumno = alumnos.find(a => a.id === alumnoId);
    if (!alumno) return { descuento: 0, recargo: 0, tipo_descuento: '', tipo_recargo: '' };
    
    // Si es hermano con cuota especial, no aplica descuento ni recargo
    if (alumno.es_hermano && alumno.cuota_especial) {
      return { descuento: 0, recargo: 0, tipo_descuento: '', tipo_recargo: '' };
    }
    
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();
    
    const diaLimiteDescuento = parseInt(configuracion?.dia_limite_descuento || '10');
    const diaInicioRecargo = parseInt(configuracion?.dia_inicio_recargo || '16');
    const montoDescuento = parseFloat(configuracion?.descuento_pronto_pago || '150');
    const montoRecargo = parseFloat(configuracion?.recargo_mora || '150');
    
    // Si está pagando el mes actual o anterior
    const esMesActualOMenor = (anio < anioActual) || (anio === anioActual && mes <= mesActual);
    
    if (esMesActualOMenor) {
      // Descuento por pronto pago (antes del día 10)
      if (diaActual <= diaLimiteDescuento) {
        return { 
          descuento: montoDescuento, 
          recargo: 0, 
          tipo_descuento: 'pronto_pago', 
          tipo_recargo: '' 
        };
      }
      // Recargo (después del día 16)
      if (diaActual >= diaInicioRecargo) {
        return { 
          descuento: 0, 
          recargo: montoRecargo, 
          tipo_descuento: '', 
          tipo_recargo: 'mora' 
        };
      }
    }
    
    return { descuento: 0, recargo: 0, tipo_descuento: '', tipo_recargo: '' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anioLectivoActivo) return;

    const montoTotal = parseFloat(formData.monto_total);
    const { descuento, recargo, tipo_descuento, tipo_recargo } = calcularDescuentoRecargo(
      formData.alumno_id,
      formData.mes,
      formData.anio,
      montoTotal
    );

    const data = {
      alumno_id: formData.alumno_id,
      tipo: formData.tipo,
      concepto: formData.concepto || `${formData.tipo} - ${MESES.find(m => m.value === formData.mes)?.label} ${formData.anio}`,
      mes: formData.mes,
      anio: formData.anio,
      monto_total: montoTotal,
      descuento: parseFloat(formData.descuento) || descuento,
      tipo_descuento: formData.tipo_descuento || tipo_descuento,
      recargo: parseFloat(formData.recargo) || recargo,
      tipo_recargo: formData.tipo_recargo || tipo_recargo,
      fecha_vencimiento: formData.fecha_vencimiento,
      comentarios: formData.comentarios,
    };

    const result = await post<Pago>('pagos', data);
    if (result) {
      toast.success('Pago creado correctamente');
      setIsDialogOpen(false);
      resetForm();
      triggerRefreshPagos();
    }
  };

  const handlePagoParcial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPago) return;

    const result = await post(`pagos/parcial`, {
      pago_id: selectedPago.id,
      monto: parseFloat(pagoParcialForm.monto),
      metodo_pago: pagoParcialForm.metodo_pago,
      comentarios: pagoParcialForm.comentarios,
    });

    if (result) {
      toast.success('Pago registrado correctamente');
      setIsPagoParcialDialogOpen(false);
      setPagoParcialForm({ monto: '', metodo_pago: 'efectivo', comentarios: '' });
      setSelectedPago(null);
      triggerRefreshPagos();
    }
  };

  const resetForm = () => {
    setFormData({
      alumno_id: '',
      tipo: 'mensualidad',
      concepto: '',
      mes: new Date().getMonth() + 1,
      anio: new Date().getFullYear(),
      monto_total: '',
      descuento: '0',
      tipo_descuento: '',
      recargo: '0',
      tipo_recargo: '',
      fecha_vencimiento: '',
      comentarios: '',
    });
  };

  const getEstadoBadge = (estado: string) => {
    const colors: Record<string, string> = {
      pagado: 'bg-green-100 text-green-800',
      parcial: 'bg-yellow-100 text-yellow-800',
      pendiente: 'bg-red-100 text-red-800',
      anulado: 'bg-gray-100 text-gray-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  const filteredPagos = pagos.filter(pago => {
    if (filtroEstado !== 'all' && pago.estado !== filtroEstado) return false;
    if (filtroMes !== 'all' && pago.mes !== parseInt(filtroMes)) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const concepto = String(pago.concepto || '').toLowerCase();
      const nombre = String(pago.alumno_nombre || '').toLowerCase();
      const apellido = String(pago.alumno_apellido || '').toLowerCase();
      return (
        concepto.includes(searchLower) ||
        nombre.includes(searchLower) ||
        apellido.includes(searchLower)
      );
    }
    return true;
  });

  const totalPendiente = filteredPagos
    .filter(p => p.estado !== 'pagado')
    .reduce((sum, p) => sum + (Number(p.saldo_pendiente) || 0), 0);

  const totalRecaudado = filteredPagos
    .filter(p => p.estado === 'pagado')
    .reduce((sum, p) => sum + (Number(p.monto_pagado) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pagos</h1>
          <p className="text-slate-500">Gestión de pagos y cobros</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pago
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Recaudado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRecaudado)}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pendiente</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPendiente)}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pagos</p>
                <p className="text-2xl font-bold text-slate-900">{filteredPagos.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por alumno o concepto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MESES.map((mes) => (
                  <SelectItem key={mes.value} value={mes.value.toString()}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Lista de Pagos ({filteredPagos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Alumno</th>
                    <th className="text-left py-3 px-4">Concepto</th>
                    <th className="text-left py-3 px-4">Monto Total</th>
                    <th className="text-left py-3 px-4">Pagado</th>
                    <th className="text-left py-3 px-4">Saldo</th>
                    <th className="text-left py-3 px-4">Estado</th>
                    <th className="text-left py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPagos.map((pago) => (
                    <tr key={pago.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-medium">{pago.alumno_apellido || '-'}, {pago.alumno_nombre || '-'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{pago.concepto || "-"}</p>
                        {pago.mes && (
                          <p className="text-sm text-slate-500">
                            {MESES.find(m => m.value === pago.mes)?.label} {pago.anio}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">{formatCurrency(pago.monto_total)}</td>
                      <td className="py-3 px-4">{formatCurrency(pago.monto_pagado)}</td>
                      <td className="py-3 px-4">
                        <span className={pago.saldo_pendiente > 0 ? 'text-red-600 font-medium' : ''}>
                          {formatCurrency(pago.saldo_pendiente)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getEstadoBadge(pago.estado)}>
                          {pago.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {pago.saldo_pendiente > 0 && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPago(pago);
                                setIsPagoParcialDialogOpen(true);
                              }}
                            >
                              Pagar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPagos.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No se encontraron pagos
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alumno">Alumno *</Label>
                <Select 
                  value={formData.alumno_id} 
                  onValueChange={(v) => setFormData({ ...formData, alumno_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar alumno" />
                  </SelectTrigger>
                  <SelectContent>
                    {alumnos.filter(a => a.estado === 'activo').filter((alumno) => Boolean(alumno.id)).map((alumno) => (
                      <SelectItem key={alumno.id} value={alumno.id}>
                        {alumno.apellido}, {alumno.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_PAGO.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="concepto">Concepto</Label>
                <Input
                  id="concepto"
                  value={formData.concepto}
                  onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                  placeholder="Dejar vacío para generar automáticamente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mes">Mes</Label>
                <Select 
                  value={formData.mes.toString()} 
                  onValueChange={(v) => setFormData({ ...formData, mes: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value.toString()}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="anio">Año</Label>
                <Input
                  id="anio"
                  type="number"
                  value={formData.anio}
                  onChange={(e) => setFormData({ ...formData, anio: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monto_total">Monto Total *</Label>
                <Input
                  id="monto_total"
                  type="number"
                  step="0.01"
                  value={formData.monto_total}
                  onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descuento">Descuento</Label>
                <Input
                  id="descuento"
                  type="number"
                  step="0.01"
                  value={formData.descuento}
                  onChange={(e) => setFormData({ ...formData, descuento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recargo">Recargo</Label>
                <Input
                  id="recargo"
                  type="number"
                  step="0.01"
                  value={formData.recargo}
                  onChange={(e) => setFormData({ ...formData, recargo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_vencimiento">Fecha Vencimiento</Label>
                <Input
                  id="fecha_vencimiento"
                  type="date"
                  value={formData.fecha_vencimiento}
                  onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="comentarios">Comentarios</Label>
                <Input
                  id="comentarios"
                  value={formData.comentarios}
                  onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Pago</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pago Parcial Dialog */}
      <Dialog open={isPagoParcialDialogOpen} onOpenChange={setIsPagoParcialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePagoParcial} className="space-y-4">
            <div>
              <Label>Concepto</Label>
              <p className="font-medium">{selectedPago?.concepto}</p>
              <p className="text-sm text-slate-500">
                Saldo pendiente: {formatCurrency(selectedPago?.saldo_pendiente || 0)}
              </p>
            </div>
            <div>
              <Label htmlFor="monto_parcial">Monto a Pagar *</Label>
              <Input
                id="monto_parcial"
                type="number"
                step="0.01"
                max={selectedPago?.saldo_pendiente}
                value={pagoParcialForm.monto}
                onChange={(e) => setPagoParcialForm({ ...pagoParcialForm, monto: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="metodo_pago_parcial">Método de Pago *</Label>
              <Select 
                value={pagoParcialForm.metodo_pago} 
                onValueChange={(v) => setPagoParcialForm({ ...pagoParcialForm, metodo_pago: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="comentarios_parcial">Comentarios</Label>
              <Input
                id="comentarios_parcial"
                value={pagoParcialForm.comentarios}
                onChange={(e) => setPagoParcialForm({ ...pagoParcialForm, comentarios: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPagoParcialDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar Pago</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
