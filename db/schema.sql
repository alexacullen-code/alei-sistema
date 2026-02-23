-- ============================================
-- SISTEMA DE GESTIÓN ESCOLAR ALEI - v4.0
-- Esquema PostgreSQL Completo
-- ============================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. AÑOS LECTIVOS (Separación de datos)
-- ============================================
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_name VARCHAR(9) NOT NULL, -- '2025', '2026'
    is_active BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. TIPOS DE MATRÍCULA
-- ============================================
CREATE TABLE enrollment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(50), -- 'Regular', 'Beca 50%', 'Hermano'
    base_price DECIMAL(10,2),
    is_hermano_type BOOLEAN DEFAULT false,
    discount_pct DECIMAL(5,2) DEFAULT 0
);

-- ============================================
-- 3. ESTUDIANTES (Con contactos mejorados)
-- ============================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    birth_date DATE,
    email VARCHAR(100),
    phone_primary VARCHAR(20),
    phone_secondary VARCHAR(20),
    parent_name VARCHAR(100),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(100),
    enrollment_type_id UUID REFERENCES enrollment_types(id),
    is_hermano BOOLEAN DEFAULT false,
    custom_tuition_price DECIMAL(10,2), -- Para hermanos con precio especial
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, graduated
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. NIVELES/CURSOS
-- ============================================
CREATE TABLE levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(50),
    schedule VARCHAR(50),
    capacity INTEGER,
    teacher_name VARCHAR(100)
);

-- ============================================
-- 5. LIBROS
-- ============================================
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    title VARCHAR(200),
    author VARCHAR(100),
    price DECIMAL(10,2),
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- ============================================
-- 6. ASIGNACIÓN DE LIBROS (Con saldo pendiente)
-- ============================================
CREATE TABLE book_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    total_price DECIMAL(10,2),
    pending_balance DECIMAL(10,2), -- Saldo pendiente calculado
    assignment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending' -- pending, paid, cancelled
);

-- ============================================
-- 7. PAGOS DE LIBROS (Pagos parciales)
-- ============================================
CREATE TABLE book_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES book_assignments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2),
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_method VARCHAR(20), -- cash, transfer, card
    comment TEXT,
    previous_balance DECIMAL(10,2),
    new_balance DECIMAL(10,2),
    created_by VARCHAR(100)
);

-- ============================================
-- 8. MATRÍCULAS Y MENSUALIDADES
-- ============================================
CREATE TABLE tuition_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    concept VARCHAR(20), -- 'matricula', 'mensualidad', 'cuota'
    month_year VARCHAR(7), -- '2025-03' para mensualidades
    base_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    surcharge_amount DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2),
    amount_paid DECIMAL(10,2) DEFAULT 0,
    pending_amount DECIMAL(10,2),
    payment_date DATE,
    due_date DATE,
    status VARCHAR(20), -- paid, pending, partial, late
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- ============================================
-- 9. GASTOS (Con cuotas)
-- ============================================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    description TEXT,
    category VARCHAR(50), -- 'servicios', 'materiales', 'sueldos'
    total_amount DECIMAL(10,2),
    has_installments BOOLEAN DEFAULT false,
    installment_count INTEGER DEFAULT 1,
    start_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 10. CUOTAS DE GASTOS
-- ============================================
CREATE TABLE expense_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    installment_number INTEGER,
    amount DECIMAL(10,2),
    due_date DATE,
    is_paid BOOLEAN DEFAULT false,
    paid_date DATE
);

-- ============================================
-- 11. LISTA DE ESPERA/PRE-INSCRIPCIONES
-- ============================================
CREATE TABLE waiting_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    level_id UUID REFERENCES levels(id) ON DELETE SET NULL,
    student_name VARCHAR(100),
    parent_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    registration_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, converted, cancelled
    priority INTEGER DEFAULT 0,
    notes TEXT
);

-- ============================================
-- 12. AUDITORÍA (Quién modificó qué)
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50),
    record_id UUID,
    action VARCHAR(20), -- insert, update, delete
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 13. ALERTAS SISTEMA
-- ============================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30), -- 'birthday', 'late_payment', 'book_pending', 'custom'
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    due_action_date DATE
);

-- ============================================
-- ÍNDICES PARA MEJOR PERFORMANCE
-- ============================================
CREATE INDEX idx_students_year ON students(year_id);
CREATE INDEX idx_students_cedula ON students(cedula);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_tuition_student ON tuition_payments(student_id);
CREATE INDEX idx_tuition_month ON tuition_payments(month_year);
CREATE INDEX idx_tuition_status ON tuition_payments(status);
CREATE INDEX idx_book_assign_student ON book_assignments(student_id);
CREATE INDEX idx_book_assign_status ON book_assignments(status);
CREATE INDEX idx_book_payments_assignment ON book_payments(assignment_id);
CREATE INDEX idx_expenses_year ON expenses(year_id);
CREATE INDEX idx_waiting_list_year ON waiting_list(year_id);
CREATE INDEX idx_alerts_student ON alerts(student_id);
CREATE INDEX idx_alerts_read ON alerts(is_read);

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Insertar año lectivo 2025 por defecto
INSERT INTO academic_years (year_name, is_active, start_date, end_date) 
VALUES ('2025', true, '2025-03-01', '2025-12-15');

-- Insertar tipos de matrícula básicos
INSERT INTO enrollment_types (year_id, name, base_price, is_hermano_type, discount_pct)
SELECT 
    id as year_id,
    unnest(ARRAY['Regular', 'Beca 50%', 'Hermano']) as name,
    unnest(ARRAY[2500.00, 1250.00, 2000.00]) as base_price,
    unnest(ARRAY[false, false, true]) as is_hermano_type,
    unnest(ARRAY[0.00, 50.00, 0.00]) as discount_pct
FROM academic_years WHERE year_name = '2025';

-- ============================================
-- FUNCIÓN PARA ACTUALIZAR TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_students_updated_at 
    BEFORE UPDATE ON students 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
