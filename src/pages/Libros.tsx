import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Libro, Nivel, Alumno } from '@/types';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  BookOpen, 
  Download,
  ArrowRightLeft
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
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

export default function Libros() {
  const { get, post, put, del } = useApi();
  const { 
    libros, 
    setLibros, 
    niveles, 
    setNiveles, 
    alumnos,
    setAlumnos,
    anioLectivoActivo 
  } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPrestamoDialogOpen, setIsPrestamoDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingLibro, setEditingLibro] = useState<Libro | null>(null);
  const [libroToDelete, setLibroToDelete] = useState<Libro | null>(null);
  const [selectedLibro, setSelectedLibro] = useState<Libro | null>(null);
  
  const [formData, setFormData] = useState({
    codigo: '',
    titulo: '',
    autor: '',
    editorial: '',
    materia: '',
    nivel_id: '',
    precio: '',
    stock_total: '',
    descripcion: '',
  });

  const [prestamoForm, setPrestamoForm] = useState({
    alumno_id: '',
    fecha_prestamo: new Date().toISOString().split('T')[0],
    fecha_devolucion_esperada: '',
    observaciones: '',
  });

  useEffect(() => {
    loadData();
  }, [anioLectivoActivo]);

  const loadData = async () => {
    if (!anioLectivoActivo) return;
    
    setLoading(true);
    const [librosData, nivelesData, alumnosData] = await Promise.all([
      get<Libro[]>('libros'),
      get<Nivel[]>('niveles'),
      get<Alumno[]>('alumnos')
    ]);
    
    if (librosData) setLibros(librosData);
    if (nivelesData) setNiveles(nivelesData);
    if (alumnosData) setAlumnos(alumnosData);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anioLectivoActivo) return;

    const data = {
      ...formData,
      anio_lectivo_id: anioLectivoActivo.id,
      precio: parseFloat(formData.precio) || 0,
      stock_total: parseInt(formData.stock_total) || 0,
    };

    let result;
    if (editingLibro) {
      result = await put<Libro>(`libros/${editingLibro.id}`, data);
      if (result) toast.success('Libro actualizado correctamente');
    } else {
      result = await post<Libro>('libros', data);
      if (result) toast.success('Libro creado correctamente');
    }

    if (result) {
      setIsDialogOpen(false);
      resetForm();
      loadData();
    }
  };

  const handlePrestamo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLibro) return;

    const result = await post('prestamos', {
      alumno_id: prestamoForm.alumno_id,
      libro_id: selectedLibro.id,
      fecha_prestamo: prestamoForm.fecha_prestamo,
      fecha_devolucion_esperada: prestamoForm.fecha_devolucion_esperada || null,
      observaciones: prestamoForm.observaciones,
    });

    if (result) {
      toast.success('Préstamo registrado correctamente');
      setIsPrestamoDialogOpen(false);
      setPrestamoForm({
        alumno_id: '',
        fecha_prestamo: new Date().toISOString().split('T')[0],
        fecha_devolucion_esperada: '',
        observaciones: '',
      });
      setSelectedLibro(null);
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!libroToDelete) return;
    
    const result = await del(`libros/${libroToDelete.id}`);
    if (result) {
      toast.success('Libro eliminado correctamente');
      setIsDeleteDialogOpen(false);
      setLibroToDelete(null);
      loadData();
    }
  };

  const openEditDialog = (libro: Libro) => {
    setEditingLibro(libro);
    setFormData({
      codigo: libro.codigo,
      titulo: libro.titulo,
      autor: libro.autor || '',
      editorial: libro.editorial || '',
      materia: libro.materia || '',
      nivel_id: libro.nivel_id || '',
      precio: libro.precio.toString(),
      stock_total: libro.stock_total.toString(),
      descripcion: libro.descripcion || '',
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingLibro(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openPrestamoDialog = (libro: Libro) => {
    setSelectedLibro(libro);
    setIsPrestamoDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      titulo: '',
      autor: '',
      editorial: '',
      materia: '',
      nivel_id: '',
      precio: '',
      stock_total: '',
      descripcion: '',
    });
  };

  const handleBackup = async () => {
    const data = await get('backup');
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-libros-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Backup descargado');
    }
  };

  const filteredLibros = libros.filter(libro => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      libro.titulo.toLowerCase().includes(searchLower) ||
      libro.autor?.toLowerCase().includes(searchLower) ||
      libro.codigo.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Libros</h1>
          <p className="text-slate-500">Gestión de libros y préstamos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleBackup}>
            <Download className="h-4 w-4 mr-2" />
            Backup
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Libro
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por título, autor o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lista de Libros ({filteredLibros.length})
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
                    <th className="text-left py-3 px-4">Código</th>
                    <th className="text-left py-3 px-4">Título</th>
                    <th className="text-left py-3 px-4">Autor</th>
                    <th className="text-left py-3 px-4">Precio</th>
                    <th className="text-left py-3 px-4">Stock</th>
                    <th className="text-left py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLibros.map((libro) => (
                    <tr key={libro.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">{libro.codigo}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{libro.titulo}</p>
                        <p className="text-sm text-slate-500">{libro.materia}</p>
                      </td>
                      <td className="py-3 px-4">{libro.autor || '-'}</td>
                      <td className="py-3 px-4">{formatCurrency(libro.precio)}</td>
                      <td className="py-3 px-4">
                        <span className={libro.stock_disponible <= 0 ? 'text-red-600 font-medium' : ''}>
                          {libro.stock_disponible} / {libro.stock_total}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {libro.stock_disponible > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openPrestamoDialog(libro)}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" />
                              Prestar
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(libro)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setLibroToDelete(libro);
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
              {filteredLibros.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No se encontraron libros
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
              {editingLibro ? 'Editar Libro' : 'Nuevo Libro'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autor">Autor</Label>
                <Input
                  id="autor"
                  value={formData.autor}
                  onChange={(e) => setFormData({ ...formData, autor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editorial">Editorial</Label>
                <Input
                  id="editorial"
                  value={formData.editorial}
                  onChange={(e) => setFormData({ ...formData, editorial: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="materia">Materia</Label>
                <Input
                  id="materia"
                  value={formData.materia}
                  onChange={(e) => setFormData({ ...formData, materia: e.target.value })}
                />
              </div>
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
                <Label htmlFor="precio">Precio</Label>
                <Input
                  id="precio"
                  type="number"
                  step="0.01"
                  value={formData.precio}
                  onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Total</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock_total}
                  onChange={(e) => setFormData({ ...formData, stock_total: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingLibro ? 'Guardar Cambios' : 'Crear Libro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Préstamo Dialog */}
      <Dialog open={isPrestamoDialogOpen} onOpenChange={setIsPrestamoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Préstamo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePrestamo} className="space-y-4">
            <div>
              <Label>Libro</Label>
              <p className="font-medium">{selectedLibro?.titulo}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alumno_prestamo">Alumno *</Label>
              <Select 
                value={prestamoForm.alumno_id} 
                onValueChange={(v) => setPrestamoForm({ ...prestamoForm, alumno_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alumno" />
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
            <div className="space-y-2">
              <Label htmlFor="fecha_prestamo">Fecha de Préstamo *</Label>
              <Input
                id="fecha_prestamo"
                type="date"
                value={prestamoForm.fecha_prestamo}
                onChange={(e) => setPrestamoForm({ ...prestamoForm, fecha_prestamo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_devolucion">Fecha de Devolución Esperada</Label>
              <Input
                id="fecha_devolucion"
                type="date"
                value={prestamoForm.fecha_devolucion_esperada}
                onChange={(e) => setPrestamoForm({ ...prestamoForm, fecha_devolucion_esperada: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Input
                id="observaciones"
                value={prestamoForm.observaciones}
                onChange={(e) => setPrestamoForm({ ...prestamoForm, observaciones: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPrestamoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar Préstamo</Button>
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
              ¿Está seguro de eliminar el libro "{libroToDelete?.titulo}"?
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
