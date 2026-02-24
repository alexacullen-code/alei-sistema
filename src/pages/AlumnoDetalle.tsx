import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import type { Alumno, Pago } from '@/types';
import { 
  ArrowLeft, 
  CreditCard, 
  BookOpen, 
  User, 
  Phone, 
  Mail,
  MessageCircle,
  Edit2,
  TrendingDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AlumnoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { get, post } = useApi();
  
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPagoDialogOpen, setIsPagoDialogOpen] = useState(false);
  const [pagoForm, setPagoForm] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    comentarios: '',
  });
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);

  useEffect(() => {
    if (id) loadAlumno();
  }, [id]);

  const loadAlumno = async () => {
    setLoading(true);
    const data = await get<Alumno>(`alumnos/${id}`);
    if (data) {
      setAlumno(data);
    }
    setLoading(false);
  };

  const handleRegistrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPago) return;

    const result = await post(`pagos/parcial`, {
      pago_id: selectedPago.id,
      monto: parseFloat(pagoForm.monto),
      metodo_pago: pagoForm.metodo_pago,
      comentarios: pagoForm.comentarios,
    });

    if (result) {
      toast.success('Pago registrado correctamente');
      setIsPagoDialogOpen(false);
      setPagoForm({ monto: '', metodo_pago: 'efectivo', comentarios: '' });
      setSelectedPago(null);
      loadAlumno();
    }
  };

  const generarMensajeWhatsApp = async (tipo: string) => {
    const data = await get<{ mensaje: string; telefono: string }>(`whatsapp/${id}?tipo=${tipo}`);
    if (data) {
      const mensaje = encodeURIComponent(data.mensaje);
      const url = `https://wa.me/${data.telefono}?text=${mensaje}`;
      window.open(url, '_blank');
    }
  };

  const getEstadoBadge = (estado: string) => {
    const colors: Record<string, string> = {
      activo: 'bg-green-100 text-green-800',
      inactivo: 'bg-gray-100 text-gray-800',
      egresado: 'bg-blue-100 text-blue-800',
      suspendido: 'bg-red-100 text-red-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoPagoBadge = (estado: string) => {
    const colors: Record<string, string> = {
      pagado: 'bg-green-100 text-green-800',
      parcial: 'bg-yellow-100 text-yellow-800',
      pendiente: 'bg-red-100 text-red-800',
      anulado: 'bg-gray-100 text-gray-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!alumno) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Alumno no encontrado</p>
        <Button onClick={() => navigate('/alumnos')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/alumnos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {alumno.apellido}, {alumno.nombre}
            </h1>
            <p className="text-slate-500 flex items-center gap-2">
              <span>CI: {alumno.cedula}</span>
              <Badge className={getEstadoBadge(alumno.estado)}>
                {alumno.estado}
              </Badge>
              {alumno.es_hermano && (
                <Badge variant="secondary">Hermanos</Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => generarMensajeWhatsApp('cobranza')}>
            <MessageCircle className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          <Button asChild>
            <Link to={`/alumnos/${alumno.id}/editar`}>
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Teléfono</p>
                <p className="font-medium">{alumno.telefono || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium">{alumno.email || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <TrendingDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Deuda Total</p>
                <p className={`font-bold text-lg ${alumno.total_deuda && alumno.total_deuda > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(alumno.total_deuda || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="libros">Libros</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Datos Personales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Fecha de Nacimiento</p>
                    <p className="font-medium">{formatDate(alumno.fecha_nacimiento) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Teléfono Alternativo</p>
                    <p className="font-medium">{alumno.telefono_alternativo || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Dirección</p>
                  <p className="font-medium">{alumno.direccion || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Nivel</p>
                  <p className="font-medium">{alumno.nivel_nombre || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Fecha de Matrícula</p>
                  <p className="font-medium">{formatDate(alumno.fecha_matricula) || '-'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Datos del Tutor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Nombre</p>
                  <p className="font-medium">{alumno.nombre_tutor || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Teléfono</p>
                  <p className="font-medium">{alumno.telefono_tutor || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{alumno.email_tutor || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Relación</p>
                  <p className="font-medium capitalize">{alumno.relacion_tutor || '-'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Historial de Pagos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alumno.pagos && alumno.pagos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Concepto</th>
                        <th className="text-left py-3 px-4">Monto Total</th>
                        <th className="text-left py-3 px-4">Pagado</th>
                        <th className="text-left py-3 px-4">Saldo</th>
                        <th className="text-left py-3 px-4">Estado</th>
                        <th className="text-left py-3 px-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumno.pagos.map((pago) => (
                        <tr key={pago.id} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <p className="font-medium">{pago.concepto}</p>
                            {pago.mes && (
                              <p className="text-sm text-slate-500">
                                {pago.mes}/{pago.anio}
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
                            <Badge className={getEstadoPagoBadge(pago.estado)}>
                              {pago.estado}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {pago.saldo_pendiente > 0 && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedPago(pago);
                                  setIsPagoDialogOpen(true);
                                }}
                              >
                                Pagar
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-slate-500">No hay pagos registrados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="libros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Libros Prestados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alumno.prestamos && alumno.prestamos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Libro</th>
                        <th className="text-left py-3 px-4">Fecha Préstamo</th>
                        <th className="text-left py-3 px-4">Fecha Devolución</th>
                        <th className="text-left py-3 px-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumno.prestamos.map((prestamo) => (
                        <tr key={prestamo.id} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">{prestamo.libro_titulo}</td>
                          <td className="py-3 px-4">{formatDate(prestamo.fecha_prestamo)}</td>
                          <td className="py-3 px-4">
                            {formatDate(prestamo.fecha_devolucion_real) || 
                             formatDate(prestamo.fecha_devolucion_esperada) || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={
                              prestamo.estado === 'devuelto' ? 'bg-green-100 text-green-800' :
                              prestamo.estado === 'prestado' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {prestamo.estado}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-slate-500">No hay libros prestados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pago Dialog */}
      <Dialog open={isPagoDialogOpen} onOpenChange={setIsPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago Parcial</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegistrarPago} className="space-y-4">
            <div>
              <Label>Concepto</Label>
              <p className="font-medium">{selectedPago?.concepto}</p>
              <p className="text-sm text-slate-500">
                Saldo pendiente: {formatCurrency(selectedPago?.saldo_pendiente || 0)}
              </p>
            </div>
            <div>
              <Label htmlFor="monto">Monto a Pagar *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="metodo_pago">Método de Pago *</Label>
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
              <Label htmlFor="comentarios">Comentarios</Label>
              <Input
                id="comentarios"
                value={pagoForm.comentarios}
                onChange={(e) => setPagoForm({ ...pagoForm, comentarios: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPagoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar Pago</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
