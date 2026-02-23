-- ============================================
-- SISTEMA ALEI - ESQUEMA COMPLETO POSTGRESQL
-- ============================================

-- Extension para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. AÑOS LECTIVOS
-- ============================================
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_name VARCHAR(9) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    matricula_price DECIMAL(10,2) DEFAULT 0,
    mensualidad_price DECIMAL(10,2) DEFAULT 0,
    descuento_pronto_pago DECIMAL(10,2) DEFAULT 150,
    recargo_atraso DECIMAL(10,2) DEFAULT 150,
    dia_limite_descuento INTEGER DEFAULT 10,
    dia_limite_normal INTEGER DEFAULT 15,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. TIPOS DE MATRÍCULA
-- ============================================
CREATE TABLE enrollment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2) DEFAULT 0,
    discount_pct DECIMAL(5,2) DEFAULT 0,
    is_hermano_type BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. NIVELES/CURSOS
-- ============================================
CREATE TABLE levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    schedule VARCHAR(100),
    capacity INTEGER DEFAULT 20,
    teacher_name VARCHAR(100),
    classroom VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. ESTUDIANTES
-- ============================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    numero_anual INTEGER,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    email VARCHAR(100),
    phone_primary VARCHAR(20),
    phone_secondary VARCHAR(20),
    address TEXT,
    
    -- Contacto padre/madre/tutor
    parent_name VARCHAR(100),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(100),
    parent_relationship VARCHAR(20), -- 'padre', 'madre', 'tutor'
    
    -- Información académica
    level_id UUID REFERENCES levels(id),
    enrollment_type_id UUID REFERENCES enrollment_types(id),
    is_hermano BOOLEAN DEFAULT false,
    custom_tuition_price DECIMAL(10,2),
    
    -- Fechas y estado
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, graduated, suspended
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. LIBROS
-- ============================================
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(100),
    publisher VARCHAR(100),
    isbn VARCHAR(20),
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    level_id UUID REFERENCES levels(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. ASIGNACIÓN DE LIBROS A ESTUDIANTES
-- ============================================
CREATE TABLE book_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    total_price DECIMAL(10,2) NOT NULL,
    pending_balance DECIMAL(10,2) NOT NULL,
    assignment_date DATE DEFAULT CURRENT_DATE,
    delivery_date DATE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, delivered, paid, cancelled
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. PAGOS DE LIBROS (Pagos parciales)
-- ============================================
CREATE TABLE book_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES book_assignments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_method VARCHAR(20), -- cash, transfer, card, mercadopago
    comment TEXT,
    previous_balance DECIMAL(10,2),
    new_balance DECIMAL(10,2),
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. MATRÍCULAS Y MENSUALIDADES
-- ============================================
CREATE TABLE tuition_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    concept VARCHAR(20) NOT NULL, -- 'matricula', 'mensualidad', 'cuota', 'extra'
    month_year VARCHAR(7), -- '2025-03' para mensualidades
    
    -- Montos
    base_amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    surcharge_amount DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) NOT NULL,
    
    -- Pagos
    amount_paid DECIMAL(10,2) DEFAULT 0,
    pending_amount DECIMAL(10,2) NOT NULL,
    
    -- Fechas
    payment_date DATE,
    due_date DATE,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'pending', -- paid, pending, partial, late, cancelled
    
    -- Metadatos
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 9. PAGOS PARCIALES DE MENSUALIDADES
-- ============================================
CREATE TABLE tuition_partial_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tuition_id UUID REFERENCES tuition_payments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_method VARCHAR(20),
    comment TEXT,
    previous_balance DECIMAL(10,2),
    new_balance DECIMAL(10,2),
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 10. GASTOS
-- ============================================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'servicios', 'materiales', 'sueldos', 'alquiler', 'impuestos', 'otros'
    provider VARCHAR(100),
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Sistema de cuotas
    has_installments BOOLEAN DEFAULT false,
    installment_count INTEGER DEFAULT 1,
    
    -- Fechas
    expense_date DATE DEFAULT CURRENT_DATE,
    start_date DATE,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid
    
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- ============================================
-- 11. CUOTAS DE GASTOS
-- ============================================
CREATE TABLE expense_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE,
    is_paid BOOLEAN DEFAULT false,
    paid_date DATE,
    payment_method VARCHAR(20),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 12. LISTA DE ESPERA / PRE-INSCRIPCIONES
