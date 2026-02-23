import { Pool } from '@neondatabase/serverless';

// ============================================
// CONFIGURACIÓN DE BASE DE DATOS
// ============================================
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ============================================
// UTILIDADES
// ============================================
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Confirm-Reset, X-Year-ID'
};

function sendError(res, status, message) {
    return res.status(status).json({ error: message });
}

function parseBody(req) {
    try {
        return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
        return req.body;
    }
}

// ============================================
// LÓGICA DE RECARGOS/DESCUENTOS (URUGUAY)
// ============================================
function calculateTuitionWithRules(baseAmount, paymentDate, monthYear, isHermano, descuentoProntoPago, recargoAtraso) {
    // Si es hermano, no aplica recargos ni descuentos
    if (isHermano) {
        return {
            baseAmount,
            discountAmount: 0,
            surchargeAmount: 0,
            finalAmount: baseAmount,
            appliedRule: 'hermano'
        };
    }

    const [year, month] = monthYear.split('-').map(Number);
    const payment = new Date(paymentDate);
    const paymentYear = payment.getFullYear();
    const paymentMonth = payment.getMonth() + 1;
    const paymentDay = payment.getDate();

    // Fechas límite del mes que se está pagando
    const limitDiscount = new Date(year, month - 1, 10); // Día 10
    const limitNormal = new Date(year, month - 1, 15);   // Día 15
    const limitRecargo = new Date(year, month - 1, 16);  // Día 16

    let discountAmount = 0;
    let surchargeAmount = 0;
    let appliedRule = '';

    // Calcular diferencia en meses entre fecha de pago y mes pagado
    const monthDiff = (paymentYear - year) * 12 + (paymentMonth - month);

    if (monthDiff < 0) {
        // Pago anticipado (ej: paga marzo en febrero)
        discountAmount = descuentoProntoPago;
        appliedRule = 'anticipado';
    } else if (monthDiff === 0) {
        // Pago del mes actual
        if (paymentDay <= 10) {
            discountAmount = descuentoProntoPago;
            appliedRule = 'pronto_pago';
        } else if (paymentDay <= 15) {
            // Precio normal
            appliedRule = 'normal';
        } else {
            surchargeAmount = recargoAtraso;
            appliedRule = 'recargo';
        }
    } else {
        // Pago atrasado (ej: paga septiembre en octubre)
        surchargeAmount = recargoAtraso;
        appliedRule = 'atrasado';
    }

    return {
        baseAmount,
        discountAmount,
        surchargeAmount,
        finalAmount: baseAmount - discountAmount + surchargeAmount,
        appliedRule
    };
}

