-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Años lectivos
CREATE TABLE IF NOT EXISTS años_lectivos (
    id SERIAL PRIMARY KEY,
    año INTEGER UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT false,
    fecha_inicio DATE,
    fecha_fin DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tipos de matrícula
CREATE TABLE IF NOT EXISTS tipos_matricula (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    porcentaje INTEGER DEFAULT 100,
    monto_fijo INTEGER,
    es_hermano BOOLEAN DEFAULT false,
    descripcion TEXT,
    año_id INTEGER REFERENCES años_lectivos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Niveles
CREATE TABLE IF NOT EXISTS niveles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio_mensual INTEGER NOT NULL,
    costo_libro INTEGER DEFAULT 0,
    año_id INTEGER REFERENCES años_lectivos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alumnos
CREATE TABLE IF NOT EXISTS alumnos (
    id SERIAL PRIMARY KEY,
    numero_anual INTEGER,
    nombre VARCHAR(200) NOT NULL,
    cedula VARCHAR(50) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    telefono_alt VARCHAR(50),
    email VARCHAR(100),
    direccion TEXT,
    edad INTEGER,
    nombre_padre VARCHAR(200),
    nombre_madre VARCHAR(200),
    nivel_id INTEGER REFERENCES niveles(id),
    tipo_matricula_id INTEGER REFERENCES tipos_matricula(id),
    fecha_inscripcion DATE,
    año_id INTEGER REFERENCES años_lectivos(id) ON DELETE CASCADE,
    es_hermano BOOLEAN DEFAULT false,
    precio_especial INTEGER,
    activo BOOLEAN DEFAULT true,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Libros/Materiales asignados
CREATE TABLE IF NOT EXISTS libros (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    costo_total INTEGER NOT NULL,
    abonado INTEGER DEFAULT 0,
    saldo INTEGER NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pagos individuales de libros (historial de abonos)
CREATE TABLE IF NOT EXISTS libro_pagos (
    id SERIAL PRIMARY KEY,
    libro_id INTEGER REFERENCES libros(id) ON DELETE CASCADE,
    monto INTEGER NOT NULL,
    fecha DATE NOT NULL,
    comentarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pagos generales (matrícula, mensualidad, etc)
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
    concepto VARCHAR(50) NOT NULL, -- matricula, mensualidad, libro, otro
    mes INTEGER, -- 1-12 para mensualidades
    año INTEGER,
    monto INTEGER NOT NULL,
    recargo INTEGER DEFAULT 0,
    descuento INTEGER DEFAULT 0,
    monto_final INTEGER NOT NULL,
    fecha_pago DATE NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    comentarios TEXT,
    usuario VARCHAR(100),
    cuota_n INTEGER, -- para sistema de cuotas
    total_cuotas INTEGER,
    año_id INTEGER REFERENCES años_lectivos(id) ON DELETE CASCADE
);

-- Gastos del instituto
CREATE TABLE IF NOT EXISTS gastos (
    id SERIAL PRIMARY KEY,
    concepto VARCHAR(200) NOT NULL,
    monto_total INTEGER NOT NULL,
    categoria VARCHAR(100),
    fecha DATE NOT NULL,
    es_cuota BOOLEAN DEFAULT false,
    cuota_n INTEGER,
    total_cuotas INTEGER,
    año_id INTEGER REFERENCES años_lectivos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-inscripciones y lista de espera
CREATE TABLE IF NOT EXISTS preinscripciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(100),
    nivel_interes VARCHAR(100),
    fecha_preinscripcion DATE DEFAULT CURRENT_DATE,
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, convertido, rechazado
    año_id INTEGER REFERENCES años_lectivos(id) ON DELETE CASCADE,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auditoría
CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(50) NOT NULL,
    registro_id INTEGER,
    accion VARCHAR(50) NOT NULL, -- insert, update, delete
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar año 2026 por defecto
INSERT INTO años_lectivos (año, activo) VALUES (2026, true) ON CONFLICT DO NOTHING;

-- Insertar tipos de matrícula por defecto
INSERT INTO tipos_matricula (nombre, porcentaje, descripcion, año_id) 
SELECT 'Regular', 100, 'Pago completo', id FROM años_lectivos WHERE activo = true
ON CONFLICT DO NOTHING;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_alumnos_cedula ON alumnos(cedula);
CREATE INDEX IF NOT EXISTS idx_alumnos_año ON alumnos(año_id);
CREATE INDEX IF NOT EXISTS idx_pagos_alumno ON pagos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_libros_alumno ON libros(alumno_id);
