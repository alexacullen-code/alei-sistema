-- Tabla de niveles (compatible con tu JSON)
CREATE TABLE IF NOT EXISTS niveles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    precio INTEGER DEFAULT 0,
    costo_libro INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de tipos de matrícula (Regular, x2, x3, Hermanos, etc.)
CREATE TABLE IF NOT EXISTS tipos_matricula (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    costo INTEGER DEFAULT 1500,
    descripcion TEXT,
    es_excepcion BOOLEAN DEFAULT false -- Para hermanos que no tienen descuentos/recargos
);

-- Tabla de alumnos (compatible con tu JSON exacto)
CREATE TABLE IF NOT EXISTS alumnos (
    id SERIAL PRIMARY KEY,
    numero_anual INTEGER,
    nombre VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    edad INTEGER,
    direccion TEXT,
    nivel VARCHAR(50),
    fecha_inscripcion DATE,
    tipo_matricula_id INTEGER REFERENCES tipos_matricula(id) DEFAULT 1,
    email VARCHAR(100),
    nombre_padre VARCHAR(100),
    telefono_padre VARCHAR(20),
    nombre_madre VARCHAR(100),
    telefono_madre VARCHAR(20),
    es_hermano BOOLEAN DEFAULT false,
    precio_especial INTEGER, -- Precio fijo mensual para hermanos
    anio_lectivo INTEGER DEFAULT 2026,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de libros (compatible con tu JSON de libros)
CREATE TABLE IF NOT EXISTS libros (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
    titulo VARCHAR(100) NOT NULL,
    costo_total DECIMAL(10,2) DEFAULT 0,
    pagado DECIMAL(10,2) DEFAULT 0,
    saldo DECIMAL(10,2) DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, parcial, pagado
    pagos JSONB DEFAULT '[]', -- Array de pagos parciales [{fecha, monto, comentarios}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de pagos (con soporte para parciales y comentarios)
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
    libro_id INTEGER REFERENCES libros(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL, -- matricula, mensualidad, libro, examen
    concepto VARCHAR(100),
    monto_original INTEGER, -- Monto antes de descuentos
    monto_final INTEGER NOT NULL, -- Monto final aplicado
    descuento INTEGER DEFAULT 0,
    recargo INTEGER DEFAULT 0,
    fecha DATE NOT NULL,
    comentarios TEXT,
    mes_referencia INTEGER, -- 1-12 para mensualidades
    anio_referencia INTEGER,
    es_abono BOOLEAN DEFAULT false, -- true si es pago parcial
    usuario VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de gastos (con soporte para cuotas)
CREATE TABLE IF NOT EXISTS gastos (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    concepto VARCHAR(100) NOT NULL,
    categoria VARCHAR(50), -- servicios, materiales, personal, cuotas, otros
    monto_total DECIMAL(10,2) NOT NULL,
    monto_pagado DECIMAL(10,2) DEFAULT 0,
    es_cuota BOOLEAN DEFAULT false,
    numero_cuota INTEGER,
    total_cuotas INTEGER,
    proveedor VARCHAR(100),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de preinscripciones/lista de espera
CREATE TABLE IF NOT EXISTS preinscripciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    nivel_interesado VARCHAR(50),
    fecha_preinscripcion DATE DEFAULT CURRENT_DATE,
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, contactado, convertido, descartado
    observaciones TEXT,
    fecha_conversion DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos iniciales
INSERT INTO tipos_matricula (id, nombre, costo, descripcion) VALUES 
(1, 'Regular', 1500, 'Matrícula estándar'),
(2, 'Matricula x 2', 1250, 'Dos hermanos'),
(3, 'Matricula x 3', 1300, 'Tres hermanos')
ON CONFLICT (id) DO NOTHING;

-- Insertar niveles del JSON del usuario
INSERT INTO niveles (id, nombre, precio) VALUES 
(1, '1st CH', 1500),
(2, '2nd CH', 1600),
(3, '3rd CH', 1700),
(4, '4th CH', 1800),
(5, '1st J', 1600),
(6, '2nd J', 1700),
(7, '3rd J', 1900),
(8, '4th J', 2000),
(9, '5th J', 2100),
(10, 'PET', 2200),
(11, 'FCE', 2300),
(12, 'CAE', 2400)
ON CONFLICT (id) DO NOTHING;

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_alumnos_cedula ON alumnos(cedula);
CREATE INDEX IF NOT EXISTS idx_alumnos_nombre ON alumnos(nombre);
CREATE INDEX IF NOT EXISTS idx_alumnos_anio ON alumnos(anio_lectivo);
CREATE INDEX IF NOT EXISTS idx_pagos_alumno ON pagos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_libros_alumno ON libros(alumno_id);
