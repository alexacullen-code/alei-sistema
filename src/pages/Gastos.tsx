import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Gasto } from '@/types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  TrendingDown, 
  Download,
  CreditCard,
  Calendar
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
  DialogDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIAS_GASTO } from '@/types';

export default function Gastos() {
  const { get, post, put, del } = useApi();
  const { gastos, setGastos, anioLectivoActivo } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPagoDialogOpen, setIsPagoDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
  const [gastoToDelete, setGastoToDelete] = useState<Gasto | null>(null);
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  
  const [formData, setFormData] = useState({
    concepto: '',
    categoria: 'otro',
    proveedor: '',
    monto_total: '',
    es_cuota: false,
    numero_cuotas: '1',
    fecha_gasto: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    numero_comprobante: '',
    tipo_comprobante: '',
    comentarios: '',
  });

  const [pagoForm, setPagoForm] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    comentarios: '',
  });

  useEffect(() => {
    loadData();
  }, [anioLectivoActivo]);

  const loadData = async () => {
    if (!anioLectivoActivo) return;
    
    setLoading(true);
    const data = await get<Gasto[]>('gastos');
    if (data) setGastos(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anioLectivoActivo) return;

    const data = {
      ...formData,
      anio_lectivo_id: anioLectivoActivo.id,
      monto_total: parseFloat(formData.monto_total) || 0,
      numero_cuotas: parseInt(formData.numero_cuotas) || 1,
    };

    let result;
    if (editingGasto) {
      result = await put<Gasto>(`gastos/${editingGasto.id}`, data);
      if (result) toast.success('Gasto actualizado correctamente');
    } else {
      result = await post<Gasto>('gastos', data);
      if (result) toast.success('Gasto creado correctamente');
    }

    if (result) {
      setIsDialogOpen(false);
      resetForm();
      loadData();
    }
  };

  const handlePago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGasto) return;

    const result = await post('gastos/pagar', {
      gasto_id: selectedGasto.id,
      monto: parseFloat(pagoForm.monto),
      metodo_pago: pagoForm.metodo_pago,
      comentarios: pagoForm.comentarios,
    });

    if (result) {
      toast.success('Pago registrado correctamente');
      setIsPagoDialogOpen(false);
      setPagoForm({ monto: '', metodo_pago: 'efectivo', comentarios: '' });
      setSelectedGasto(null);
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!gastoToDelete) return;
    
    const result = await del(`gastos/${gastoToDelete.id}`);
    if (result) {
      toast.success('Gasto eliminado correctamente');
      setIsDeleteDialogOpen(false);
      setGastoToDelete(null);
      loadData();
    }
  };

  const openEditDialog = (gasto: Gasto) => {
    setEditingGasto(gasto);
    setFormData({
      concepto: gasto.concepto,
      categoria: gasto.categoria,
      proveedor: gasto.proveedor || '',
      monto_total: gasto.monto_total.toString(),
      es_cuota: gasto.es_cuota,
      numero_cuotas: gasto.numero_cuotas.toString(),
      fecha_gasto: gasto.fecha_gasto,
      fecha_vencimiento: gasto.fecha_vencimiento || '',
      numero_comprobante: gasto.numero_comprobante || '',
      tipo_comprobante: gasto.tipo_comprobante || '',
      comentarios: gasto.comentarios || '',
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingGasto(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openPagoDialog = (gasto: Gasto) => {
    setSelectedGasto(gasto);
    setPagoForm({
      monto: (gasto.monto_total - gasto.monto_pagado).toString(),
      metodo_pago: 'efectivo',
      comentarios: '',
    });
    setIsPagoDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      concepto: '',
      categoria: 'otro',
      proveedor: '',
      monto_total: '',
      es_cuota: false,
      numero_cuotas: '1',
      fecha_gasto: new Date().toISOString().split('T')[0],
      fecha_vencimiento: '',
      numero_comprobante: '',
      tipo_comprobante: '',
      comentarios: '',
    });
  };

  const handleBackup = async () => {
    const data = await get('backup');
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-gastos-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Backup descargado');
    }
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

  const totalGastos = gastos.reduce((sum, g) => sum + g.monto_total, 0);
  const totalPagado = gastos.reduce((sum, g) => sum + g.monto_pagado, 0);
  const totalPendiente = totalGastos - totalPagado;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gastos</h1>
          <p className="text-slate-500">Control de gastos y compras en cuotas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleBackup}>
            <Download className="h-4 w-4 mr-2" />
            Backup
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Gastos</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalGastos)}</p>
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
                <p className="text-sm text-slate-500">Total Pagado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPagado)}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendiente</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalPendiente)}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Lista de Gastos ({gastos.length})
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
                    <th className="text-left py-3 px-4">Concepto</th>
                    <th className="text-left py-3 px-4">Categoría</th>
                    <th className="text-left py-3 px-4">Monto Total</th>
                    <th className="text-left py-3 px-4">Pagado</th>
                    <th className="text-left py-3 px-4">Estado</th>
                    <th className="text-left py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((gasto) => (
                    <tr key={gasto.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-medium">{gasto.concepto}</p>
                        {gasto.es_cuota && (
                          <p className="text-sm text-slate-500">
                            Cuota {gasto.cuota_actual} de {gasto.numero_cuotas}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">
                          {gasto.categoria}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{formatCurrency(gasto.monto_total)}</td>
                      <td className="py-3 px-4">{formatCurrency(gasto.monto_pagado)}</td>
                      <td className="py-3 px-4">
                        <Badge className={getEstadoBadge(gasto.estado)}>
                          {gasto.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {gasto.estado !== 'pagado' && (
                            <Button
                              size="sm"
                              onClick={() => openPagoDialog(gasto)}
                            >
                              Pagar
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(gasto)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setGastoToDelete(gasto);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gastos.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No se encontraron gastos
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGasto ? 'Editar Gasto' : 'Nuevo Gasto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="concepto">Concepto *</Label>
                <Input
                  id="concepto"
                  value={formData.concepto}
                  onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría *</Label>
                <Select 
                  value={formData.categoria} 
                  onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_GASTO.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proveedor">Proveedor</Label>
                <Input
                  id="proveedor"
                  value={formData.proveedor}
                  onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
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
                <Label htmlFor="fecha_gasto">Fecha *</Label>
                <Input
                  id="fecha_gasto"
                  type="date"
                  value={formData.fecha_gasto}
                  onChange={(e) => setFormData({ ...formData, fecha_gasto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="es_cuota"
                    checked={formData.es_cuota}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, es_cuota: checked as boolean })
                    }
                  />
                  <Label htmlFor="es_cuota">Es compra en cuotas</Label>
                </div>
              </div>
              {formData.es_cuota && (
                <div className="space-y-2">
                  <Label htmlFor="numero_cuotas">Número de Cuotas</Label>
                  <Input
                    id="numero_cuotas"
                    type="number"
                    value={formData.numero_cuotas}
                    onChange={(e) => setFormData({ ...formData, numero_cuotas: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="numero_comprobante">Número Comprobante</Label>
                <Input
                  id="numero_comprobante"
                  value={formData.numero_comprobante}
                  onChange={(e) => setFormData({ ...formData, numero_comprobante: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo_comprobante">Tipo Comprobante</Label>
                <Select 
                  value={formData.tipo_comprobante} 
                  onValueChange={(v) => setFormData({ ...formData, tipo_comprobante: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="recibo">Recibo</SelectItem>
                    <SelectItem value="ticket">Ticket</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
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
              <Button type="submit">
                {editingGasto ? 'Guardar Cambios' : 'Crear Gasto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pago Dialog */}
      <Dialog open={isPagoDialogOpen} onOpenChange={setIsPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePago} className="space-y-4">
            <div>
              <Label>Concepto</Label>
              <p className="font-medium">{selectedGasto?.concepto}</p>
              <p className="text-sm text-slate-500">
                Pendiente: {formatCurrency((selectedGasto?.monto_total || 0) - (selectedGasto?.monto_pagado || 0))}
              </p>
            </div>
            <div>
              <Label htmlFor="monto_gasto">Monto a Pagar *</Label>
              <Input
                id="monto_gasto"
                type="number"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="metodo_pago_gasto">Método de Pago *</Label>
              <Select 
                value={pagoForm.metodo_pago} 
                onValueChange={(v) => setPagoForm({ ...pagoForm, metodo_pago: v })}
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
              <Label htmlFor="comentarios_gasto">Comentarios</Label>
              <Input
                id="comentarios_gasto"
                value={pagoForm.comentarios}
                onChange={(e) => setPagoForm({ ...pagoForm, comentarios: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPagoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar Pago</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de eliminar el gasto "{gastoToDelete?.concepto}"?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