// ============================================
// HANDLER PRINCIPAL
// ============================================
export default async function handler(req, res) {
    // CORS
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace('/api/', '').replace(/\/$/, '');
    const query = Object.fromEntries(url.searchParams);

    console.log(`[API] ${req.method} ${path}`, query);

    try {
        // ============================================
        // AÑOS LECTIVOS
        // ============================================
        if (path === 'years' && req.method === 'GET') {
            const result = await pool.query('SELECT * FROM academic_years ORDER BY year_name DESC');
            return res.json(result.rows);
        }

        if (path === 'years' && req.method === 'POST') {
            const body = parseBody(req);
            const { year_name, start_date, end_date, matricula_price, mensualidad_price } = body;
            const result = await pool.query(
                `INSERT INTO academic_years (year_name, start_date, end_date, matricula_price, mensualidad_price) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [year_name, start_date, end_date, matricula_price || 2500, mensualidad_price || 3200]
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('years/') && path.endsWith('/activate') && req.method === 'PUT') {
            const id = path.split('/')[1];
            await pool.query('UPDATE academic_years SET is_active = false');
            await pool.query('UPDATE academic_years SET is_active = true WHERE id = $1', [id]);
            return res.json({ success: true, message: 'Año activado' });
        }

        if (path.startsWith('years/') && req.method === 'GET') {
            const id = path.split('/')[1];
            const result = await pool.query('SELECT * FROM academic_years WHERE id = $1', [id]);
            return res.json(result.rows[0]);
        }

        // ============================================
        // TIPOS DE MATRÍCULA
        // ============================================
        if (path === 'enrollment-types' && req.method === 'GET') {
            const { year_id } = query;
            let sql = 'SELECT * FROM enrollment_types';
            let params = [];
            if (year_id) {
                sql += ' WHERE year_id = $1 OR year_id IS NULL';
                params.push(year_id);
            }
            sql += ' ORDER BY name';
            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'enrollment-types' && req.method === 'POST') {
            const body = parseBody(req);
            const { year_id, name, base_price, discount_pct, is_hermano_type, description } = body;
            const result = await pool.query(
                `INSERT INTO enrollment_types (year_id, name, base_price, discount_pct, is_hermano_type, description) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [year_id, name, base_price || 0, discount_pct || 0, is_hermano_type || false, description]
            );
            return res.json(result.rows[0]);
        }

        // ============================================
        // NIVELES/CURSOS
        // ============================================
        if (path === 'levels' && req.method === 'GET') {
            const { year_id } = query;
            let sql = 'SELECT l.*, (SELECT COUNT(*) FROM students s WHERE s.level_id = l.id AND s.status = $1) as student_count FROM levels l';
            let params = ['active'];
            if (year_id) {
                sql += ' WHERE l.year_id = $2';
                params.push(year_id);
            }
            sql += ' ORDER BY l.name';
            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'levels' && req.method === 'POST') {
            const body = parseBody(req);
            const { year_id, name, schedule, capacity, teacher_name, classroom } = body;
            const result = await pool.query(
                `INSERT INTO levels (year_id, name, schedule, capacity, teacher_name, classroom) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [year_id, name, schedule, capacity || 20, teacher_name, classroom]
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('levels/') && req.method === 'PUT') {
            const id = path.split('/')[1];
            const body = parseBody(req);
            const fields = [];
            const values = [];
            let idx = 1;
            
            ['name', 'schedule', 'capacity', 'teacher_name', 'classroom', 'is_active'].forEach(field => {
                if (body[field] !== undefined) {
                    fields.push(`${field} = $${idx}`);
                    values.push(body[field]);
                    idx++;
                }
            });
            
            if (fields.length === 0) return sendError(res, 400, 'No fields to update');
            
            values.push(id);
            const result = await pool.query(
                `UPDATE levels SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
                values
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('levels/') && req.method === 'DELETE') {
            const id = path.split('/')[1];
            await pool.query('DELETE FROM levels WHERE id = $1', [id]);
            return res.json({ success: true });
        }

        // ============================================
        // ESTUDIANTES
        // ============================================
        if (path === 'students' && req.method === 'GET') {
            const { year_id, search, status, level_id, include_inactive } = query;
            
            let sql = `
                SELECT s.*, l.name as level_name, et.name as enrollment_type_name,
                       (SELECT COALESCE(SUM(pending_balance), 0) FROM book_assignments WHERE student_id = s.id AND status != 'cancelled') as book_debt,
                       (SELECT COALESCE(SUM(pending_amount), 0) FROM tuition_payments WHERE student_id = s.id AND status IN ('pending', 'partial', 'late')) as tuition_debt
                FROM students s
                LEFT JOIN levels l ON s.level_id = l.id
                LEFT JOIN enrollment_types et ON s.enrollment_type_id = et.id
                WHERE 1=1
            `;
            let params = [];
            let idx = 1;

            if (year_id) {
                sql += ` AND s.year_id = $${idx}`;
                params.push(year_id);
                idx++;
            }

            if (status) {
                sql += ` AND s.status = $${idx}`;
                params.push(status);
                idx++;
            } else if (!include_inactive) {
                sql += ` AND s.status = $${idx}`;
                params.push('active');
                idx++;
            }

            if (level_id) {
                sql += ` AND s.level_id = $${idx}`;
                params.push(level_id);
                idx++;
            }

            if (search) {
                sql += ` AND (
                    s.first_name ILIKE $${idx} OR 
                    s.last_name ILIKE $${idx} OR 
                    s.cedula ILIKE $${idx} OR
                    s.parent_name ILIKE $${idx}
                )`;
                params.push(`%${search}%`);
                idx++;
            }

            sql += ' ORDER BY s.numero_anual DESC, s.created_at DESC';

            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'students' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // Verificar cédula única
                const existing = await client.query('SELECT id FROM students WHERE cedula = $1', [body.cedula]);
                if (existing.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return sendError(res, 400, 'Ya existe un estudiante con esa cédula');
                }

                // Obtener número anual
                const yearResult = await client.query(
                    'SELECT COALESCE(MAX(numero_anual), 0) + 1 as next_num FROM students WHERE year_id = $1',
                    [body.year_id]
                );
                const numeroAnual = yearResult.rows[0].next_num;

                const result = await client.query(
                    `INSERT INTO students (
                        year_id, numero_anual, cedula, first_name, last_name, birth_date,
                        email, phone_primary, phone_secondary, address,
                        parent_name, parent_phone, parent_email, parent_relationship,
                        level_id, enrollment_type_id, is_hermano, custom_tuition_price,
                        enrollment_date, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                    RETURNING *`,
                    [
                        body.year_id, numeroAnual, body.cedula, body.first_name, body.last_name, body.birth_date,
                        body.email, body.phone_primary, body.phone_secondary, body.address,
                        body.parent_name, body.parent_phone, body.parent_email, body.parent_relationship,
                        body.level_id, body.enrollment_type_id, body.is_hermano || false, body.custom_tuition_price,
                        body.enrollment_date || new Date().toISOString().split('T')[0], 'active'
                    ]
                );

                await client.query('COMMIT');
                return res.json(result.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        if (path.startsWith('students/') && req.method === 'GET' && !path.includes('/full-profile') && !path.includes('/books') && !path.includes('/payments')) {
            const id = path.split('/')[1];
            const result = await pool.query(
                `SELECT s.*, l.name as level_name, et.name as enrollment_type_name
                 FROM students s
                 LEFT JOIN levels l ON s.level_id = l.id
                 LEFT JOIN enrollment_types et ON s.enrollment_type_id = et.id
                 WHERE s.id = $1`,
                [id]
            );
            if (result.rows.length === 0) return sendError(res, 404, 'Estudiante no encontrado');
            return res.json(result.rows[0]);
        }

        if (path.startsWith('students/') && req.method === 'PUT') {
            const id = path.split('/')[1];
            const body = parseBody(req);
            
            // Verificar cédula única si se está cambiando
            if (body.cedula) {
                const existing = await pool.query('SELECT id FROM students WHERE cedula = $1 AND id != $2', [body.cedula, id]);
                if (existing.rows.length > 0) {
                    return sendError(res, 400, 'Ya existe otro estudiante con esa cédula');
                }
            }

            const allowedFields = [
                'cedula', 'first_name', 'last_name', 'birth_date', 'email',
                'phone_primary', 'phone_secondary', 'address',
                'parent_name', 'parent_phone', 'parent_email', 'parent_relationship',
                'level_id', 'enrollment_type_id', 'is_hermano', 'custom_tuition_price', 'status'
            ];
            
            const fields = [];
            const values = [];
            let idx = 1;
            
            allowedFields.forEach(field => {
                if (body[field] !== undefined) {
                    fields.push(`${field} = $${idx}`);
                    values.push(body[field]);
                    idx++;
                }
            });
            
            if (fields.length === 0) return sendError(res, 400, 'No fields to update');
            
            values.push(id);
            const result = await pool.query(
                `UPDATE students SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
                values
            );
            
            if (result.rows.length === 0) return sendError(res, 404, 'Estudiante no encontrado');
            return res.json(result.rows[0]);
        }

        if (path.startsWith('students/') && req.method === 'DELETE') {
            const id = path.split('/')[1];
            await pool.query('UPDATE students SET status = $1 WHERE id = $2', ['inactive', id]);
            return res.json({ success: true, message: 'Estudiante desactivado' });
        }

        // Ficha completa del estudiante
        if (path.startsWith('students/') && path.includes('/full-profile') && req.method === 'GET') {
            const id = path.split('/')[1];
            
            const student = await pool.query(
                `SELECT s.*, l.name as level_name, l.schedule, et.name as enrollment_type_name
                 FROM students s
                 LEFT JOIN levels l ON s.level_id = l.id
                 LEFT JOIN enrollment_types et ON s.enrollment_type_id = et.id
                 WHERE s.id = $1`,
                [id]
            );
            
            if (student.rows.length === 0) return sendError(res, 404, 'Estudiante no encontrado');

            const books = await pool.query(
                `SELECT ba.*, b.title as book_title, b.author
                 FROM book_assignments ba
                 JOIN books b ON ba.book_id = b.id
                 WHERE ba.student_id = $1
                 ORDER BY ba.assignment_date DESC`,
                [id]
            );

            const tuition = await pool.query(
                `SELECT * FROM tuition_payments 
                 WHERE student_id = $1 
                 ORDER BY month_year DESC, created_at DESC`,
                [id]
            );

            const bookPayments = await pool.query(
                `SELECT bp.*, ba.book_id
                 FROM book_payments bp
                 JOIN book_assignments ba ON bp.assignment_id = ba.id
                 WHERE ba.student_id = $1
                 ORDER BY bp.payment_date DESC`,
                [id]
            );

            return res.json({
                student: student.rows[0],
                books: books.rows,
                tuition: tuition.rows,
                bookPayments: bookPayments.rows
            });
        }

        // ============================================
        // LIBROS
        // ============================================
        if (path === 'books' && req.method === 'GET') {
            const { year_id, level_id, search, low_stock } = query;
            
            let sql = `
                SELECT b.*, l.name as level_name,
                       (SELECT COUNT(*) FROM book_assignments WHERE book_id = b.id AND status != 'cancelled') as assignments_count
                FROM books b
                LEFT JOIN levels l ON b.level_id = l.id
                WHERE b.is_active = true
            `;
            let params = [];
            let idx = 1;

            if (year_id) {
                sql += ` AND b.year_id = $${idx}`;
                params.push(year_id);
                idx++;
            }

            if (level_id) {
                sql += ` AND b.level_id = $${idx}`;
                params.push(level_id);
                idx++;
            }

            if (search) {
                sql += ` AND (b.title ILIKE $${idx} OR b.author ILIKE $${idx} OR b.isbn ILIKE $${idx})`;
                params.push(`%${search}%`);
                idx++;
            }

            if (low_stock === 'true') {
                sql += ` AND b.stock <= b.min_stock`;
            }

            sql += ' ORDER BY b.title';

            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'books' && req.method === 'POST') {
            const body = parseBody(req);
            const result = await pool.query(
                `INSERT INTO books (year_id, title, author, publisher, isbn, price, cost_price, stock, min_stock, level_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                [
                    body.year_id, body.title, body.author, body.publisher, body.isbn,
                    body.price, body.cost_price, body.stock || 0, body.min_stock || 5, body.level_id
                ]
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('books/') && req.method === 'PUT') {
            const id = path.split('/')[1];
            const body = parseBody(req);
            
            const allowedFields = ['title', 'author', 'publisher', 'isbn', 'price', 'cost_price', 'stock', 'min_stock', 'level_id', 'is_active'];
            const fields = [];
            const values = [];
            let idx = 1;
            
            allowedFields.forEach(field => {
                if (body[field] !== undefined) {
                    fields.push(`${field} = $${idx}`);
                    values.push(body[field]);
                    idx++;
                }
            });
            
            if (fields.length === 0) return sendError(res, 400, 'No fields to update');
            
            values.push(id);
            const result = await pool.query(
                `UPDATE books SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
                values
            );
            
            return res.json(result.rows[0]);
        }

        if (path.startsWith('books/') && req.method === 'DELETE') {
            const id = path.split('/')[1];
            await pool.query('UPDATE books SET is_active = false WHERE id = $1', [id]);
            return res.json({ success: true });
        }

        // ============================================
        // ASIGNACIÓN DE LIBROS
        // ============================================
        if (path === 'books/assign' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // Verificar stock
                const book = await client.query('SELECT * FROM books WHERE id = $1', [body.book_id]);
                if (book.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return sendError(res, 404, 'Libro no encontrado');
                }
                if (book.rows[0].stock < 1) {
                    await client.query('ROLLBACK');
                    return sendError(res, 400, 'No hay stock disponible');
                }

                // Crear asignación
                const totalPrice = body.total_price || book.rows[0].price;
                const result = await client.query(
                    `INSERT INTO book_assignments (student_id, book_id, total_price, pending_balance, status)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [body.student_id, body.book_id, totalPrice, totalPrice, body.status || 'pending']
                );

                // Descontar stock
                await client.query('UPDATE books SET stock = stock - 1 WHERE id = $1', [body.book_id]);

                await client.query('COMMIT');
                return res.json(result.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        if (path.startsWith('books/student/') && req.method === 'GET') {
            const studentId = path.split('/')[2];
            const result = await pool.query(
                `SELECT ba.*, b.title as book_title, b.author
                 FROM book_assignments ba
                 JOIN books b ON ba.book_id = b.id
                 WHERE ba.student_id = $1 AND ba.pending_balance > 0
                 ORDER BY ba.assignment_date DESC`,
                [studentId]
            );
            return res.json(result.rows);
        }

        // ============================================
        // PAGOS DE LIBROS (PARCIALES)
        // ============================================
        if (path === 'payments/books' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // Obtener asignación actual
                const assignment = await client.query(
                    'SELECT * FROM book_assignments WHERE id = $1',
                    [body.assignment_id]
                );
                
                if (assignment.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return sendError(res, 404, 'Asignación no encontrada');
                }

                const currentBalance = parseFloat(assignment.rows[0].pending_balance);
                const paymentAmount = parseFloat(body.amount);

                if (paymentAmount > currentBalance) {
                    await client.query('ROLLBACK');
                    return sendError(res, 400, 'El pago excede el saldo pendiente');
                }

                const newBalance = currentBalance - paymentAmount;

                // Registrar pago
                const paymentResult = await client.query(
                    `INSERT INTO book_payments (assignment_id, amount, payment_method, comment, previous_balance, new_balance, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [body.assignment_id, paymentAmount, body.payment_method, body.comment, currentBalance, newBalance, body.created_by]
                );

                // Actualizar saldo de asignación
                const newStatus = newBalance <= 0 ? 'paid' : 'pending';
                await client.query(
                    'UPDATE book_assignments SET pending_balance = $1, status = $2 WHERE id = $3',
                    [newBalance, newStatus, body.assignment_id]
                );

                await client.query('COMMIT');
                return res.json(paymentResult.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        // ============================================
        // PAGOS DE MENSUALIDADES
        // ============================================
        if (path === 'payments/tuition' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                const student = await client.query('SELECT * FROM students WHERE id = $1', [body.student_id]);
                if (student.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return sendError(res, 404, 'Estudiante no encontrado');
                }

                const studentData = student.rows[0];
                const yearData = await client.query('SELECT * FROM academic_years WHERE id = $1', [studentData.year_id]);
                const yearConfig = yearData.rows[0];

                let baseAmount, finalAmount, discountAmount, surchargeAmount;

                if (studentData.is_hermano && studentData.custom_tuition_price) {
                    // Hermano con precio custom
                    baseAmount = parseFloat(studentData.custom_tuition_price);
                    finalAmount = baseAmount;
                    discountAmount = 0;
                    surchargeAmount = 0;
                } else {
                    // Calcular con reglas normales
                    baseAmount = parseFloat(body.base_amount);
                    const calculation = calculateTuitionWithRules(
                        baseAmount,
                        body.payment_date || new Date().toISOString().split('T')[0],
                        body.month_year,
                        studentData.is_hermano,
                        yearConfig.descuento_pronto_pago,
                        yearConfig.recargo_atraso
                    );
                    discountAmount = calculation.discountAmount;
                    surchargeAmount = calculation.surchargeAmount;
                    finalAmount = calculation.finalAmount;
                }

                // Verificar si ya existe un pago para este mes
                const existing = await client.query(
                    'SELECT * FROM tuition_payments WHERE student_id = $1 AND month_year = $2 AND concept = $3',
                    [body.student_id, body.month_year, body.concept]
                );

                let result;
                if (existing.rows.length > 0 && existing.rows[0].status !== 'paid') {
                    // Actualizar pago existente
                    const existingPayment = existing.rows[0];
                    const newAmountPaid = parseFloat(existingPayment.amount_paid) + parseFloat(body.amount_paid);
                    const newPending = finalAmount - newAmountPaid;
                    const newStatus = newPending <= 0 ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'pending');

                    result = await client.query(
                        `UPDATE tuition_payments 
                         SET amount_paid = $1, pending_amount = $2, status = $3, payment_date = $4, updated_at = NOW()
                         WHERE id = $5 RETURNING *`,
                        [newAmountPaid, newPending, newStatus, body.payment_date, existingPayment.id]
                    );
                } else {
                    // Crear nuevo pago
                    const amountPaid = parseFloat(body.amount_paid || 0);
                    const pending = finalAmount - amountPaid;
                    const status = pending <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending');

                    result = await client.query(
                        `INSERT INTO tuition_payments (
                            student_id, concept, month_year, base_amount, discount_amount, 
                            surcharge_amount, final_amount, amount_paid, pending_amount,
                            payment_date, due_date, status, comment, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
                        [
                            body.student_id, body.concept, body.month_year, baseAmount, discountAmount,
                            surchargeAmount, finalAmount, amountPaid, pending,
                            body.payment_date, body.due_date, status, body.comment, body.created_by
                        ]
                    );
                }

                await client.query('COMMIT');
                return res.json(result.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        // Pago parcial de mensualidad existente
        if (path === 'payments/tuition/partial' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                const tuition = await client.query('SELECT * FROM tuition_payments WHERE id = $1', [body.tuition_id]);
                if (tuition.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return sendError(res, 404, 'Pago no encontrado');
                }

                const currentPayment = tuition.rows[0];
                const currentPending = parseFloat(currentPayment.pending_amount);
                const paymentAmount = parseFloat(body.amount);

                if (paymentAmount > currentPending) {
                    await client.query('ROLLBACK');
                    return sendError(res, 400, 'El pago excede el saldo pendiente');
                }

                const newPending = currentPending - paymentAmount;
                const newAmountPaid = parseFloat(currentPayment.amount_paid) + paymentAmount;
                const newStatus = newPending <= 0 ? 'paid' : 'partial';

                // Registrar pago parcial
                await client.query(
                    `INSERT INTO tuition_partial_payments (tuition_id, amount, payment_method, comment, previous_balance, new_balance, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [body.tuition_id, paymentAmount, body.payment_method, body.comment, currentPending, newPending, body.created_by]
                );

                // Actualizar mensualidad
                const result = await client.query(
                    `UPDATE tuition_payments 
                     SET amount_paid = $1, pending_amount = $2, status = $3, payment_date = $4, updated_at = NOW()
                     WHERE id = $5 RETURNING *`,
                    [newAmountPaid, newPending, newStatus, body.payment_date, body.tuition_id]
                );

                await client.query('COMMIT');
                return res.json(result.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        // ============================================
        // PAGO RÁPIDO (MODO POS)
        // ============================================
        if (path === 'payments/quick' && req.method === 'POST') {
            const body = parseBody(req);
            const { student_id, concept, amount, month_year, payment_method, comment, created_by } = body;

            if (!student_id || !concept || !amount) {
                return sendError(res, 400, 'Faltan datos requeridos: student_id, concept, amount');
            }

            if (concept === 'libro') {
                // Para libros, necesitamos assignment_id
                return sendError(res, 400, 'Para pagos de libros use /payments/books');
            }

            // Para matrícula o mensualidad
            const paymentData = {
                student_id,
                concept,
                month_year: month_year || new Date().toISOString().slice(0, 7),
                base_amount: amount,
                amount_paid: amount,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method,
                comment,
                created_by
            };

            // Reutilizar la lógica de payments/tuition
            req.body = JSON.stringify(paymentData);
            return handler(req, res);
        }

        // ============================================
        // PAGOS PENDIENTES (DASHBOARD)
        // ============================================
        if (path === 'payments/pending' && req.method === 'GET') {
            const { year_id, month_year } = query;
            
            // Mensualidades pendientes
            const tuitionSql = `
                SELECT tp.*, s.first_name, s.last_name, s.cedula, s.phone_primary, s.parent_name, s.parent_phone
                FROM tuition_payments tp
                JOIN students s ON tp.student_id = s.id
                WHERE tp.status IN ('pending', 'partial', 'late')
                ${year_id ? 'AND s.year_id = $1' : ''}
                ${month_year ? (year_id ? 'AND tp.month_year = $2' : 'AND tp.month_year = $1') : ''}
                ORDER BY tp.month_year, s.last_name, s.first_name
            `;
            const tuitionParams = [];
            if (year_id) tuitionParams.push(year_id);
            if (month_year) tuitionParams.push(month_year);
            
            const tuitionResult = await pool.query(tuitionSql, tuitionParams);

            // Libros pendientes
            const booksSql = `
                SELECT ba.*, s.first_name, s.last_name, s.cedula, s.phone_primary, s.parent_name, s.parent_phone,
                       b.title as book_title
                FROM book_assignments ba
                JOIN students s ON ba.student_id = s.id
                JOIN books b ON ba.book_id = b.id
                WHERE ba.pending_balance > 0 AND ba.status != 'cancelled'
                ${year_id ? 'AND s.year_id = $1' : ''}
                ORDER BY ba.assignment_date
            `;
            const booksParams = year_id ? [year_id] : [];
            
            const booksResult = await pool.query(booksSql, booksParams);

            return res.json({
                tuition: tuitionResult.rows,
                books: booksResult.rows,
                totalTuitionDebt: tuitionResult.rows.reduce((sum, r) => sum + parseFloat(r.pending_amount), 0),
                totalBooksDebt: booksResult.rows.reduce((sum, r) => sum + parseFloat(r.pending_balance), 0)
            });
        }

        // ============================================
        // GASTOS
        // ============================================
        if (path === 'expenses' && req.method === 'GET') {
            const { year_id, category, status } = query;
            
            let sql = `
                SELECT e.*, 
                       (SELECT COUNT(*) FROM expense_installments WHERE expense_id = e.id AND is_paid = true) as paid_installments,
                       (SELECT COUNT(*) FROM expense_installments WHERE expense_id = e.id) as total_installments
                FROM expenses e
                WHERE 1=1
            `;
            let params = [];
            let idx = 1;

            if (year_id) {
                sql += ` AND e.year_id = $${idx}`;
                params.push(year_id);
                idx++;
            }

            if (category) {
                sql += ` AND e.category = $${idx}`;
                params.push(category);
                idx++;
            }

            if (status) {
                sql += ` AND e.status = $${idx}`;
                params.push(status);
                idx++;
            }

            sql += ' ORDER BY e.expense_date DESC';

            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'expenses' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                const { year_id, description, category, provider, total_amount, has_installments, installment_count, expense_date, start_date, created_by } = body;
                
                const result = await client.query(
                    `INSERT INTO expenses (year_id, description, category, provider, total_amount, has_installments, installment_count, expense_date, start_date, status, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                    [year_id, description, category, provider, total_amount, has_installments || false, installment_count || 1, expense_date, start_date, 'pending', created_by]
                );

                const expenseId = result.rows[0].id;

                // Crear cuotas si aplica
                if (has_installments && installment_count > 1) {
                    const installmentAmount = total_amount / installment_count;
                    const startDate = new Date(start_date || expense_date);
                    
                    for (let i = 0; i < installment_count; i++) {
                        const dueDate = new Date(startDate);
                        dueDate.setMonth(dueDate.getMonth() + i);
                        
                        await client.query(
                            `INSERT INTO expense_installments (expense_id, installment_number, amount, due_date)
                             VALUES ($1, $2, $3, $4)`,
                            [expenseId, i + 1, installmentAmount, dueDate.toISOString().split('T')[0]]
                        );
                    }
                } else {
                    // Una sola cuota
                    await client.query(
                        `INSERT INTO expense_installments (expense_id, installment_number, amount, due_date)
                         VALUES ($1, $2, $3, $4)`,
                        [expenseId, 1, total_amount, expense_date]
                    );
                }

                await client.query('COMMIT');
                return res.json(result.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        if (path.startsWith('expenses/') && req.method === 'PUT') {
            const id = path.split('/')[1];
            const body = parseBody(req);
            
            const allowedFields = ['description', 'category', 'provider', 'total_amount', 'status'];
            const fields = [];
            const values = [];
            let idx = 1;
            
            allowedFields.forEach(field => {
                if (body[field] !== undefined) {
                    fields.push(`${field} = $${idx}`);
                    values.push(body[field]);
                    idx++;
                }
            });
            
            if (fields.length === 0) return sendError(res, 400, 'No fields to update');
            
            values.push(id);
            const result = await pool.query(
                `UPDATE expenses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
                values
            );
            
            return res.json(result.rows[0]);
        }

        if (path.startsWith('expenses/') && path.includes('/installments') && req.method === 'GET') {
            const expenseId = path.split('/')[1];
            const result = await pool.query(
                'SELECT * FROM expense_installments WHERE expense_id = $1 ORDER BY installment_number',
                [expenseId]
            );
            return res.json(result.rows);
        }

        if (path.startsWith('expenses/installments/') && req.method === 'PUT') {
            const installmentId = path.split('/')[2];
            const body = parseBody(req);
            
            const result = await pool.query(
                `UPDATE expense_installments 
                 SET is_paid = $1, paid_date = $2, payment_method = $3, comment = $4
                 WHERE id = $5 RETURNING *`,
                [body.is_paid, body.paid_date, body.payment_method, body.comment, installmentId]
            );

            // Actualizar estado del gasto
            const expenseId = result.rows[0]?.expense_id;
            if (expenseId) {
                const stats = await pool.query(
                    `SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN is_paid THEN 1 END) as paid
                     FROM expense_installments WHERE expense_id = $1`,
                    [expenseId]
                );
                
                const { total, paid } = stats.rows[0];
                let newStatus = 'pending';
                if (paid == total) newStatus = 'paid';
                else if (paid > 0) newStatus = 'partial';
                
                await pool.query('UPDATE expenses SET status = $1 WHERE id = $2', [newStatus, expenseId]);
            }

            return res.json(result.rows[0]);
        }

        // ============================================
        // LISTA DE ESPERA
        // ============================================
        if (path === 'waiting-list' && req.method === 'GET') {
            const { year_id, status, level_id } = query;
            
            let sql = `
                SELECT w.*, l.name as level_name
                FROM waiting_list w
                LEFT JOIN levels l ON w.level_id = l.id
                WHERE 1=1
            `;
            let params = [];
            let idx = 1;

            if (year_id) {
                sql += ` AND w.year_id = $${idx}`;
                params.push(year_id);
                idx++;
            }

            if (status) {
                sql += ` AND w.status = $${idx}`;
                params.push(status);
                idx++;
            }

            if (level_id) {
                sql += ` AND w.level_id = $${idx}`;
                params.push(level_id);
                idx++;
            }

            sql += ' ORDER BY w.priority DESC, w.registration_date ASC';

            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'waiting-list' && req.method === 'POST') {
            const body = parseBody(req);
            const result = await pool.query(
                `INSERT INTO waiting_list (year_id, level_id, student_name, student_age, parent_name, phone, email, preferred_schedule, previous_academy, notes, priority)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [
                    body.year_id, body.level_id, body.student_name, body.student_age,
                    body.parent_name, body.phone, body.email, body.preferred_schedule,
                    body.previous_academy, body.notes, body.priority || 0
                ]
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('waiting-list/') && req.method === 'PUT') {
            const id = path.split('/')[1];
            const body = parseBody(req);
            
            const allowedFields = ['student_name', 'student_age', 'parent_name', 'phone', 'email', 
                                   'preferred_schedule', 'previous_academy', 'notes', 'priority', 'status'];
            const fields = [];
            const values = [];
            let idx = 1;
            
            allowedFields.forEach(field => {
                if (body[field] !== undefined) {
                    fields.push(`${field} = $${idx}`);
                    values.push(body[field]);
                    idx++;
                }
            });
            
            if (fields.length === 0) return sendError(res, 400, 'No fields to update');
            
            values.push(id);
            const result = await pool.query(
                `UPDATE waiting_list SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
                values
            );
            
            return res.json(result.rows[0]);
        }

        if (path === 'waiting-list/convert' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // Obtener datos de la lista de espera
                const waiting = await client.query('SELECT * FROM waiting_list WHERE id = $1', [body.waiting_id]);
                if (waiting.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return sendError(res, 404, 'Registro no encontrado');
                }

                const w = waiting.rows[0];

                // Crear estudiante
                const studentResult = await client.query(
                    `INSERT INTO students (year_id, cedula, first_name, last_name, level_id, parent_name, parent_phone, parent_email, enrollment_type_id, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                    [
                        body.year_id || w.year_id, body.cedula, w.student_name, '', 
                        body.level_id || w.level_id, w.parent_name, w.phone, w.email,
                        body.enrollment_type_id, 'active'
                    ]
                );

                const studentId = studentResult.rows[0].id;

                // Actualizar lista de espera
                await client.query(
                    `UPDATE waiting_list SET status = 'converted', converted_student_id = $1, converted_date = $2 WHERE id = $3`,
                    [studentId, new Date().toISOString().split('T')[0], body.waiting_id]
                );

                await client.query('COMMIT');
                return res.json({ success: true, student: studentResult.rows[0] });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        // ============================================
        // EXÁMENES
        // ============================================
        if (path === 'exams' && req.method === 'GET') {
            const { year_id, level_id } = query;
            
            let sql = `
                SELECT e.*, l.name as level_name
                FROM exams e
                LEFT JOIN levels l ON e.level_id = l.id
                WHERE e.is_active = true
            `;
            let params = [];
            let idx = 1;

            if (year_id) {
                sql += ` AND e.year_id = $${idx}`;
                params.push(year_id);
                idx++;
            }

            if (level_id) {
                sql += ` AND e.level_id = $${idx}`;
                params.push(level_id);
                idx++;
            }

            sql += ' ORDER BY e.exam_date DESC';

            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'exams' && req.method === 'POST') {
            const body = parseBody(req);
            const result = await pool.query(
                `INSERT INTO exams (year_id, level_id, name, exam_date, exam_type, max_score)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [body.year_id, body.level_id, body.name, body.exam_date, body.exam_type, body.max_score || 100]
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('exams/') && req.method === 'GET' && !path.includes('/grades')) {
            const id = path.split('/')[1];
            const result = await pool.query(
                `SELECT e.*, l.name as level_name
                 FROM exams e
                 LEFT JOIN levels l ON e.level_id = l.id
                 WHERE e.id = $1`,
                [id]
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('exams/') && path.includes('/grades') && req.method === 'GET') {
            const examId = path.split('/')[1];
            const result = await pool.query(
                `SELECT eg.*, s.first_name, s.last_name, s.cedula
                 FROM exam_grades eg
                 JOIN students s ON eg.student_id = s.id
                 WHERE eg.exam_id = $1
                 ORDER BY s.last_name, s.first_name`,
                [examId]
            );
            return res.json(result.rows);
        }

        if (path === 'exams/grades' && req.method === 'POST') {
            const body = parseBody(req);
            const result = await pool.query(
                `INSERT INTO exam_grades (exam_id, student_id, score, status, notes)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (exam_id, student_id) 
                 DO UPDATE SET score = $3, status = $4, notes = $5, updated_at = NOW()
                 RETURNING *`,
                [body.exam_id, body.student_id, body.score, body.status, body.notes]
            );
            return res.json(result.rows[0]);
        }

        // ============================================
        // ASISTENCIA
        // ============================================
        if (path === 'attendance' && req.method === 'GET') {
            const { level_id, date } = query;
            
            const result = await pool.query(
                `SELECT a.*, s.first_name, s.last_name, s.cedula
                 FROM attendance a
                 JOIN students s ON a.student_id = s.id
                 WHERE a.level_id = $1 AND a.date = $2
                 ORDER BY s.last_name, s.first_name`,
                [level_id, date]
            );
            return res.json(result.rows);
        }

        if (path === 'attendance' && req.method === 'POST') {
            const body = parseBody(req);
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                for (const record of body.records) {
                    await client.query(
                        `INSERT INTO attendance (level_id, student_id, date, status, notes)
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT (level_id, student_id, date)
                         DO UPDATE SET status = $4, notes = $5`,
                        [body.level_id, record.student_id, body.date, record.status, record.notes]
                    );
                }

                await client.query('COMMIT');
                return res.json({ success: true, count: body.records.length });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        // ============================================
        // ALERTAS
        // ============================================
        if (path === 'alerts' && req.method === 'GET') {
            const { unread_only, type, limit = 50 } = query;
            
            let sql = `
                SELECT a.*, s.first_name, s.last_name, s.cedula
                FROM alerts a
                LEFT JOIN students s ON a.student_id = s.id
                WHERE a.is_dismissed = false
            `;
            let params = [];
            let idx = 1;

            if (unread_only === 'true') {
                sql += ` AND a.is_read = false`;
            }

            if (type) {
                sql += ` AND a.type = $${idx}`;
                params.push(type);
                idx++;
            }

            sql += ` ORDER BY a.priority DESC, a.created_at DESC LIMIT $${idx}`;
            params.push(parseInt(limit));

            const result = await pool.query(sql, params);
            return res.json(result.rows);
        }

        if (path === 'alerts' && req.method === 'POST') {
            const body = parseBody(req);
            const result = await pool.query(
                `INSERT INTO alerts (type, student_id, title, message, due_action_date, priority, category, related_table, related_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    body.type, body.student_id, body.title, body.message,
                    body.due_action_date, body.priority || 0, body.category,
                    body.related_table, body.related_id
                ]
            );
            return res.json(result.rows[0]);
        }

        if (path.startsWith('alerts/') && req.method === 'PUT') {
            const id = path.split('/')[1];
            const body = parseBody(req);
            
            const result = await pool.query(
                `UPDATE alerts SET is_read = $1, is_dismissed = $2, dismissed_at = CASE WHEN $2 THEN NOW() ELSE NULL END WHERE id = $3 RETURNING *`,
                [body.is_read, body.is_dismissed, id]
            );
            
            return res.json(result.rows[0]);
        }

        // ============================================
        // REPORTES
        // ============================================
        if (path === 'reports/cash-flow' && req.method === 'GET') {
            const { year_id, month } = query;
            
            // Ingresos por concepto
            const incomeResult = await pool.query(
                `SELECT 
                    tp.concept,
                    SUM(tp.amount_paid) as total
                 FROM tuition_payments tp
                 JOIN students s ON tp.student_id = s.id
                 WHERE s.year_id = $1 ${month ? 'AND tp.month_year = $2' : ''}
                 GROUP BY tp.concept`,
                month ? [year_id, month] : [year_id]
            );

            // Ingresos por libros
            const bookIncome = await pool.query(
                `SELECT COALESCE(SUM(bp.amount), 0) as total
                 FROM book_payments bp
                 JOIN book_assignments ba ON bp.assignment_id = ba.id
                 JOIN students s ON ba.student_id = s.id
                 WHERE s.year_id = $1 ${month ? 'AND EXTRACT(YEAR FROM bp.payment_date) = $2::int AND EXTRACT(MONTH FROM bp.payment_date) = $3::int' : ''}`,
                month ? [year_id, month.split('-')[0], month.split('-')[1]] : [year_id]
            );

            // Gastos
            const expensesResult = await pool.query(
                `SELECT 
                    category,
                    SUM(total_amount) as total
                 FROM expenses
                 WHERE year_id = $1 ${month ? 'AND EXTRACT(YEAR FROM expense_date) = $2::int AND EXTRACT(MONTH FROM expense_date) = $3::int' : ''}
                 GROUP BY category`,
                month ? [year_id, month.split('-')[0], month.split('-')[1]] : [year_id]
            );

            return res.json({
                income: {
                    tuition: incomeResult.rows,
                    books: parseFloat(bookIncome.rows[0]?.total || 0)
                },
                expenses: expensesResult.rows,
                totalIncome: incomeResult.rows.reduce((sum, r) => sum + parseFloat(r.total), 0) + parseFloat(bookIncome.rows[0]?.total || 0),
                totalExpenses: expensesResult.rows.reduce((sum, r) => sum + parseFloat(r.total), 0)
            });
        }

        if (path === 'reports/monthly-status' && req.method === 'GET') {
            const { year_id, month } = query;
            
            const result = await pool.query(
                `SELECT 
                    s.id, s.first_name, s.last_name, s.cedula, s.parent_name, s.parent_phone,
                    tp.status, tp.pending_amount, tp.amount_paid, tp.final_amount
                 FROM students s
                 LEFT JOIN tuition_payments tp ON s.id = tp.student_id AND tp.month_year = $2 AND tp.concept = 'mensualidad'
                 WHERE s.year_id = $1 AND s.status = 'active'
                 ORDER BY s.last_name, s.first_name`,
                [year_id, month]
            );

            const stats = {
                total: result.rows.length,
                paid: result.rows.filter(r => r.status === 'paid').length,
                partial: result.rows.filter(r => r.status === 'partial').length,
                pending: result.rows.filter(r => !r.status || r.status === 'pending').length,
                late: result.rows.filter(r => r.status === 'late').length
            };

            return res.json({ students: result.rows, stats });
        }

        if (path === 'reports/dashboard' && req.method === 'GET') {
            const { year_id } = query;
            
            // Estadísticas generales
            const studentsCount = await pool.query(
                'SELECT COUNT(*) as count FROM students WHERE year_id = $1 AND status = $2',
                [year_id, 'active']
            );

            const levelsCount = await pool.query(
                'SELECT COUNT(*) as count FROM levels WHERE year_id = $1 AND is_active = true',
                [year_id]
            );

            // Ingresos del mes actual
            const currentMonth = new Date().toISOString().slice(0, 7);
            const monthlyIncome = await pool.query(
                `SELECT COALESCE(SUM(amount_paid), 0) as total FROM tuition_payments 
                 WHERE month_year = $1`,
                [currentMonth]
            );

            // Deudas totales
            const debts = await pool.query(
                `SELECT 
                    COALESCE(SUM(pending_amount), 0) as tuition_debt
                 FROM tuition_payments tp
                 JOIN students s ON tp.student_id = s.id
                 WHERE s.year_id = $1 AND tp.status IN ('pending', 'partial', 'late')`,
                [year_id]
            );

            const bookDebts = await pool.query(
                `SELECT COALESCE(SUM(ba.pending_balance), 0) as book_debt
                 FROM book_assignments ba
                 JOIN students s ON ba.student_id = s.id
                 WHERE s.year_id = $1 AND ba.status != 'cancelled'`,
                [year_id]
            );

            // Alertas no leídas
            const alertsCount = await pool.query(
                'SELECT COUNT(*) as count FROM alerts WHERE is_read = false AND is_dismissed = false'
            );

            // Lista de espera
            const waitingCount = await pool.query(
                'SELECT COUNT(*) as count FROM waiting_list WHERE status = $1',
                ['waiting']
            );

            return res.json({
                students: parseInt(studentsCount.rows[0].count),
                levels: parseInt(levelsCount.rows[0].count),
                monthlyIncome: parseFloat(monthlyIncome.rows[0].total),
                tuitionDebt: parseFloat(debts.rows[0].tuition_debt),
                bookDebt: parseFloat(bookDebts.rows[0].book_debt),
                alerts: parseInt(alertsCount.rows[0].count),
                waitingList: parseInt(waitingCount.rows[0].count)
            });
        }

        // ============================================
        // WHATSAPP MESSAGES
        // ============================================
        if (path.startsWith('whatsapp-message/') && req.method === 'GET') {
            const studentId = path.split('/')[1];
            const { type, amount, concept } = query;
            
            const student = await pool.query(
                `SELECT s.*, 
                        COALESCE((SELECT SUM(pending_amount) FROM tuition_payments WHERE student_id = s.id AND status IN ('pending', 'partial', 'late')), 0) as tuition_debt,
                        COALESCE((SELECT SUM(pending_balance) FROM book_assignments WHERE student_id = s.id AND status != 'cancelled'), 0) as book_debt
                 FROM students s WHERE s.id = $1`,
                [studentId]
            );

            if (student.rows.length === 0) return sendError(res, 404, 'Estudiante no encontrado');

            const s = student.rows[0];
            const totalDebt = parseFloat(s.tuition_debt) + parseFloat(s.book_debt);
            
            let message = '';
            
            if (type === 'reminder') {
                message = `Hola ${s.parent_name || 'Sr./Sra.'}, le recordamos que ${s.first_name} ${s.last_name} tiene pendiente $${amount || totalDebt} de ${concept || 'mensualidad/libros'}. Por favor regularizar la situación. Gracias. ALEI`;
            } else if (type === 'payment') {
                message = `Hola ${s.parent_name || 'Sr./Sra.'}, confirmamos el pago de $${amount} por ${concept}. Gracias por su confianza. ALEI`;
            } else if (type === 'general') {
                message = `Hola ${s.parent_name || 'Sr./Sra.'}, le escribimos de ALEI Academia de Inglés respecto a ${s.first_name} ${s.last_name}. Por favor comunicarse. Gracias.`;
            }

            return res.json({ message, phone: s.parent_phone || s.phone_primary });
        }

        // ============================================
        // BACKUP / RESTORE
        // ============================================
        if (path.startsWith('backup/') && req.method === 'GET') {
            const entity = path.split('/')[1];
            const { year_id } = query;
            
            let data = {};
            
            switch (entity) {
                case 'students':
                    const students = await pool.query(
                        'SELECT * FROM students WHERE year_id = $1 ORDER BY numero_anual',
                        [year_id]
                    );
                    data = { students: students.rows };
                    break;
                    
                case 'books':
                    const books = await pool.query(
                        'SELECT * FROM books WHERE year_id = $1',
                        [year_id]
                    );
                    const bookAssignments = await pool.query(
                        `SELECT ba.* FROM book_assignments ba
                         JOIN students s ON ba.student_id = s.id
                         WHERE s.year_id = $1`,
                        [year_id]
                    );
                    const bookPayments = await pool.query(
                        `SELECT bp.* FROM book_payments bp
                         JOIN book_assignments ba ON bp.assignment_id = ba.id
                         JOIN students s ON ba.student_id = s.id
                         WHERE s.year_id = $1`,
                        [year_id]
                    );
                    data = { books: books.rows, book_assignments: bookAssignments.rows, book_payments: bookPayments.rows };
                    break;
                    
                case 'levels':
                    const levels = await pool.query(
                        'SELECT * FROM levels WHERE year_id = $1',
                        [year_id]
                    );
                    data = { levels: levels.rows };
                    break;
                    
                case 'payments':
                    const tuition = await pool.query(
                        `SELECT tp.* FROM tuition_payments tp
                         JOIN students s ON tp.student_id = s.id
                         WHERE s.year_id = $1`,
                        [year_id]
                    );
                    const partialPayments = await pool.query(
                        `SELECT tpp.* FROM tuition_partial_payments tpp
                         JOIN tuition_payments tp ON tpp.tuition_id = tp.id
                         JOIN students s ON tp.student_id = s.id
                         WHERE s.year_id = $1`,
                        [year_id]
                    );
                    data = { tuition_payments: tuition.rows, partial_payments: partialPayments.rows };
                    break;
                    
                case 'expenses':
                    const expenses = await pool.query(
                        'SELECT * FROM expenses WHERE year_id = $1',
                        [year_id]
                    );
                    const installments = await pool.query(
                        `SELECT ei.* FROM expense_installments ei
                         JOIN expenses e ON ei.expense_id = e.id
                         WHERE e.year_id = $1`,
                        [year_id]
                    );
                    data = { expenses: expenses.rows, installments: installments.rows };
                    break;
                    
                case 'waiting-list':
                    const waiting = await pool.query(
                        'SELECT * FROM waiting_list WHERE year_id = $1',
                        [year_id]
                    );
                    data = { waiting_list: waiting.rows };
                    break;
                    
                case 'exams':
                    const exams = await pool.query(
                        'SELECT * FROM exams WHERE year_id = $1',
                        [year_id]
                    );
                    const grades = await pool.query(
                        `SELECT eg.* FROM exam_grades eg
                         JOIN exams e ON eg.exam_id = e.id
                         WHERE e.year_id = $1`,
                        [year_id]
                    );
                    data = { exams: exams.rows, grades: grades.rows };
                    break;
                    
                case 'all':
                    const allStudents = await pool.query('SELECT * FROM students WHERE year_id = $1', [year_id]);
                    const allBooks = await pool.query('SELECT * FROM books WHERE year_id = $1', [year_id]);
                    const allLevels = await pool.query('SELECT * FROM levels WHERE year_id = $1', [year_id]);
                    const allExpenses = await pool.query('SELECT * FROM expenses WHERE year_id = $1', [year_id]);
                    const allWaiting = await pool.query('SELECT * FROM waiting_list WHERE year_id = $1', [year_id]);
                    const allExams = await pool.query('SELECT * FROM exams WHERE year_id = $1', [year_id]);
                    
                    data = {
                        students: allStudents.rows,
                        books: allBooks.rows,
                        levels: allLevels.rows,
                        expenses: allExpenses.rows,
                        waiting_list: allWaiting.rows,
                        exams: allExams.rows,
                        backup_date: new Date().toISOString(),
                        year_id
                    };
                    break;
                    
                default:
                    return sendError(res, 400, 'Entidad no válida');
            }
            
            return res.json(data);
        }

        if (path.startsWith('restore/') && req.method === 'POST') {
            const entity = path.split('/')[1];
            const body = parseBody(req);
            const { data, year_id } = body;
            
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                let parsedData;
                try {
                    parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                } catch (e) {
                    await client.query('ROLLBACK');
                    return sendError(res, 400, 'JSON inválido');
                }
                
                switch (entity) {
                    case 'students':
                        for (const student of parsedData.students || []) {
                            await client.query(
                                `INSERT INTO students (
                                    year_id, numero_anual, cedula, first_name, last_name, birth_date,
                                    email, phone_primary, phone_secondary, address,
                                    parent_name, parent_phone, parent_email, parent_relationship,
                                    level_id, enrollment_type_id, is_hermano, custom_tuition_price,
                                    enrollment_date, status
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                                ON CONFLICT (cedula) DO UPDATE SET
                                    first_name = EXCLUDED.first_name,
                                    last_name = EXCLUDED.last_name,
                                    updated_at = NOW()`,
                                [
                                    year_id, student.numero_anual, student.cedula, student.first_name, student.last_name, student.birth_date,
                                    student.email, student.phone_primary, student.phone_secondary, student.address,
                                    student.parent_name, student.parent_phone, student.parent_email, student.parent_relationship,
                                    student.level_id, student.enrollment_type_id, student.is_hermano, student.custom_tuition_price,
                                    student.enrollment_date, student.status || 'active'
                                ]
                            );
                        }
                        break;
                        
                    case 'books':
                        for (const book of parsedData.books || []) {
                            await client.query(
                                `INSERT INTO books (year_id, title, author, publisher, isbn, price, cost_price, stock, min_stock, level_id, is_active)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                                 ON CONFLICT DO NOTHING`,
                                [year_id, book.title, book.author, book.publisher, book.isbn, book.price, book.cost_price, book.stock, book.min_stock, book.level_id, book.is_active]
                            );
                        }
                        break;
                        
                    case 'levels':
                        for (const level of parsedData.levels || []) {
                            await client.query(
                                `INSERT INTO levels (year_id, name, schedule, capacity, teacher_name, classroom, is_active)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                                 ON CONFLICT DO NOTHING`,
                                [year_id, level.name, level.schedule, level.capacity, level.teacher_name, level.classroom, level.is_active]
                            );
                        }
                        break;
                        
                    case 'expenses':
                        for (const expense of parsedData.expenses || []) {
                            await client.query(
                                `INSERT INTO expenses (year_id, description, category, provider, total_amount, has_installments, installment_count, expense_date, start_date, status)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                                [year_id, expense.description, expense.category, expense.provider, expense.total_amount, expense.has_installments, expense.installment_count, expense.expense_date, expense.start_date, expense.status]
                            );
                        }
                        break;
                        
                    case 'waiting-list':
                        for (const item of parsedData.waiting_list || []) {
                            await client.query(
                                `INSERT INTO waiting_list (year_id, level_id, student_name, student_age, parent_name, phone, email, preferred_schedule, notes, priority, status)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                                [year_id, item.level_id, item.student_name, item.student_age, item.parent_name, item.phone, item.email, item.preferred_schedule, item.notes, item.priority, item.status || 'waiting']
                            );
                        }
                        break;
                        
                    case 'all':
                        // Restaurar todo
                        if (parsedData.levels) {
                            for (const level of parsedData.levels) {
                                await client.query(
                                    `INSERT INTO levels (year_id, name, schedule, capacity, teacher_name, classroom)
                                     VALUES ($1, $2, $3, $4, $5, $6)`,
                                    [year_id, level.name, level.schedule, level.capacity, level.teacher_name, level.classroom]
                                );
                            }
                        }
                        if (parsedData.students) {
                            for (const student of parsedData.students) {
                                await client.query(
                                    `INSERT INTO students (year_id, cedula, first_name, last_name, phone_primary, parent_name, parent_phone, status)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                                    [year_id, student.cedula, student.first_name, student.last_name, student.phone_primary, student.parent_name, student.parent_phone, 'active']
                                );
                            }
                        }
                        break;
                        
                    default:
                        await client.query('ROLLBACK');
                        return sendError(res, 400, 'Entidad no válida');
                }
                
                await client.query('COMMIT');
                return res.json({ success: true, message: 'Restauración completada' });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        // ============================================
        // RESET SISTEMA
        // ============================================
        if (path === 'system/reset' && req.method === 'POST') {
            const confirmHeader = req.headers['x-confirm-reset'];
            const body = parseBody(req);
            
            if (confirmHeader !== 'true' || body.confirm !== 'DELETE_ALL_DATA') {
                return sendError(res, 403, 'Confirmación requerida. Headers y body deben contener la confirmación.');
            }
            
            const { year_id } = body;
            if (!year_id) return sendError(res, 400, 'year_id requerido');
            
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // Eliminar datos del año especificado
                await client.query('DELETE FROM exam_grades WHERE exam_id IN (SELECT id FROM exams WHERE year_id = $1)', [year_id]);
                await client.query('DELETE FROM exams WHERE year_id = $1', [year_id]);
                await client.query('DELETE FROM book_payments WHERE assignment_id IN (SELECT id FROM book_assignments WHERE student_id IN (SELECT id FROM students WHERE year_id = $1))', [year_id]);
                await client.query('DELETE FROM book_assignments WHERE student_id IN (SELECT id FROM students WHERE year_id = $1)', [year_id]);
                await client.query('DELETE FROM books WHERE year_id = $1', [year_id]);
                await client.query('DELETE FROM tuition_partial_payments WHERE tuition_id IN (SELECT id FROM tuition_payments WHERE student_id IN (SELECT id FROM students WHERE year_id = $1))', [year_id]);
                await client.query('DELETE FROM tuition_payments WHERE student_id IN (SELECT id FROM students WHERE year_id = $1)', [year_id]);
                await client.query('DELETE FROM attendance WHERE level_id IN (SELECT id FROM levels WHERE year_id = $1)', [year_id]);
                await client.query('DELETE FROM students WHERE year_id = $1', [year_id]);
                await client.query('DELETE FROM levels WHERE year_id = $1', [year_id]);
                await client.query('DELETE FROM expense_installments WHERE expense_id IN (SELECT id FROM expenses WHERE year_id = $1)', [year_id]);
                await client.query('DELETE FROM expenses WHERE year_id = $1', [year_id]);
                await client.query('DELETE FROM waiting_list WHERE year_id = $1', [year_id]);
                await client.query('DELETE FROM enrollment_types WHERE year_id = $1', [year_id]);
                
                await client.query('COMMIT');
                return res.json({ success: true, message: 'Sistema reseteado correctamente' });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        // ============================================
        // CONFIGURACIÓN
        // ============================================
        if (path === 'config' && req.method === 'GET') {
            const result = await pool.query('SELECT * FROM system_config');
            return res.json(result.rows);
        }

        if (path.startsWith('config/') && req.method === 'PUT') {
            const key = path.split('/')[1];
            const body = parseBody(req);
            
            const result = await pool.query(
                'UPDATE system_config SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
                [body.value, key]
            );
            
            return res.json(result.rows[0]);
        }

        // ============================================
        // VALIDACIÓN CÉDULA
        // ============================================
        if (path === 'validate/cedula' && req.method === 'GET') {
            const { cedula, exclude_id } = query;
            
            let sql = 'SELECT id FROM students WHERE cedula = $1';
            let params = [cedula];
            
            if (exclude_id) {
                sql += ' AND id != $2';
                params.push(exclude_id);
            }
            
            const result = await pool.query(sql, params);
            
            return res.json({
                exists: result.rows.length > 0,
                available: result.rows.length === 0
            });
        }

        return sendError(res, 404, `Ruta no encontrada: ${path}`);

    } catch (error) {
        console.error('[API Error]', error);
        return sendError(res, 500, error.message);
    }
}
