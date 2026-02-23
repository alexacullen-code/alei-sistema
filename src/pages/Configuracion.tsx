import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useStore } from '@/hooks/useStore';
import type { Configuracion as ConfigType, AnioLectivo } from '@/types';
import { 
  Download, 
  Upload, 
  AlertTriangle,
  Trash2,
  Save,
  Database,
  Calendar,
  DollarSign,
  Building,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

export default function Configuracion() {
  const { get, post, put } = useApi();
  const { 
    configuracion, 
    setConfiguracion, 
    setAnioLectivoActivo,
    aniosLectivos,
    setAniosLectivos
  } = useStore();
  
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetConfirmDialogOpen, setIsResetConfirmDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [backupSection, setBackupSection] = useState('all');
  const [restoreSection, setRestoreSection] = useState('all');
  const [restoring, setRestoring] = useState(false);

  const sectionOptions = [
    { value: 'all', label: 'Todo el sistema' },
    { value: 'alumnos', label: 'Alumnos' },
    { value: 'niveles', label: 'Niveles' },
    { value: 'libros', label: 'Libros' },
    { value: 'pagos', label: 'Pagos' },
    { value: 'gastos', label: 'Gastos' },
    { value: 'preinscripciones', label: 'Pre-inscripciones' },
  ];
  
  const [configForm, setConfigForm] = useState({
    descuento_pronto_pago: '150',
    recargo_mora: '150',
    dia_limite_descuento: '10',
    dia_inicio_recargo: '16',
    nombre_instituto: 'Instituto ALEI',
    telefono_instituto: '',
    email_instituto: '',
    direccion_instituto: '',
  });

  const [nuevoAnio, setNuevoAnio] = useState({
    anio: new Date().getFullYear() + 1,
    fecha_inicio: '',
    fecha_fin: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (configuracion) {
      setConfigForm({
        descuento_pronto_pago: configuracion.descuento_pronto_pago || '150',
        recargo_mora: configuracion.recargo_mora || '150',
        dia_limite_descuento: configuracion.dia_limite_descuento || '10',
        dia_inicio_recargo: configuracion.dia_inicio_recargo || '16',
        nombre_instituto: configuracion.nombre_instituto || 'Instituto ALEI',
        telefono_instituto: configuracion.telefono_instituto || '',
        email_instituto: configuracion.email_instituto || '',
        direccion_instituto: configuracion.direccion_instituto || '',
      });
    }
  }, [configuracion]);

  const loadData = async () => {
    const [configData, aniosData] = await Promise.all([
      get<ConfigType>('configuracion'),
      get<AnioLectivo[]>('anios-lectivos')
    ]);
    
    if (configData) setConfiguracion(configData);
    if (aniosData) {
      setAniosLectivos(aniosData);
      const activo = aniosData.find(a => a.activo);
      if (activo) setAnioLectivoActivo(activo);
    }
  };

  const handleSaveConfig = async () => {
    const result = await put('configuracion', configForm);
    if (result) {
      toast.success('Configuración guardada');
      loadData();
    }
  };

  const handleCrearAnio = async () => {
    const result = await post<AnioLectivo>('anios-lectivos', nuevoAnio);
    if (result) {
      toast.success('Año lectivo creado');
      loadData();
    }
  };

  const handleActivarAnio = async (id: string) => {
    const result = await put(`anios-lectivos/${id}/activar`, {});
    if (result) {
      toast.success('Año lectivo activado');
      loadData();
    }
  };

  const handleBackup = async () => {
    const data = await get(`backup${backupSection !== 'all' ? `?section=${backupSection}` : ''}`);
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${backupSection}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Backup descargado');
    }
  };

  const handleRestore = async () => {
    const raw = jsonInput.trim();
    if (!raw) {
      toast.error('Debe pegar o subir un JSON antes de restaurar');
      return;
    }

    try {
      setRestoring(true);
      const data = JSON.parse(raw);
      const result = await post<{ results?: Record<string, number> }>(`restore${restoreSection !== 'all' ? `?section=${restoreSection}` : ''}`, data);
      if (!result) {
        toast.error('No se pudo restaurar. Verifique la respuesta de /api/restore en Red (F12).');
        return;
      }

      const count = Object.values(result.results || {}).reduce((acc, n) => acc + Number(n || 0), 0);
      toast.success(`Datos restaurados correctamente (${count} registros procesados)`);
      setIsRestoreDialogOpen(false);
      setJsonInput('');
      loadData();
    } catch (_e) {
      toast.error('JSON inválido');
    } finally {
      setRestoring(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setJsonInput(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleReset = async () => {
    if (resetConfirmText !== 'RESET') {
      toast.error('Debe escribir RESET para confirmar');
      return;
    }
    
    const result = await post('reset', {});
    if (result) {
      toast.success('Sistema reseteado correctamente');
      setIsResetConfirmDialogOpen(false);
      setResetConfirmText('');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-500">Ajustes del sistema y administración</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="anios">Años Lectivos</TabsTrigger>
          <TabsTrigger value="backup">Backup/Restore</TabsTrigger>
          <TabsTrigger value="avanzado">Avanzado</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Datos del Instituto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del Instituto</Label>
                  <Input
                    value={configForm.nombre_instituto}
                    onChange={(e) => setConfigForm({ ...configForm, nombre_instituto: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={configForm.telefono_instituto}
                    onChange={(e) => setConfigForm({ ...configForm, telefono_instituto: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={configForm.email_instituto}
                    onChange={(e) => setConfigForm({ ...configForm, email_instituto: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input
                    value={configForm.direccion_instituto}
                    onChange={(e) => setConfigForm({ ...configForm, direccion_instituto: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Configuración de Pagos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Descuento Pronto Pago ($)</Label>
                  <Input
                    type="number"
                    value={configForm.descuento_pronto_pago}
                    onChange={(e) => setConfigForm({ ...configForm, descuento_pronto_pago: e.target.value })}
                  />
                  <p className="text-sm text-slate-500">Antes del día {configForm.dia_limite_descuento}</p>
                </div>
                <div className="space-y-2">
                  <Label>Recargo por Mora ($)</Label>
                  <Input
                    type="number"
                    value={configForm.recargo_mora}
                    onChange={(e) => setConfigForm({ ...configForm, recargo_mora: e.target.value })}
                  />
                  <p className="text-sm text-slate-500">Después del día {configForm.dia_inicio_recargo}</p>
                </div>
                <div className="space-y-2">
                  <Label>Día Límite Descuento</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={configForm.dia_limite_descuento}
                    onChange={(e) => setConfigForm({ ...configForm, dia_limite_descuento: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Día Inicio Recargo</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={configForm.dia_inicio_recargo}
                    onChange={(e) => setConfigForm({ ...configForm, dia_inicio_recargo: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSaveConfig}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Configuración
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Años Lectivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aniosLectivos.map((anio) => (
                  <div 
                    key={anio.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      anio.activo ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <div>
                      <p className="font-bold text-lg">{anio.anio}</p>
                      <p className="text-sm text-slate-500">
                        {anio.fecha_inicio} - {anio.fecha_fin}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {anio.activo ? (
                        <span className="text-blue-600 font-medium">Activo</span>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleActivarAnio(anio.id)}
                        >
                          Activar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t mt-6 pt-6">
                <h4 className="font-medium mb-4">Crear Nuevo Año Lectivo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Año</Label>
                    <Input
                      type="number"
                      value={nuevoAnio.anio}
                      onChange={(e) => setNuevoAnio({ ...nuevoAnio, anio: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Fecha Inicio</Label>
                    <Input
                      type="date"
                      value={nuevoAnio.fecha_inicio}
                      onChange={(e) => setNuevoAnio({ ...nuevoAnio, fecha_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fecha Fin</Label>
                    <Input
                      type="date"
                      value={nuevoAnio.fecha_fin}
                      onChange={(e) => setNuevoAnio({ ...nuevoAnio, fecha_fin: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleCrearAnio} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Año Lectivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Backup y Restore
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Descargar Backup</h4>
                <p className="text-sm text-slate-500 mb-3">
                  Descarga todos los datos del año lectivo actual en formato JSON.
                </p>
                <Button onClick={handleBackup} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Backup
                </Button>
                <div className="mt-3 max-w-xs">
                  <Label>Sección a respaldar</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                    value={backupSection}
                    onChange={(e) => setBackupSection(e.target.value)}
                  >
                    {sectionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-2">Restaurar Datos</h4>
                <p className="text-sm text-slate-500 mb-3">
                  Restaura datos desde un archivo JSON o pegando el contenido.
                </p>
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                  />
                  <Textarea
                    placeholder="O pega el JSON aquí..."
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    rows={5}
                  />
                  <div className="max-w-xs">
                    <Label>Sección a restaurar</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                      value={restoreSection}
                      onChange={(e) => setRestoreSection(e.target.value)}
                    >
                      {sectionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button 
                    onClick={() => setIsRestoreDialogOpen(true)}
                    disabled={!jsonInput}
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Restaurar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avanzado" className="space-y-4">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Zona de Peligro
              </CardTitle>
              <CardDescription>
                Estas acciones son irreversibles. Use con precaución.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2">Resetear Sistema</h4>
                  <p className="text-sm text-red-700 mb-3">
                    Elimina TODOS los datos del año lectivo actual: alumnos, pagos, libros, niveles, etc.
                    Use esto solo cuando comience un nuevo año lectivo.
                  </p>
                  <Button 
                    variant="destructive"
                    onClick={() => setIsResetDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Resetear Sistema
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Dialog 1 */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Advertencia
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará TODOS los datos del año lectivo actual.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Se eliminarán:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600">
              <li>Todos los alumnos</li>
              <li>Todos los pagos</li>
              <li>Todos los libros y préstamos</li>
              <li>Todos los niveles</li>
              <li>Todos los gastos</li>
              <li>Todas las pre-inscripciones</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                setIsResetDialogOpen(false);
                setIsResetConfirmDialogOpen(true);
              }}
            >
              Entiendo, continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog 2 - Confirmación final */}
      <Dialog open={isResetConfirmDialogOpen} onOpenChange={setIsResetConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirmación Final</DialogTitle>
            <DialogDescription>
              Para confirmar el reseteo, escriba "RESET" en el campo de abajo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Escriba RESET"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReset}
              disabled={resetConfirmText !== 'RESET'}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Resetear Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Restauración</DialogTitle>
            <DialogDescription>
              Esta acción importará datos desde el JSON proporcionado.
              Los datos existentes pueden ser sobrescritos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestoreDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRestore} disabled={restoring}>
              <Upload className="h-4 w-4 mr-2" />
              {restoring ? 'Restaurando...' : 'Confirmar Restauración'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
