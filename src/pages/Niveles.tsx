import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Nivel } from '@/types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  GraduationCap, 
  Users,
  Download,
  Clock,
  User
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

export default function Niveles() {
  const { get, post, put, del } = useApi();
  const { niveles, setNiveles, anioLectivoActivo } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingNivel, setEditingNivel] = useState<Nivel | null>(null);
  const [nivelToDelete, setNivelToDelete] = useState<Nivel | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    capacidad_maxima: '30',
    cuota_mensual: '',
    horario: '',
    profesor: '',
    activo: true,
  });

  useEffect(() => {
    loadData();
  }, [anioLectivoActivo]);

  const loadData = async () => {
    if (!anioLectivoActivo) return;
    
    setLoading(true);
    const data = await get<Nivel[]>('niveles');
    if (data) setNiveles(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anioLectivoActivo) return;

    const data = {
      ...formData,
      anio_lectivo_id: anioLectivoActivo.id,
      capacidad_maxima: parseInt(formData.capacidad_maxima) || 30,
      cuota_mensual: parseFloat(formData.cuota_mensual) || 0,
    };

    let result;
    if (editingNivel) {
      result = await put<Nivel>(`niveles/${editingNivel.id}`, data);
      if (result) toast.success('Nivel actualizado correctamente');
    } else {
      result = await post<Nivel>('niveles', data);
      if (result) toast.success('Nivel creado correctamente');
    }

    if (result) {
      setIsDialogOpen(false);
      resetForm();
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!nivelToDelete) return;
    
    const result = await del(`niveles/${nivelToDelete.id}`);
    if (result) {
      toast.success('Nivel eliminado correctamente');
      setIsDeleteDialogOpen(false);
      setNivelToDelete(null);
      loadData();
    }
  };

  const openEditDialog = (nivel: Nivel) => {
    setEditingNivel(nivel);
    setFormData({
      nombre: nivel.nombre,
      descripcion: nivel.descripcion || '',
      capacidad_maxima: nivel.capacidad_maxima.toString(),
      cuota_mensual: nivel.cuota_mensual.toString(),
      horario: nivel.horario || '',
      profesor: nivel.profesor || '',
      activo: nivel.activo,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingNivel(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      capacidad_maxima: '30',
      cuota_mensual: '',
      horario: '',
      profesor: '',
      activo: true,
    });
  };

  const handleBackup = async () => {
    const data = await get('backup');
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-niveles-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Backup descargado');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Niveles</h1>
          <p className="text-slate-500">Gestión de cursos y niveles</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleBackup}>
            <Download className="h-4 w-4 mr-2" />
            Backup
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Nivel
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {niveles.map((nivel) => (
            <Card key={nivel.id} className={!nivel.activo ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      {nivel.nombre}
                    </CardTitle>
                    {nivel.descripcion && (
                      <p className="text-sm text-slate-500 mt-1">{nivel.descripcion}</p>
                    )}
                  </div>
                  {!nivel.activo && (
                    <Badge variant="secondary">Inactivo</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span>{nivel.alumnos_count || 0} / {nivel.capacidad_maxima} alumnos</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>{nivel.horario || 'Sin horario'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-slate-400" />
                  <span>{nivel.profesor || 'Sin profesor asignado'}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-slate-500">Cuota mensual</p>
                  <p className="text-lg font-semibold">{formatCurrency(nivel.cuota_mensual)}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(nivel)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      setNivelToDelete(nivel);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && niveles.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No hay niveles creados</p>
          <Button onClick={openCreateDialog} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Crear primer nivel
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNivel ? 'Editar Nivel' : 'Nuevo Nivel'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacidad">Capacidad Máxima</Label>
                <Input
                  id="capacidad"
                  type="number"
                  value={formData.capacidad_maxima}
                  onChange={(e) => setFormData({ ...formData, capacidad_maxima: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuota">Cuota Mensual</Label>
                <Input
                  id="cuota"
                  type="number"
                  step="0.01"
                  value={formData.cuota_mensual}
                  onChange={(e) => setFormData({ ...formData, cuota_mensual: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario">Horario</Label>
                <Input
                  id="horario"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  placeholder="Ej: Lunes y Miércoles 18:00-20:00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profesor">Profesor</Label>
                <Input
                  id="profesor"
                  value={formData.profesor}
                  onChange={(e) => setFormData({ ...formData, profesor: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="activo"
                    checked={formData.activo}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, activo: checked })
                    }
                  />
                  <Label htmlFor="activo">Nivel activo</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingNivel ? 'Guardar Cambios' : 'Crear Nivel'}
              </Button>
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
              ¿Está seguro de eliminar el nivel "{nivelToDelete?.nombre}"?
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
