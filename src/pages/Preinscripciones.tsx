import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Preinscripcion, Nivel, Alumno } from '@/types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  UserCheck
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Preinscripciones() {
  const { get, post, put, del } = useApi();
  const { preinscripciones, setPreinscripciones, niveles, setNiveles, anioLectivoActivo } = useStore();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPre, setEditingPre] = useState<Preinscripcion | null>(null);
  const [preToDelete, setPreToDelete] = useState<Preinscripcion | null>(null);
  const [preToConvert, setPreToConvert] = useState<Preinscripcion | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    fecha_nacimiento: '',
    email: '',
    telefono: '',
    telefono_alternativo: '',
    nombre_tutor: '',
    telefono_tutor: '',
    nivel_interesado_id: '',
    horario_preferido: '',
    fuente: 'web',
    comentarios: '',
  });

  const [convertForm, setConvertForm] = useState({
    nivel_id: '',
  });

  useEffect(() => {
    loadData();
  }, [anioLectivoActivo]);

  const loadData = async () => {
    if (!anioLectivoActivo) return;
    
    const [preData, nivelesData] = await Promise.all([
      get<Preinscripcion[]>('preinscripciones'),
      get<Nivel[]>('niveles')
    ]);
    
    if (preData) setPreinscripciones(preData);
    if (nivelesData) setNiveles(nivelesData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anioLectivoActivo) return;

    const data = {
      ...formData,
      anio_lectivo_id: anioLectivoActivo.id,
    };

    let result;
    if (editingPre) {
      result = await put<Preinscripcion>(`preinscripciones/${editingPre.id}`, data);
      if (result) toast.success('Pre-inscripción actualizada');
    } else {
      result = await post<Preinscripcion>('preinscripciones', data);
      if (result) toast.success('Pre-inscripción creada');
    }

    if (result) {
      setIsDialogOpen(false);
      resetForm();
      loadData();
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preToConvert || !anioLectivoActivo) return;

    const data = {
      anio_lectivo_id: anioLectivoActivo.id,
      cedula: preToConvert.cedula,
      nombre: preToConvert.nombre,
      apellido: preToConvert.apellido,
      fecha_nacimiento: preToConvert.fecha_nacimiento,
      email: preToConvert.email,
      telefono: preToConvert.telefono,
      telefono_alternativo: preToConvert.telefono_alternativo,
      nombre_tutor: preToConvert.nombre_tutor,
      telefono_tutor: preToConvert.telefono_tutor,
      nivel_id: convertForm.nivel_id || preToConvert.nivel_interesado_id,
    };

    const result = await post<Alumno>(`preinscripciones/${preToConvert.id}/convertir`, data);
    if (result) {
      toast.success('Convertido a alumno exitosamente');
      setIsConvertDialogOpen(false);
      setPreToConvert(null);
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!preToDelete) return;
    
    const result = await del(`preinscripciones/${preToDelete.id}`);
    if (result) {
      toast.success('Pre-inscripción eliminada');
      setIsDeleteDialogOpen(false);
      setPreToDelete(null);
      loadData();
    }
  };

  const openEditDialog = (pre: Preinscripcion) => {
    setEditingPre(pre);
    setFormData({
      nombre: pre.nombre,
      apellido: pre.apellido,
      cedula: pre.cedula || '',
      fecha_nacimiento: pre.fecha_nacimiento || '',
      email: pre.email || '',
      telefono: pre.telefono || '',
      telefono_alternativo: pre.telefono_alternativo || '',
      nombre_tutor: pre.nombre_tutor || '',
      telefono_tutor: pre.telefono_tutor || '',
      nivel_interesado_id: pre.nivel_interesado_id || '',
      horario_preferido: pre.horario_preferido || '',
      fuente: pre.fuente || 'web',
      comentarios: pre.comentarios || '',
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPre(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openConvertDialog = (pre: Preinscripcion) => {
    setPreToConvert(pre);
    setConvertForm({ nivel_id: pre.nivel_interesado_id || '' });
    setIsConvertDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      cedula: '',
      fecha_nacimiento: '',
      email: '',
      telefono: '',
      telefono_alternativo: '',
      nombre_tutor: '',
      telefono_tutor: '',
      nivel_interesado_id: '',
      horario_preferido: '',
      fuente: 'web',
      comentarios: '',
    });
  };

  const getEstadoBadge = (estado: string) => {
    const colors: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      contactado: 'bg-blue-100 text-blue-800',
      convertido: 'bg-green-100 text-green-800',
      rechazado: 'bg-red-100 text-red-800',
      lista_espera: 'bg-purple-100 text-purple-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  const filteredByEstado = (estado: string) => 
    preinscripciones.filter(p => p.estado === estado);

  const renderTable = (lista: Preinscripcion[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4">Nombre</th>
            <th className="text-left py-3 px-4">Contacto</th>
            <th className="text-left py-3 px-4">Nivel Interesado</th>
            <th className="text-left py-3 px-4">Estado</th>
            <th className="text-left py-3 px-4">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((pre) => (
            <tr key={pre.id} className="border-b hover:bg-slate-50">
              <td className="py-3 px-4">
                <p className="font-medium">{pre.apellido}, {pre.nombre}</p>
              </td>
              <td className="py-3 px-4">
                <div className="text-sm">
                  <p>{pre.telefono || '-'}</p>
                  <p className="text-slate-500">{pre.email || ''}</p>
                </div>
              </td>
              <td className="py-3 px-4">{pre.nivel_nombre || '-'}</td>
              <td className="py-3 px-4">
                <Badge className={getEstadoBadge(pre.estado)}>
                  {pre.estado}
                </Badge>
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-2">
                  {pre.estado === 'pendiente' && (
                    <Button
                      size="sm"
                      onClick={() => openConvertDialog(pre)}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Convertir
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => openEditDialog(pre)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      setPreToDelete(pre);
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
      {lista.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          No hay pre-inscripciones en esta categoría
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pre-inscripciones</h1>
          <p className="text-slate-500">Lista de espera y pre-inscripciones</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Pre-inscripción
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {['pendiente', 'contactado', 'convertido', 'rechazado', 'lista_espera'].map((estado) => (
          <Card key={estado}>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 capitalize">{estado.replace('_', ' ')}</p>
              <p className="text-2xl font-bold">{filteredByEstado(estado).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pendiente">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
          <TabsTrigger value="contactado">Contactados</TabsTrigger>
          <TabsTrigger value="convertido">Convertidos</TabsTrigger>
          <TabsTrigger value="lista_espera">Lista Espera</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pendiente">
          <Card>
            <CardHeader>
              <CardTitle>Pendientes ({filteredByEstado('pendiente').length})</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(filteredByEstado('pendiente'))}</CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="contactado">
          <Card>
            <CardHeader>
              <CardTitle>Contactados ({filteredByEstado('contactado').length})</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(filteredByEstado('contactado'))}</CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="convertido">
          <Card>
            <CardHeader>
              <CardTitle>Convertidos ({filteredByEstado('convertido').length})</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(filteredByEstado('convertido'))}</CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="lista_espera">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Espera ({filteredByEstado('lista_espera').length})</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(filteredByEstado('lista_espera'))}</CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="todos">
          <Card>
            <CardHeader>
              <CardTitle>Todos ({preinscripciones.length})</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(preinscripciones)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPre ? 'Editar Pre-inscripción' : 'Nueva Pre-inscripción'}
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
                <Label htmlFor="apellido">Apellido *</Label>
                <Input
                  id="apellido"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula</Label>
                <Input
                  id="cedula"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
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
                <Label htmlFor="telefono_alt">Teléfono Alternativo</Label>
                <Input
                  id="telefono_alt"
                  value={formData.telefono_alternativo}
                  onChange={(e) => setFormData({ ...formData, telefono_alternativo: e.target.value })}
                />
              </div>
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
                <Label htmlFor="nivel">Nivel Interesado</Label>
                <Select 
                  value={formData.nivel_interesado_id} 
                  onValueChange={(v) => setFormData({ ...formData, nivel_interesado_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    {niveles.filter((nivel) => Boolean(nivel.id)).map((nivel) => (
                      <SelectItem key={nivel.id} value={nivel.id}>
                        {nivel.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario">Horario Preferido</Label>
                <Input
                  id="horario"
                  value={formData.horario_preferido}
                  onChange={(e) => setFormData({ ...formData, horario_preferido: e.target.value })}
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
              <Button type="submit">
                {editingPre ? 'Guardar Cambios' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir a Alumno</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConvert} className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Convirtiendo:</p>
              <p className="font-medium">{preToConvert?.apellido}, {preToConvert?.nombre}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nivel_convert">Nivel a asignar</Label>
              <Select 
                value={convertForm.nivel_id} 
                onValueChange={(v) => setConvertForm({ ...convertForm, nivel_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nivel" />
                </SelectTrigger>
                <SelectContent>
                  {niveles.filter((nivel) => Boolean(nivel.id)).map((nivel) => (
                    <SelectItem key={nivel.id} value={nivel.id}>
                      {nivel.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConvertDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Convertir</Button>
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
              ¿Está seguro de eliminar la pre-inscripción de {preToDelete?.nombre} {preToDelete?.apellido}?
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
