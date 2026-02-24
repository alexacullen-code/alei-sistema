CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS anios_lectivos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT false,
  fecha_inicio DATE,
  fecha_fin DATE
);

CREATE TABLE IF NOT EXISTS niveles (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id),
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS tipos_matricula (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  costo_base NUMERIC(10,2) NOT NULL,
  es_hermano BOOLEAN NOT NULL DEFAULT false,
  descuento_fijo BOOLEAN NOT NULL DEFAULT false,
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id)
);

CREATE TABLE IF NOT EXISTS alumnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_anual INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  cedula TEXT NOT NULL,
  telefono TEXT,
  telefono_alt TEXT,
  email TEXT,
  edad INTEGER,
  direccion TEXT,
  nombre_tutor TEXT,
  telefono_tutor TEXT,
  nivel_id INTEGER REFERENCES niveles(id),
  tipo_matricula_id INTEGER REFERENCES tipos_matricula(id),
  fecha_inscripcion DATE NOT NULL,
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id),
  es_hermano BOOLEAN NOT NULL DEFAULT false,
  monto_cuota_personalizado NUMERIC(10,2),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (anio_lectivo_id, numero_anual),
  UNIQUE (anio_lectivo_id, cedula)
);

CREATE TABLE IF NOT EXISTS libros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID REFERENCES alumnos(id),
  titulo TEXT NOT NULL,
  costo_total NUMERIC(10,2) NOT NULL,
  pagado NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo NUMERIC(10,2) NOT NULL,
  observaciones TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  pagos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id)
);

CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID REFERENCES alumnos(id),
  concepto TEXT NOT NULL,
  monto NUMERIC(10,2) NOT NULL,
  fecha DATE NOT NULL,
  mes_referencia INTEGER,
  anio_referencia INTEGER,
  comentarios TEXT,
  es_recargo BOOLEAN NOT NULL DEFAULT false,
  es_descuento BOOLEAN NOT NULL DEFAULT false,
  monto_original NUMERIC(10,2),
  libro_id UUID REFERENCES libros(id),
  registrado_por TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  modified_at TIMESTAMP,
  modified_by TEXT,
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id)
);

CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto TEXT NOT NULL,
  monto_total NUMERIC(10,2) NOT NULL,
  monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo NUMERIC(10,2) NOT NULL,
  fecha DATE NOT NULL,
  es_cuota BOOLEAN NOT NULL DEFAULT false,
  cuotas_total INTEGER,
  cuotas_pagadas INTEGER,
  observaciones TEXT,
  categoria TEXT,
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id)
);

CREATE TABLE IF NOT EXISTS preinscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_interesado TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  nivel_interesado TEXT,
  fecha_contacto DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  fecha_conversion DATE,
  alumno_id_convertido UUID REFERENCES alumnos(id),
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id)
);

CREATE TABLE IF NOT EXISTS alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  alumno_id UUID REFERENCES alumnos(id),
  mensaje TEXT,
  fecha_alerta DATE,
  leida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  anio_lectivo_id INTEGER NOT NULL REFERENCES anios_lectivos(id)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_afectada TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  accion TEXT NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario TEXT,
  fecha_hora TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO anios_lectivos (id, nombre, activo, fecha_inicio, fecha_fin)
VALUES (1, '2026', true, '2026-02-01', '2026-12-20')
ON CONFLICT (id) DO UPDATE SET activo = EXCLUDED.activo;

INSERT INTO niveles (id, nombre, anio_lectivo_id) VALUES
(1, 'FCE', 1),
(2, 'PET', 1),
(3, '2nd CH', 1)
ON CONFLICT DO NOTHING;

INSERT INTO tipos_matricula (id, nombre, costo_base, es_hermano, descuento_fijo, anio_lectivo_id) VALUES
(1, 'Regular', 1500, false, false, 1),
(2, 'Matricula x2', 1250, true, true, 1),
(3, 'Matricula x3', 1300, true, true, 1)
ON CONFLICT DO NOTHING;