-- ============================================
CREATE TABLE waiting_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    level_id UUID REFERENCES levels(id),
    
    -- Datos del estudiante
    student_name VARCHAR(100) NOT NULL,
    student_age INTEGER,
    
    -- Contacto
    parent_name VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    
    -- Información adicional
    registration_date DATE DEFAULT CURRENT_DATE,
    preferred_schedule VARCHAR(100),
    previous_academy VARCHAR(100),
    
    -- Estado y prioridad
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, contacted, converted, cancelled, no_answer
    priority INTEGER DEFAULT 0,
    
    -- Conversión
    converted_student_id UUID REFERENCES students(id),
    converted_date DATE,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 13. EXÁMENES
-- ============================================
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    level_id UUID REFERENCES levels(id),
    name VARCHAR(100) NOT NULL,
    exam_date DATE,
    exam_type VARCHAR(50), -- 'parcial', 'final', 'recuperatorio', 'internacional'
    max_score DECIMAL(5,2) DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 14. NOTAS DE EXÁMENES
-- ============================================
CREATE TABLE exam_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    score DECIMAL(5,2),
    status VARCHAR(20), -- 'approved', 'failed', 'absent', 'pending'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(exam_id, student_id)
);

-- ============================================
-- 15. ASISTENCIA
-- ============================================
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'present', 'absent', 'late', 'justified'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(level_id, student_id, date)
);

-- ============================================
-- 16. AUDITORÍA
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- insert, update, delete
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45)
);

-- ============================================
-- 17. ALERTAS DEL SISTEMA
-- ============================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30) NOT NULL, -- 'birthday', 'late_payment', 'book_pending', 'low_stock', 'custom'
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    
    title VARCHAR(200),
    message TEXT,
    
    -- Estado
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    
    -- Fechas
    created_at TIMESTAMP DEFAULT NOW(),
    due_action_date DATE,
    dismissed_at TIMESTAMP,
    
    -- Metadatos
    priority INTEGER DEFAULT 0, -- 0=low, 1=normal, 2=high, 3=urgent
    category VARCHAR(30),
    related_table VARCHAR(50),
    related_id UUID
);

-- ============================================
-- 18. CONFIGURACIÓN DEL SISTEMA
-- ============================================
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 19. USUARIOS DEL SISTEMA
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user', 'teacher'
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA MEJORAR PERFORMANCE
-- ============================================
CREATE INDEX idx_students_year ON students(year_id);
CREATE INDEX idx_students_cedula ON students(cedula);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_hermano ON students(is_hermano);
CREATE INDEX idx_tuition_student ON tuition_payments(student_id);
CREATE INDEX idx_tuition_month ON tuition_payments(month_year);
CREATE INDEX idx_tuition_status ON tuition_payments(status);
CREATE INDEX idx_book_assign_student ON book_assignments(student_id);
CREATE INDEX idx_book_assign_status ON book_assignments(status);
CREATE INDEX idx_expenses_year ON expenses(year_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_waiting_list_status ON waiting_list(status);
CREATE INDEX idx_alerts_read ON alerts(is_read);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_audit_table ON audit_logs(table_name);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_exam_grades_student ON exam_grades(student_id);

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Año lectivo por defecto
INSERT INTO academic_years (year_name, is_active, start_date, end_date, matricula_price, mensualidad_price, descuento_pronto_pago, recargo_atraso)
VALUES ('2025', true, '2025-03-01', '2025-12-15', 2500, 3200, 150, 150);

-- Tipos de matrícula
INSERT INTO enrollment_types (name, base_price, discount_pct, is_hermano_type, description)
VALUES 
    ('Regular', 0, 0, false, 'Matrícula regular sin descuento'),
    ('Beca 50%', 0, 50, false, 'Beca del 50% en mensualidad'),
    ('Beca 25%', 0, 25, false, 'Beca del 25% en mensualidad'),
    ('Hermano', 0, 0, true, 'Descuento especial por hermano');

-- Configuración inicial
INSERT INTO system_config (key, value, description) VALUES
    ('institute_name', 'ALEI - Academia de Inglés', 'Nombre del instituto'),
    ('institute_phone', '', 'Teléfono de contacto'),
    ('institute_address', '', 'Dirección'),
    ('currency', 'UYU', 'Moneda por defecto'),
    ('timezone', 'America/Montevideo', 'Zona horaria');

-- Usuario admin por defecto (contraseña: admin123 - cambiar en producción)
-- La contraseña está hasheada con bcrypt
INSERT INTO users (username, password_hash, email, full_name, role)
VALUES ('admin', '$2a$10$YourHashedPasswordHere', 'admin@alei.edu', 'Administrador', 'admin');

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waiting_list_updated_at BEFORE UPDATE ON waiting_list
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tuition_payments_updated_at BEFORE UPDATE ON tuition_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
