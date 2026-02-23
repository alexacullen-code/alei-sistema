-- ============================================
-- FUNCIONES AUXILIARES PARA ALEI
-- ============================================

-- Función para generar alerta de cumpleaños
CREATE OR REPLACE FUNCTION check_birthdays()
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    parent_phone VARCHAR,
    message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.first_name || ' ' || s.last_name,
        s.parent_phone,
        'Hoy es el cumpleaños de ' || s.first_name || ' ' || s.last_name
    FROM students s
    WHERE EXTRACT(MONTH FROM s.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM s.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
      AND s.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Función para obtener deudores de mensualidades
CREATE OR REPLACE FUNCTION get_debtors(p_year_id UUID, p_month_year VARCHAR)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    parent_name VARCHAR,
    parent_phone VARCHAR,
    pending_amount DECIMAL,
    days_overdue INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.first_name || ' ' || s.last_name,
        s.parent_name,
        s.parent_phone,
        COALESCE(tp.pending_amount, et.base_price),
        EXTRACT(DAY FROM CURRENT_DATE - (p_month_year || '-15')::DATE)::INTEGER
    FROM students s
    JOIN enrollment_types et ON s.enrollment_type_id = et.id
    LEFT JOIN tuition_payments tp ON s.id = tp.student_id AND tp.month_year = p_month_year
    WHERE s.year_id = p_year_id
      AND s.status = 'active'
      AND (tp.status IS NULL OR tp.status IN ('pending', 'partial', 'late'));
END;
$$ LANGUAGE plpgsql;

-- Función para calcular ingresos del día
CREATE OR REPLACE FUNCTION get_daily_income(p_date DATE)
RETURNS TABLE (
    concept TEXT,
    total DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Mensualidades'::TEXT,
        COALESCE(SUM(tp.amount_paid), 0)
    FROM tuition_payments tp
    WHERE tp.payment_date = p_date
    
    UNION ALL
    
    SELECT 
        'Libros'::TEXT,
        COALESCE(SUM(bp.amount), 0)
    FROM book_payments bp
    WHERE DATE(bp.payment_date) = p_date;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener resumen de morosidad
CREATE OR REPLACE FUNCTION get_overdue_summary(p_year_id UUID)
RETURNS TABLE (
    month_year VARCHAR,
    total_debtors BIGINT,
    total_pending DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tp.month_year,
        COUNT(*)::BIGINT as total_debtors,
        COALESCE(SUM(tp.pending_amount), 0) as total_pending
    FROM tuition_payments tp
    JOIN students s ON tp.student_id = s.id
    WHERE s.year_id = p_year_id
      AND tp.status IN ('pending', 'partial', 'late')
      AND tp.month_year <= TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    GROUP BY tp.month_year
    ORDER BY tp.month_year DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para generar alertas automáticas de pagos atrasados
CREATE OR REPLACE FUNCTION generate_late_payment_alerts()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT 
            s.id as student_id,
            s.first_name || ' ' || s.last_name as student_name,
            tp.month_year,
            tp.pending_amount
        FROM tuition_payments tp
        JOIN students s ON tp.student_id = s.id
        WHERE tp.status IN ('pending', 'partial', 'late')
          AND tp.due_date < CURRENT_DATE
          AND NOT EXISTS (
              SELECT 1 FROM alerts a 
              WHERE a.student_id = s.id 
                AND a.type = 'late_payment'
                AND a.message LIKE '%' || tp.month_year || '%'
                AND a.is_read = false
          )
    LOOP
        INSERT INTO alerts (type, student_id, message, due_action_date)
        VALUES (
            'late_payment',
            rec.student_id,
            'Pago atrasado: ' || rec.month_year || ' - Monto pendiente: $' || rec.pending_amount,
            CURRENT_DATE + INTERVAL '7 days'
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas del dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_year_id UUID)
RETURNS TABLE (
    total_students BIGINT,
    active_students BIGINT,
    today_income DECIMAL,
    total_pending_tuition DECIMAL,
    total_pending_books DECIMAL,
    unread_alerts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM students WHERE year_id = p_year_id),
        (SELECT COUNT(*) FROM students WHERE year_id = p_year_id AND status = 'active'),
        (
            SELECT COALESCE(SUM(amount_paid), 0) 
            FROM tuition_payments tp 
            JOIN students s ON tp.student_id = s.id 
            WHERE s.year_id = p_year_id AND tp.payment_date = CURRENT_DATE
        ) + (
            SELECT COALESCE(SUM(amount), 0) 
            FROM book_payments bp 
            JOIN book_assignments ba ON bp.assignment_id = ba.id
            JOIN students s ON ba.student_id = s.id
            WHERE s.year_id = p_year_id AND DATE(bp.payment_date) = CURRENT_DATE
        ),
        (
            SELECT COALESCE(SUM(pending_amount), 0) 
            FROM tuition_payments tp 
            JOIN students s ON tp.student_id = s.id 
            WHERE s.year_id = p_year_id AND tp.pending_amount > 0
        ),
        (
            SELECT COALESCE(SUM(pending_balance), 0) 
            FROM book_assignments ba 
            JOIN students s ON ba.student_id = s.id 
            WHERE s.year_id = p_year_id AND ba.pending_balance > 0
        ),
        (
            SELECT COUNT(*) 
            FROM alerts a 
            JOIN students s ON a.student_id = s.id 
            WHERE s.year_id = p_year_id AND a.is_read = false
        );
END;
$$ LANGUAGE plpgsql;

-- Vista para resumen de alumnos por tipo de matrícula
CREATE OR REPLACE VIEW student_summary_by_type AS
SELECT 
    ay.year_name,
    et.name as enrollment_type,
    COUNT(s.id) as total_students,
    SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_students,
    SUM(CASE WHEN s.is_hermano THEN 1 ELSE 0 END) as hermano_count
FROM academic_years ay
JOIN enrollment_types et ON ay.id = et.year_id
LEFT JOIN students s ON et.id = s.enrollment_type_id
GROUP BY ay.year_name, et.name
ORDER BY ay.year_name DESC, et.name;

-- Vista para pagos del mes actual
CREATE OR REPLACE VIEW current_month_payments AS
SELECT 
    s.first_name || ' ' || s.last_name as student_name,
    s.parent_name,
    tp.concept,
    tp.month_year,
    tp.final_amount,
    tp.amount_paid,
    tp.pending_amount,
    tp.status,
    tp.payment_date
FROM tuition_payments tp
JOIN students s ON tp.student_id = s.id
WHERE tp.month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY tp.payment_date DESC;
