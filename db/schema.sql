-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Años lectivos dinámicos
CREATE TABLE anos_lectivos (
    id SERIAL PRIMARY KEY,
    ano INTEGER UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Niveles
CREATE TABLE niveles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ano_lectivo_id INTEGER REFERENCES anos_lectivos(id),
    nombre TEXT NOT NULL,
    horario TEXT,
    cupo_maximo INTEGER DEFAULT 20,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alumnos con campos mejorados
CREATE TABLE alumnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ano_lectivo_id INTEGER REFERENCES anos_lectivos(id),
    numero_anual INTEGER,
    nombre TEXT NOT NULL,
    cedula TEXT UNIQUE,
    email TEXT,
    telefono TEXT,
    telefono_alt TEXT,
    tutor_nombre TEXT,
    tutor_telefono TEXT,
    fecha_nacimiento DATE,
    direccion TEXT,
    nivel_id UUID REFERENCES niveles(id),
    es_hermano BOOLEAN DEFAULT false,
    monto_especial INTEGER,
    cuota_base INTEGER DEFAULT 1500,
    fecha_inscripcion DATE DEFAULT CURRENT_DATE,
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lista de espera / Pre-inscripciones
CREATE TABLE lista_espera (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ano_lectivo_id INTEGER REFERENCES anos_lectivos(id),
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    nivel_interes_id UUID REFERENCES niveles(id),
    fecha_registro TIMESTAMP DEFAULT NOW(),
    estado TEXT DEFAULT 'pendiente',
    notas TEXT,
    fecha_contacto TIMESTAMP
);

-- Libros
CREATE TABLE libros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID REFERENCES alumnos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    costo_total INTEGER NOT NULL,
    pagado INTEGER DEFAULT 0,
    saldo INTEGER NOT NULL,
    observaciones TEXT,
    pagos JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pagos con auditoría
CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID REFERENCES alumnos(id) ON DELETE CASCADE,
    ano_lectivo_id INTEGER REFERENCES anos_lectivos(id),
    concepto TEXT NOT NULL,
    monto INTEGER NOT NULL,
    monto_original INTEGER,
    recargo INTEGER DEFAULT 0,
    descuento INTEGER DEFAULT 0,
    mes INTEGER,
    fecha DATE NOT NULL,
    comentarios TEXT,
    libro_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT
);

-- Gastos con soporte para cuotas
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ano_lectivo_id INTEGER REFERENCES anos_lectivos(id),
    concepto TEXT NOT NULL,
    proveedor TEXT,
    monto_total INTEGER NOT NULL,
    fecha DATE NOT NULL,
    categoria TEXT,
    es_cuota BOOLEAN DEFAULT false,
    numero_cuotas INTEGER DEFAULT 1,
    cuota_actual INTEGER DEFAULT 1,
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alertas/Notificaciones
CREATE TABLE alertas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo TEXT NOT NULL,
    alumno_id UUID REFERENCES alumnos(id),
    mensaje TEXT NOT NULL,
    fecha_alerta DATE,
    leida BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Auditoría de cambios
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabla TEXT NOT NULL,
    registro_id UUID,
    accion TEXT NOT NULL,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario TEXT,
    fecha TIMESTAMP DEFAULT NOW()
);

-- Índices para que sea rápido
CREATE INDEX idx_alumnos_ano ON alumnos(ano_lectivo_id);
CREATE INDEX idx_pagos_ano ON pagos(ano_lectivo_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha);
CREATE INDEX idx_pagos_alumno ON pagos(alumno_id);
