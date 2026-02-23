import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import Alumnos from '@/pages/Alumnos';
import AlumnoDetalle from '@/pages/AlumnoDetalle';
import Niveles from '@/pages/Niveles';
import Libros from '@/pages/Libros';
import Pagos from '@/pages/Pagos';
import Gastos from '@/pages/Gastos';
import Preinscripciones from '@/pages/Preinscripciones';
import CajaRapida from '@/pages/CajaRapida';
import Configuracion from '@/pages/Configuracion';
import { useEffect } from 'react';
import { useStore } from '@/hooks/useStore';
import { useApi } from '@/hooks/useApi';
import type { AnioLectivo, Configuracion as ConfigType } from '@/types';

function AppInitializer() {
  const { setAnioLectivoActivo, setAniosLectivos, setConfiguracion } = useStore();
  const { get } = useApi();

  useEffect(() => {
    const init = async () => {
      const [aniosData, configData] = await Promise.all([
        get<AnioLectivo[]>('anios-lectivos'),
        get<ConfigType>('configuracion')
      ]);
      
      if (aniosData) {
        setAniosLectivos(aniosData);
        const activo = aniosData.find(a => a.activo);
        if (activo) setAnioLectivoActivo(activo);
      }
      
      if (configData) {
        setConfiguracion(configData);
      }
    };
    
    init();
  }, []);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AppInitializer />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="alumnos" element={<Alumnos />} />
          <Route path="alumnos/:id" element={<AlumnoDetalle />} />
          <Route path="niveles" element={<Niveles />} />
          <Route path="libros" element={<Libros />} />
          <Route path="pagos" element={<Pagos />} />
          <Route path="gastos" element={<Gastos />} />
          <Route path="preinscripciones" element={<Preinscripciones />} />
          <Route path="caja-rapida" element={<CajaRapida />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
