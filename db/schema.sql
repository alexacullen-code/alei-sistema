-- ============================================
-- ALEI - Sistema de Gestión Educativa
-- Esquema de Base de datos PostgreSQL
-- ============================================

-- Habilitar UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: AÑOS LECTIVOS
-- ============================================
CREATE TABLE IF NOT EXISTS anios_lectivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio INTEGER NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT false,
    fecha_inicio DATE,
    fecha_fin DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: NIVELES/CURSOS
-- ============================================
CREATE TABLE IF NOT EXISTS niveles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio_lectivo_id UUID NOT NULL REFERENCES anios_lectivos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    capacidad_maxima INTEGER DEFAULT 30,
    cuota_mensual DECIMAL(10,2) DEFAULT 0,
    horario VARCHAR(100),
    profesor VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: ALUMNOS
-- ============================================
CREATE TABLE IF NOT EXISTS alumnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio_lectivo_id UUID NOT NULL REFERENCES anios_lectivos(id) ON DELETE CASCADE,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE,
    email VARCHAR(100),
    telefono VARCHAR(50),
    telefono_alternativo VARCHAR(50),
    direccion TEXT,
    
    -- Contacto padre/madre/tutor
    nombre_tutor VARCHAR(100),
    telefono_tutor VARCHAR(50),
    email_tutor VARCHAR(100),
    relacion_tutor VARCHAR(50), -- padre, madre, tutor, otro
    
    -- Información académica
    nivel_id UUID REFERENCES niveles(id),
    fecha_matricula DATE DEFAULT CURRENT_DATE,
    
    -- Descuento por hermanos
    es_hermano BOOLEAN DEFAULT false,
    grupo_hermanos UUID, -- ID para agrupar hermanos
    cuota_especial DECIMAL(10,2), -- Cuota personalizada para hermanos
    
    -- Estado
    estado VARCHAR(20) DEFAULT 'activo', -- activo, inactivo, egresado, suspendido
    
    -- Campos de control
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- ============================================
-- TABLA: LIBROS
-- ============================================
CREATE TABLE IF NOT EXISTS libros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio_lectivo_id UUID NOT NULL REFERENCES anios_lectivos(id) ON DELETE CASCADE,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    autor VARCHAR(100),
    editorial VARCHAR(100),
    materia VARCHAR(100),
    nivel_id UUID REFERENCES niveles(id),
    precio DECIMAL(10,2) DEFAULT 0,
    stock_total INTEGER DEFAULT 0,
    stock_disponible INTEGER DEFAULT 0,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: PRÉSTAMO DE LIBROS
