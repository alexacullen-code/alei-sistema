import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Alumno, Nivel } from '@/types';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  Users,
  Download
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
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Alumnos() {
  const { get, post, put, del } = useApi();
  const { 
    alumnos, 
    setAlumnos, 
    niveles, 
    setNiveles, 
    anioLectivoActivo,
    triggerRefreshAlumnos,
    refreshAlumnos
  } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedNivel, setSelectedNivel] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAlumno, setEditingAlumno] = useState<Alumno | null>(null);
  const [alumnoToDelete, setAlumnoToDelete] = useState<Alumno | null>(null);
  
  const [formData, setFormData] = useState<Partial<Alumno>>({
    cedula: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    telefono_alternativo: '',
    direccion: '',
    nombre_tutor: '',
    telefono_tutor: '',
    email_tutor: '',
    relacion_tutor: '',
    nivel_id: '',
    es_hermano: false,
    cuota_especial: undefined,
    estado: 'activo',
  });

  useEffect(() => {
    loadData();
  }, [anioLectivoActivo, refreshAlumnos]);

  const loadData = async () => {
    if (!anioLectivoActivo) return;
    
    setLoading(true);
    const [alumnosData, nivelesData] = await Promise.all([
      get<Alumno[]>('alumnos'),
      get<Nivel[]>('niveles')
    ]);
    
    if (alumnosData) setAlumnos(alumnosData);
    if (nivelesData) setNiveles(nivelesData);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!anioLectivoActivo) return;
    
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (selectedNivel !== 'all') params.nivel_id = selectedNivel;
    
    const data = await get<Alumno[]>('alumnos', params);
    if (data) setAlumnos(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anioLectivoActivo) return;

    const data = {
      ...formData,
      anio_lectivo_id: anioLectivoActivo.id,
    };

    let result;
    if (editingAlumno) {
      result = await put<Alumno>(`alumnos/${editingAlumno.id}`, data);
      if (result) toast.success('Alumno actualizado correctamente');
    } else {
      result = await post<Alumno>('alumnos', data);
      if (result) toast.success('Alumno creado correctamente');
    }

    if (result) {
      setIsDialogOpen(false);
      resetForm();
      triggerRefreshAlumnos();
    }
  };

  const handleDelete = async () => {
    if (!alumnoToDelete) return;
    
    const result = await del(`alumnos/${alumnoToDelete.id}`);
    if (result) {
      toast.success('Alumno eliminado correctamente');
      setIsDeleteDialogOpen(false);
      setAlumnoToDelete(null);
      triggerRefreshAlumnos();
    }
  };

  const openEditDialog = (alumno: Alumno) => {
    setEditingAlumno(alumno);
    setFormData({
      cedula: alumno.cedula,
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      email: alumno.email || '',
      telefono: alumno.telefono || '',
      telefono_alternativo: alumno.telefono_alternativo || '',
      direccion: alumno.direccion || '',
      nombre_tutor: alumno.nombre_tutor || '',
      telefono_tutor: alumno.telefono_tutor || '',
      email_tutor: alumno.email_tutor || '',
      relacion_tutor: alumno.relacion_tutor || '',
      nivel_id: alumno.nivel_id || '',
      es_hermano: alumno.es_hermano,
      cuota_especial: alumno.cuota_especial,
      estado: alumno.estado,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAlumno(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      cedula: '',
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      telefono_alternativo: '',
      direccion: '',
      nombre_tutor: '',
      telefono_tutor: '',
      email_tutor: '',
      relacion_tutor: '',
      nivel_id: '',
      es_hermano: false,
      cuota_especial: undefined,
      estado: 'activo',
    });
  };

  const handleBackup = async () => {
    const data = await get('backup');
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-alumnos-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Backup descargado');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alumnos</h1>
          <p className="text-slate-500">Gestión de alumnos del instituto</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleBackup}>
            <Download className="h-4 w-4 mr-2" />
            Backup
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Alumno
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, apellido o cédula..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select value={selectedNivel} onValueChange={setSelectedNivel}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Todos los niveles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                {niveles.map((nivel) => (
                  <SelectItem key={nivel.id} value={nivel.id}>
                    {nivel.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} variant="secondary">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Alumnos ({alumnos.length})
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
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Cédula</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Nivel</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Contacto</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.map((alumno) => (
                    <tr key={alumno.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">{alumno.cedula}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{alumno.apellido}, {alumno.nombre}</p>
                          {alumno.es_hermano && (
                            <Badge variant="secondary" className="text-xs">Hermanos</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{alumno.nivel_nombre || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <p>{alumno.telefono || '-'}</p>
                          <p className="text-slate-500">{alumno.email || ''}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getEstadoBadge(alumno.estado)}>
                          {alumno.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/alumnos/${alumno.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(alumno)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setAlumnoToDelete(alumno);
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
              {alumnos.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No se encontraron alumnos
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
              {editingAlumno ? 'Editar Alumno' : 'Nuevo Alumno'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula *</Label>
                <Input
                  id="cedula"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  required
                />
              </div>
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
                <Label htmlFor="apellido">Apellido *</Label>
                <Input
                  id="apellido"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono_alternativo">Teléfono Alternativo</Label>
                <Input
                  id="telefono_alternativo"
                  value={formData.telefono_alternativo}
                  onChange={(e) => setFormData({ ...formData, telefono_alternativo: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Datos del Tutor</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre_tutor">Nombre del Tutor</Label>
                  <Input
                    id="nombre_tutor"
                    value={formData.nombre_tutor}
                    onChange={(e) => setFormData({ ...formData, nombre_tutor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono_tutor">Teléfono del Tutor</Label>
                  <Input
                    id="telefono_tutor"
                    value={formData.telefono_tutor}
                    onChange={(e) => setFormData({ ...formData, telefono_tutor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_tutor">Email del Tutor</Label>
                  <Input
                    id="email_tutor"
                    type="email"
                    value={formData.email_tutor}
                    onChange={(e) => setFormData({ ...formData, email_tutor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relacion_tutor">Relación</Label>
                  <Select 
                    value={formData.relacion_tutor} 
                    onValueChange={(v) => setFormData({ ...formData, relacion_tutor: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padre">Padre</SelectItem>
                      <SelectItem value="madre">Madre</SelectItem>
                      <SelectItem value="tutor">Tutor</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Información Académica</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nivel">Nivel</Label>
                  <Select 
                    value={formData.nivel_id} 
                    onValueChange={(v) => setFormData({ ...formData, nivel_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      {niveles.map((nivel) => (
                        <SelectItem key={nivel.id} value={nivel.id}>
                          {nivel.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select 
                    value={formData.estado} 
                    onValueChange={(v: any) => setFormData({ ...formData, estado: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                      <SelectItem value="egresado">Egresado</SelectItem>
                      <SelectItem value="suspendido">Suspendido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuota_especial">Cuota Especial (Hermanos)</Label>
                  <Input
                    id="cuota_especial"
                    type="number"
                    value={formData.cuota_especial || ''}
                    onChange={(e) => setFormData({ ...formData, cuota_especial: parseFloat(e.target.value) || undefined })}
                    placeholder="Dejar vacío para usar cuota del nivel"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingAlumno ? 'Guardar Cambios' : 'Crear Alumno'}
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
              ¿Está seguro de eliminar a {alumnoToDelete?.nombre} {alumnoToDelete?.apellido}?
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
