import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Alumno, Pago } from '@/types';
import { 
  CreditCard, 
  CheckCircle, 
  User,
  DollarSign,
  FileText,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { TIPOS_PAGO } from '@/types';

export default function CajaRapida() {
  const { get, post } = useApi();
  const { alumnos, setAlumnos, anioLectivoActivo } = useStore();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    alumno_id: '',
    concepto: '',
    tipo: 'mensualidad' as const,
    monto: '',
    metodo_pago: 'efectivo' as const,
    comentarios: '',
  });
  const [ultimosPagos, setUltimosPagos] = useState<Pago[]>([]);

  useEffect(() => {
    loadData();
  }, [anioLectivoActivo]);

  const loadData = async () => {
    if (!anioLectivoActivo) return;
    
    const [alumnosData, pagosData] = await Promise.all([
      get<Alumno[]>('alumnos'),
      get<Pago[]>('pagos', { limit: '5' })
    ]);
    
    if (alumnosData) setAlumnos(alumnosData);
    if (pagosData) setUltimosPagos(pagosData.slice(0, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anioLectivoActivo) return;

    setLoading(true);
    const result = await post<Pago>('caja-rapida', {
      alumno_id: formData.alumno_id,
      concepto: formData.concepto || `${formData.tipo} - ${new Date().toLocaleDateString()}`,
      tipo: formData.tipo,
      monto: parseFloat(formData.monto),
      metodo_pago: formData.metodo_pago,
      comentarios: formData.comentarios,
    });

    if (result) {
      toast.success('Pago registrado correctamente');
      setFormData({
        alumno_id: '',
        concepto: '',
        tipo: 'mensualidad',
        monto: '',
        metodo_pago: 'efectivo',
        comentarios: '',
      });
      loadData();
    }
    setLoading(false);
  };

  const selectedAlumno = alumnos.find(a => a.id === formData.alumno_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Caja Rápida</h1>
        <p className="text-slate-500">Registro rápido de pagos (3 clicks)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Registrar Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alumno">Alumno *</Label>
                <Select 
                  value={formData.alumno_id} 
                  onValueChange={(v) => setFormData({ ...formData, alumno_id: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Seleccionar alumno..." />
                  </SelectTrigger>
                  <SelectContent>
                    {alumnos.filter(a => a.estado === 'activo').map((alumno) => (
                      <SelectItem key={alumno.id} value={alumno.id}>
                        {alumno.apellido}, {alumno.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAlumno && (
                <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {selectedAlumno.apellido}, {selectedAlumno.nombre}
                    </p>
                    <p className="text-sm text-blue-600">
                      {selectedAlumno.nivel_nombre || 'Sin nivel'}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}
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

              <div className="space-y-2">
                <Label htmlFor="concepto">Concepto</Label>
                <Input
                  id="concepto"
                  value={formData.concepto}
                  onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                  placeholder="Ej: Mensualidad Marzo 2025"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monto">Monto *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    value={formData.monto}
                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                    className="pl-10"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metodo_pago">Método de Pago *</Label>
                <Select 
                  value={formData.metodo_pago} 
                  onValueChange={(v: any) => setFormData({ ...formData, metodo_pago: v })}
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

              <div className="space-y-2">
                <Label htmlFor="comentarios">Comentarios</Label>
                <Input
                  id="comentarios"
                  value={formData.comentarios}
                  onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg"
                disabled={loading || !formData.alumno_id || !formData.monto}
              >
                {loading ? (
                  'Procesando...'
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Registrar Pago
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Últimos pagos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Últimos Pagos Registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ultimosPagos.map((pago) => (
                <div 
                  key={pago.id} 
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{pago.alumno_apellido}, {pago.alumno_nombre}</p>
                    <p className="text-sm text-slate-500">{pago.concepto}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {formatCurrency(pago.monto_pagado)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(pago.created_at || '').toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {ultimosPagos.length === 0 && (
                <p className="text-center py-8 text-slate-500">
                  No hay pagos registrados hoy
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