-- ============================================
CREATE TABLE IF NOT EXISTS prestamos_libros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    libro_id UUID NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    fecha_prestamo DATE DEFAULT CURRENT_DATE,
    fecha_devolucion_esperada DATE,
    fecha_devolucion_real DATE,
    estado VARCHAR(20) DEFAULT 'prestado', -- prestado, devuelto, perdido, danado
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: PAGOS
-- ============================================
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    
    -- Tipo de pago
    tipo VARCHAR(50) NOT NULL, -- matricula, mensualidad, libro, examen, otro
    concepto VARCHAR(200) NOT NULL,
    
    -- Período (para mensualidades)
    mes INTEGER, -- 1-12
    anio INTEGER,
    
    -- Montos
    monto_total DECIMAL(10,2) NOT NULL,
    monto_pagado DECIMAL(10,2) DEFAULT 0,
    saldo_pendiente DECIMAL(10,2) DEFAULT 0,
    
    -- Descuentos y recargos
    descuento DECIMAL(10,2) DEFAULT 0,
    tipo_descuento VARCHAR(50), -- pronto_pago, hermano, beca, otro
    recargo DECIMAL(10,2) DEFAULT 0,
    tipo_recargo VARCHAR(50), -- mora, administrativo, otro
    
    -- Estado
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, parcial, pagado, anulado
    
    -- Fechas
    fecha_vencimiento DATE,
    fecha_pago DATE,
    
    -- Comentarios
    comentarios TEXT,
    
    -- Auditoría
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- ============================================
-- TABLA: DETALLE DE PAGOS (PARCIALES)
-- ============================================
CREATE TABLE IF NOT EXISTS pagos_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pago_id UUID NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL, -- efectivo, transferencia, debito, credito, otro
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comentarios TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: GASTOS
-- ============================================
CREATE TABLE IF NOT EXISTS gastos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio_lectivo_id UUID NOT NULL REFERENCES anios_lectivos(id) ON DELETE CASCADE,
    
    -- Información del gasto
    concepto VARCHAR(200) NOT NULL,
    categoria VARCHAR(100) NOT NULL, -- servicios, materiales, sueldos, alquiler, mantenimiento, otro
    proveedor VARCHAR(100),
    
    -- Montos
    monto_total DECIMAL(10,2) NOT NULL,
    monto_pagado DECIMAL(10,2) DEFAULT 0,
    
    -- Compras en cuotas
    es_cuota BOOLEAN DEFAULT false,
    numero_cuotas INTEGER DEFAULT 1,
    cuota_actual INTEGER DEFAULT 1,
    
    -- Estado
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, parcial, pagado, anulado
    
    -- Fechas
    fecha_gasto DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    
    -- Comprobante
    numero_comprobante VARCHAR(100),
    tipo_comprobante VARCHAR(50), -- factura, recibo, ticket, otro
    
    comentarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- ============================================
-- TABLA: DETALLE DE GASTOS (CUOTAS)
-- ============================================
CREATE TABLE IF NOT EXISTS gastos_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gasto_id UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    numero_cuota INTEGER,
    comentarios TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: EXÁMENES
-- ============================================
CREATE TABLE IF NOT EXISTS examenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio_lectivo_id UUID NOT NULL REFERENCES anios_lectivos(id) ON DELETE CASCADE,
    nivel_id UUID REFERENCES niveles(id),
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(50), -- parcial, final, recuperatorio, practico, teorico
    materia VARCHAR(100),
    fecha_examen DATE,
    fecha_recuperatorio DATE,
    costo DECIMAL(10,2) DEFAULT 0,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: NOTAS DE EXÁMENES
-- ============================================
CREATE TABLE IF NOT EXISTS examenes_notas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    examen_id UUID NOT NULL REFERENCES examenes(id) ON DELETE CASCADE,
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    nota DECIMAL(4,2),
    asistencia BOOLEAN DEFAULT true,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: PRE-INSCRIPCIONES / LISTA DE ESPERA
-- ============================================
CREATE TABLE IF NOT EXISTS preinscripciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio_lectivo_id UUID NOT NULL REFERENCES anios_lectivos(id) ON DELETE CASCADE,
    
    -- Datos del interesado
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cedula VARCHAR(20),
    fecha_nacimiento DATE,
    email VARCHAR(100),
    telefono VARCHAR(50),
    telefono_alternativo VARCHAR(50),
    
    -- Contacto tutor
    nombre_tutor VARCHAR(100),
    telefono_tutor VARCHAR(50),
    
    -- Interés
    nivel_interesado_id UUID REFERENCES niveles(id),
    horario_preferido VARCHAR(100),
    
    -- Estado
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, contactado, convertido, rechazado, lista_espera
    
    -- Conversión
    fecha_conversion DATE,
    alumno_id UUID REFERENCES alumnos(id),
    
    -- Origen
    fuente VARCHAR(50), -- web, referido, visita, telefono, otro
    comentarios TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: ALERTAS / NOTIFICACIONES
-- ============================================
CREATE TABLE IF NOT EXISTS alertas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio_lectivo_id UUID NOT NULL REFERENCES anios_lectivos(id) ON DELETE CASCADE,
    
    tipo VARCHAR(50) NOT NULL, -- cumpleanos, pago_atrasado, libro_no_retirado, curso_lleno, general
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT,
    
    -- Referencia
    referencia_tipo VARCHAR(50), -- alumno, pago, libro, nivel
    referencia_id UUID,
    
    -- Estado
    leida BOOLEAN DEFAULT false,
    fecha_alerta DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: CONFIGURACIÓN DEL SISTEMA
-- ============================================
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: AUDITORÍA
-- ============================================
CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabla VARCHAR(50) NOT NULL,
    registro_id UUID NOT NULL,
    accion VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: USUARIOS (para futura autenticación)
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    rol VARCHAR(20) DEFAULT 'usuario', -- admin, usuario, solo_lectura
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_alumnos_cedula ON alumnos(cedula);
CREATE INDEX IF NOT EXISTS idx_alumnos_nivel ON alumnos(nivel_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_anio ON alumnos(anio_lectivo_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_estado ON alumnos(estado);
CREATE INDEX IF NOT EXISTS idx_alumnos_grupo_hermanos ON alumnos(grupo_hermanos);

CREATE INDEX IF NOT EXISTS idx_pagos_alumno ON pagos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_tipo ON pagos(tipo);
CREATE INDEX IF NOT EXISTS idx_pagos_mes_anio ON pagos(mes, anio);

CREATE INDEX IF NOT EXISTS idx_prestamos_alumno ON prestamos_libros(alumno_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_libro ON prestamos_libros(libro_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos_libros(estado);

CREATE INDEX IF NOT EXISTS idx_gastos_anio ON gastos(anio_lectivo_id);
CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos(estado);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria);

CREATE INDEX IF NOT EXISTS idx_niveles_anio ON niveles(anio_lectivo_id);

CREATE INDEX IF NOT EXISTS idx_libros_anio ON libros(anio_lectivo_id);
CREATE INDEX IF NOT EXISTS idx_libros_nivel ON libros(nivel_id);

CREATE INDEX IF NOT EXISTS idx_preinscripciones_estado ON preinscripciones(estado);
CREATE INDEX IF NOT EXISTS idx_preinscripciones_anio ON preinscripciones(anio_lectivo_id);

CREATE INDEX IF NOT EXISTS idx_alertas_leida ON alertas(leida);
CREATE INDEX IF NOT EXISTS idx_alertas_anio ON alertas(anio_lectivo_id);

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Insertar año lectivo 2025 por defecto
INSERT INTO anios_lectivos (anio, activo, fecha_inicio, fecha_fin)
VALUES (2025, true, '2025-03-01', '2025-12-15')
ON CONFLICT (anio) DO NOTHING;

-- Configuración por defecto
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('descuento_pronto_pago', '150', 'Descuento en pesos uruguayos por pago antes del 10'),
('recargo_mora', '150', 'Recargo en pesos uruguayos por pago después del 15'),
('dia_limite_descuento', '10', 'Día límite para descuento por pronto pago'),
('dia_inicio_recargo', '16', 'Día de inicio de recargo por mora'),
('moneda', 'UYU', 'Moneda del sistema'),
('nombre_instituto', 'Instituto ALEI', 'Nombre del instituto'),
('telefono_instituto', '', 'Teléfono de contacto'),
('email_instituto', '', 'Email de contacto'),
('direccion_instituto', '', 'Dirección del instituto')
ON CONFLICT (clave) DO NOTHING;

-- Usuario admin por defecto (contraseña: admin123 - cambiar en producción)
INSERT INTO usuarios (username, nombre, email, rol)
VALUES ('admin', 'Administrador', 'admin@alei.edu', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_alumnos_updated_at BEFORE UPDATE ON alumnos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_niveles_updated_at BEFORE UPDATE ON niveles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_libros_updated_at BEFORE UPDATE ON libros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gastos_updated_at BEFORE UPDATE ON gastos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_examenes_updated_at BEFORE UPDATE ON examenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preinscripciones_updated_at BEFORE UPDATE ON preinscripciones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
