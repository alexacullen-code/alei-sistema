import { Pool } from '@neondatabase/serverless';

// Configurar pool de conexiones
let pool = null;

try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
} catch (e) {
  console.error('Error initializing database pool:', e);
}

// ============================================
// LÓGICA DE RECARGOS/DESCUENTOS (Uruguay)
// ============================================
function calculateTuition(student, monthYear, paymentDate, baseAmount) {
  // Si es hermano, retornar precio custom sin modificaciones
  if (student.is_hermano) {
    return {
      baseAmount: student.custom_tuition_price || baseAmount,
      discountAmount: 0,
      surchargeAmount: 0,
      finalAmount: student.custom_tuition_price || baseAmount
    };
  }

  const [year, month] = monthYear.split('-').map(Number);
  const payDate = new Date(paymentDate);
  const payDay = payDate.getDate();
  const payMonth = payDate.getMonth() + 1;
  const payYear = payDate.getFullYear();
  
  const targetMonthDate = new Date(year, month - 1, 1);
  const payMonthDate = new Date(payYear, payMonth - 1, 1);
  
  const monthDiff = (targetMonthDate - payMonthDate) / (1000 * 60 * 60 * 24 * 30);
  
  let discountAmount = 0;
  let surchargeAmount = 0;
  
  if (monthDiff > 0) {
    discountAmount = 150;
  } else if (monthDiff < 0) {
    surchargeAmount = 150;
  } else {
    if (payDay <= 10) discountAmount = 150;
    else if (payDay >= 16) surchargeAmount = 150;
  }
  
  const finalAmount = baseAmount - discountAmount + surchargeAmount;
  
  return { baseAmount, discountAmount, surchargeAmount, finalAmount };
}

// ============================================
// ROUTER PRINCIPAL
// ============================================
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificar conexión a base de datos
  if (!pool) {
    return res.status(503).json({ 
      error: 'Database not configured',
      message: 'DATABASE_URL no está configurada. Por favor configura la variable de entorno en Vercel.'
    });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '');
  const queryParams = Object.fromEntries(url.searchParams);
  
  try {
    // ============ AÑOS LECTIVOS ============
    if (path === 'years' && req.method === 'GET') {
      return await getYears(req, res, pool);
    }
    if (path === 'years' && req.method === 'POST') {
      return await createYear(req, res, pool);
    }
    if (path.startsWith('years/') && path.includes('/activate') && req.method === 'PUT') {
      return await activateYear(req, res, pool);
    }
    
    // ============ ESTUDIANTES ============
    if (path === 'students' && req.method === 'GET') {
      return await getStudents(req, res, pool, queryParams);
    }
    if (path === 'students' && req.method === 'POST') {
      return await createStudent(req, res, pool);
    }
    if (path.startsWith('students/') && req.method === 'GET' && !path.includes('/full-profile') && !path.includes('/pending')) {
      return await getStudentById(req, res, pool);
    }
    if (path.startsWith('students/') && req.method === 'PUT') {
      return await updateStudent(req, res, pool);
    }
    if (path.startsWith('students/') && path.includes('/full-profile') && req.method === 'GET') {
      return await getStudentFullProfile(req, res, pool);
    }
    
    // ============ PAGOS ============
    if (path === 'payments/tuition' && req.method === 'POST') {
      return await payTuition(req, res, pool);
    }
    if (path === 'payments/books' && req.method === 'POST') {
      return await payBook(req, res, pool);
    }
    if (path === 'payments/quick' && req.method === 'POST') {
      return await quickPayment(req, res, pool);
    }
    if (path === 'payments/pending' && req.method === 'GET') {
      return await getPendingPayments(req, res, pool, queryParams);
    }
    
    // ============ LIBROS ============
    if (path === 'books' && req.method === 'GET') {
      return await getBooks(req, res, pool, queryParams);
    }
    if (path === 'books' && req.method === 'POST') {
      return await createBook(req, res, pool);
    }
    if (path === 'books/assign' && req.method === 'POST') {
      return await assignBook(req, res, pool);
    }
    if (path.startsWith('books/') && path.includes('/pending') && req.method === 'GET') {
      return await getStudentPendingBooks(req, res, pool);
    }
    
    // ============ GASTOS ============
    if (path === 'expenses' && req.method === 'GET') {
      return await getExpenses(req, res, pool, queryParams);
    }
    if (path === 'expenses' && req.method === 'POST') {
      return await createExpense(req, res, pool);
    }
    
    // ============ LISTA DE ESPERA ============
    if (path === 'waiting-list' && req.method === 'GET') {
      return await getWaitingList(req, res, pool, queryParams);
    }
    if (path === 'waiting-list' && req.method === 'POST') {
      return await addToWaitingList(req, res, pool);
    }
    if (path === 'waiting-list/convert' && req.method === 'POST') {
      return await convertWaitingToStudent(req, res, pool);
    }
    
    // ============ REPORTES ============
    if (path === 'reports/cash-flow' && req.method === 'GET') {
      return await getCashFlowReport(req, res, pool, queryParams);
    }
    if (path === 'reports/monthly-status' && req.method === 'GET') {
      return await getMonthlyStatusReport(req, res, pool, queryParams);
    }
    
    // ============ ALERTAS ============
    if (path === 'alerts' && req.method === 'GET') {
      return await getAlerts(req, res, pool, queryParams);
    }
    if (path.startsWith('alerts/') && req.method === 'PUT') {
      return await markAlertRead(req, res, pool);
    }
    
    // ============ BACKUP/RESTORE ============
    if (path.startsWith('backup/') && req.method === 'GET') {
      return await backupEntity(req, res, pool);
    }
    if (path.startsWith('restore/') && req.method === 'POST') {
      return await restoreEntity(req, res, pool);
    }
    
    // ============ SISTEMA ============
    if (path === 'system/reset' && req.method === 'POST') {
      return await resetSystem(req, res, pool);
    }
    if (path === 'system/stats' && req.method === 'GET') {
      return await getSystemStats(req, res, pool, queryParams);
    }
    
    // ============ WHATSAPP ============
    if (path.startsWith('whatsapp-message/') && req.method === 'GET') {
      return await generateWhatsAppMessage(req, res, pool);
    }
    
    // ============ TIPOS DE MATRÍCULA ============
    if (path === 'enrollment-types' && req.method === 'GET') {
      return await getEnrollmentTypes(req, res, pool, queryParams);
    }
    
    // ============ NIVELES ============
    if (path === 'levels' && req.method === 'GET') {
      return await getLevels(req, res, pool, queryParams);
    }
    if (path === 'levels' && req.method === 'POST') {
      return await createLevel(req, res, pool);
    }

    return res.status(404).json({ error: 'Not found', path });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error.message,
      detail: error.detail || 'Error interno del servidor'
    });
  }
}

// ============================================
// AÑOS LECTIVOS
// ============================================
async function getYears(req, res, pool) {
  try {
    const result = await pool.query('SELECT * FROM academic_years ORDER BY year_name DESC');
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando años', detail: error.message });
  }
}

async function createYear(req, res, pool) {
  const { year_name, start_date, end_date } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO academic_years (year_name, start_date, end_date) VALUES ($1, $2, $3) RETURNING *',
      [year_name, start_date, end_date]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error creando año', detail: error.message });
  }
}

async function activateYear(req, res, pool) {
  const yearId = req.url.split('/')[2];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE academic_years SET is_active = false');
    await client.query('UPDATE academic_years SET is_active = true WHERE id = $1', [yearId]);
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Año activado correctamente' });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error activando año', detail: e.message });
  } finally {
    client.release();
  }
}

// ============================================
// ESTUDIANTES
// ============================================
async function getStudents(req, res, pool, queryParams) {
  const { year_id, search, status } = queryParams;
  let sql = 'SELECT s.*, et.name as enrollment_type_name FROM students s LEFT JOIN enrollment_types et ON s.enrollment_type_id = et.id WHERE 1=1';
  let params = [];
  let paramIdx = 1;
  
  if (year_id) {
    sql += ` AND s.year_id = $${paramIdx++}`;
    params.push(year_id);
  }
  
  if (status) {
    sql += ` AND s.status = $${paramIdx++}`;
    params.push(status);
  }
  
  if (search) {
    sql += ` AND (s.first_name ILIKE $${paramIdx} OR s.last_name ILIKE $${paramIdx} OR s.cedula ILIKE $${paramIdx} OR s.parent_name ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
  }
  
  sql += ' ORDER BY s.created_at DESC';
  
  try {
    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando estudiantes', detail: error.message });
  }
}

async function createStudent(req, res, pool) {
  const { 
    year_id, cedula, first_name, last_name, birth_date, email,
    phone_primary, phone_secondary, parent_name, parent_phone, parent_email,
    enrollment_type_id, is_hermano, custom_tuition_price
  } = req.body;
  
  try {
    // Verificar cédula única
    const existing = await pool.query('SELECT id FROM students WHERE cedula = $1', [cedula]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un estudiante con esa cédula' });
    }
    
    const result = await pool.query(
      `INSERT INTO students (year_id, cedula, first_name, last_name, birth_date, email,
       phone_primary, phone_secondary, parent_name, parent_phone, parent_email,
       enrollment_type_id, is_hermano, custom_tuition_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [year_id, cedula, first_name, last_name, birth_date, email,
       phone_primary, phone_secondary, parent_name, parent_phone, parent_email,
       enrollment_type_id, is_hermano || false, custom_tuition_price]
    );
    
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error creando estudiante', detail: error.message });
  }
}

async function getStudentById(req, res, pool) {
  const id = req.url.split('/')[1];
  try {
    const result = await pool.query(
      'SELECT s.*, et.name as enrollment_type_name FROM students s LEFT JOIN enrollment_types et ON s.enrollment_type_id = et.id WHERE s.id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando estudiante', detail: error.message });
  }
}

async function updateStudent(req, res, pool) {
  const id = req.url.split('/')[1];
  const updates = req.body;
  
  const allowedFields = ['first_name', 'last_name', 'birth_date', 'email', 'phone_primary', 
    'phone_secondary', 'parent_name', 'parent_phone', 'parent_email', 
    'enrollment_type_id', 'is_hermano', 'custom_tuition_price', 'status'];
  
  const setClause = [];
  const values = [];
  let paramIdx = 1;
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClause.push(`${field} = $${paramIdx++}`);
      values.push(updates[field]);
    }
  }
  
  if (setClause.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }
  
  values.push(id);
  const sql = `UPDATE students SET ${setClause.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
  
  try {
    const result = await pool.query(sql, values);
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error actualizando estudiante', detail: error.message });
  }
}

async function getStudentFullProfile(req, res, pool) {
  const id = req.url.split('/')[1];
  
  try {
    const studentResult = await pool.query(
      `SELECT s.*, et.name as enrollment_type_name, ay.year_name 
       FROM students s 
       LEFT JOIN enrollment_types et ON s.enrollment_type_id = et.id
       LEFT JOIN academic_years ay ON s.year_id = ay.id
       WHERE s.id = $1`,
      [id]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    
    const student = studentResult.rows[0];
    
    const booksResult = await pool.query(
      `SELECT ba.*, b.title as book_title, b.author,
        (SELECT COALESCE(SUM(amount), 0) FROM book_payments WHERE assignment_id = ba.id) as total_paid
       FROM book_assignments ba
       JOIN books b ON ba.book_id = b.id
       WHERE ba.student_id = $1
       ORDER BY ba.assignment_date DESC`,
      [id]
    );
    
    const tuitionResult = await pool.query(
      `SELECT * FROM tuition_payments WHERE student_id = $1 ORDER BY month_year DESC, created_at DESC`,
      [id]
    );
    
    const pendingBooks = await pool.query(
      `SELECT ba.*, b.title as book_title 
       FROM book_assignments ba
       JOIN books b ON ba.book_id = b.id
       WHERE ba.student_id = $1 AND ba.pending_balance > 0`,
      [id]
    );
    
    const pendingTuition = await pool.query(
      `SELECT * FROM tuition_payments WHERE student_id = $1 AND pending_amount > 0`,
      [id]
    );
    
    return res.json({
      student,
      books: booksResult.rows,
      tuition_payments: tuitionResult.rows,
      pending_debts: { books: pendingBooks.rows, tuition: pendingTuition.rows }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando perfil', detail: error.message });
  }
}

// ============================================
// PAGOS
// ============================================
async function payTuition(req, res, pool) {
  const { student_id, concept, month_year, payment_date, amount_paid, payment_method, comment, created_by } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const studentResult = await client.query(
      'SELECT s.*, et.base_price FROM students s LEFT JOIN enrollment_types et ON s.enrollment_type_id = et.id WHERE s.id = $1',
      [student_id]
    );
    
    if (studentResult.rows.length === 0) {
      throw new Error('Estudiante no encontrado');
    }
    
    const student = studentResult.rows[0];
    const basePrice = student.base_price || 2500;
    
    const calculation = calculateTuition(student, month_year, payment_date, basePrice);
    
    const existingResult = await client.query(
      'SELECT * FROM tuition_payments WHERE student_id = $1 AND month_year = $2 AND concept = $3',
      [student_id, month_year, concept]
    );
    
    let result;
    
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      const newAmountPaid = parseFloat(existing.amount_paid) + parseFloat(amount_paid);
      const newPending = parseFloat(calculation.finalAmount) - newAmountPaid;
      
      let status = 'partial';
      if (newPending <= 0) status = 'paid';
      else if (new Date(payment_date) > new Date(existing.due_date)) status = 'late';
      
      result = await client.query(
        `UPDATE tuition_payments SET amount_paid = $1, pending_amount = $2, status = $3, payment_date = $4 WHERE id = $5 RETURNING *`,
        [newAmountPaid, Math.max(0, newPending), status, payment_date, existing.id]
      );
    } else {
      const dueDate = new Date(month_year + '-15');
      const pending = calculation.finalAmount - amount_paid;
      let status = pending <= 0 ? 'paid' : 'pending';
      
      result = await client.query(
        `INSERT INTO tuition_payments 
         (student_id, concept, month_year, base_amount, discount_amount, surcharge_amount,
          final_amount, amount_paid, pending_amount, payment_date, due_date, status, comment, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [student_id, concept, month_year, calculation.baseAmount, calculation.discountAmount,
         calculation.surchargeAmount, calculation.finalAmount, amount_paid, pending,
         payment_date, dueDate, status, comment, created_by]
      );
    }
    
    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error procesando pago', detail: e.message });
  } finally {
    client.release();
  }
}

async function payBook(req, res, pool) {
  const { assignment_id, amount, payment_method, comment, created_by } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const assignmentResult = await client.query('SELECT * FROM book_assignments WHERE id = $1', [assignment_id]);
    if (assignmentResult.rows.length === 0) {
      throw new Error('Asignación de libro no encontrada');
    }
    
    const assignment = assignmentResult.rows[0];
    const previousBalance = parseFloat(assignment.pending_balance);
    const newBalance = Math.max(0, previousBalance - parseFloat(amount));
    
    const paymentResult = await client.query(
      `INSERT INTO book_payments (assignment_id, amount, payment_method, comment, previous_balance, new_balance, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [assignment_id, amount, payment_method, comment, previousBalance, newBalance, created_by]
    );
    
    const status = newBalance <= 0 ? 'paid' : 'pending';
    await client.query('UPDATE book_assignments SET pending_balance = $1, status = $2 WHERE id = $3', [newBalance, status, assignment_id]);
    
    await client.query('COMMIT');
    return res.json(paymentResult.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error procesando pago de libro', detail: e.message });
  } finally {
    client.release();
  }
}

async function quickPayment(req, res, pool) {
  const { student_id, concept, amount, payment_method, comment } = req.body;
  
  try {
    if (concept === 'book') {
      const pendingBook = await pool.query(
        'SELECT * FROM book_assignments WHERE student_id = $1 AND pending_balance > 0 ORDER BY assignment_date LIMIT 1',
        [student_id]
      );
      
      if (pendingBook.rows.length === 0) {
        return res.status(400).json({ error: 'No hay libros pendientes de pago' });
      }
      
      req.body.assignment_id = pendingBook.rows[0].id;
      return await payBook(req, res, pool);
    } else {
      const now = new Date();
      const month_year = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      req.body.month_year = month_year;
      req.body.payment_date = now.toISOString().split('T')[0];
      req.body.concept = concept;
      
      return await payTuition(req, res, pool);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error en pago rápido', detail: error.message });
  }
}

async function getPendingPayments(req, res, pool, queryParams) {
  const { year_id } = queryParams;
  
  try {
    const tuitionResult = await pool.query(
      `SELECT tp.*, s.first_name, s.last_name, s.parent_name, s.parent_phone
       FROM tuition_payments tp
       JOIN students s ON tp.student_id = s.id
       WHERE s.year_id = $1 AND tp.pending_amount > 0
       ORDER BY tp.month_year, s.last_name`,
      [year_id]
    );
    
    const booksResult = await pool.query(
      `SELECT ba.*, b.title, s.first_name, s.last_name, s.parent_name, s.parent_phone
       FROM book_assignments ba
       JOIN books b ON ba.book_id = b.id
       JOIN students s ON ba.student_id = s.id
       WHERE s.year_id = $1 AND ba.pending_balance > 0
       ORDER BY s.last_name`,
      [year_id]
    );
    
    return res.json({ tuition: tuitionResult.rows, books: booksResult.rows });
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando pagos pendientes', detail: error.message });
  }
}

// ============================================
// LIBROS
// ============================================
async function getBooks(req, res, pool, queryParams) {
  const { year_id } = queryParams;
  let sql = 'SELECT * FROM books WHERE 1=1';
  let params = [];
  
  if (year_id) {
    sql += ' AND year_id = $1';
    params.push(year_id);
  }
  
  sql += ' AND is_active = true ORDER BY title';
  
  try {
    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando libros', detail: error.message });
  }
}

async function createBook(req, res, pool) {
  const { year_id, title, author, price, stock } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO books (year_id, title, author, price, stock) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [year_id, title, author, price, stock || 0]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error creando libro', detail: error.message });
  }
}

async function assignBook(req, res, pool) {
  const { student_id, book_id } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const bookResult = await client.query('SELECT * FROM books WHERE id = $1', [book_id]);
    if (bookResult.rows.length === 0) throw new Error('Libro no encontrado');
    
    const book = bookResult.rows[0];
    if (book.stock <= 0) throw new Error('No hay stock disponible');
    
    const assignmentResult = await client.query(
      `INSERT INTO book_assignments (student_id, book_id, total_price, pending_balance) VALUES ($1, $2, $3, $3) RETURNING *`,
      [student_id, book_id, book.price]
    );
    
    await client.query('UPDATE books SET stock = stock - 1 WHERE id = $1', [book_id]);
    await client.query('COMMIT');
    return res.json(assignmentResult.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error asignando libro', detail: e.message });
  } finally {
    client.release();
  }
}

async function getStudentPendingBooks(req, res, pool) {
  const studentId = req.url.split('/')[1];
  
  try {
    const result = await pool.query(
      `SELECT ba.*, b.title, b.author,
        (SELECT COALESCE(SUM(amount), 0) FROM book_payments WHERE assignment_id = ba.id) as total_paid
       FROM book_assignments ba
       JOIN books b ON ba.book_id = b.id
       WHERE ba.student_id = $1 AND ba.pending_balance > 0`,
      [studentId]
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando libros pendientes', detail: error.message });
  }
}

// ============================================
// GASTOS
// ============================================
async function getExpenses(req, res, pool, queryParams) {
  const { year_id } = queryParams;
  
  try {
    const result = await pool.query(
      `SELECT e.*, 
        (SELECT COUNT(*) FROM expense_installments WHERE expense_id = e.id AND is_paid = true) as paid_installments,
        (SELECT COUNT(*) FROM expense_installments WHERE expense_id = e.id) as total_installments
       FROM expenses e
       WHERE e.year_id = $1
       ORDER BY e.created_at DESC`,
      [year_id]
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando gastos', detail: error.message });
  }
}

async function createExpense(req, res, pool) {
  const { year_id, description, category, total_amount, has_installments, installment_count, start_date } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const expenseResult = await client.query(
      `INSERT INTO expenses (year_id, description, category, total_amount, has_installments, installment_count, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [year_id, description, category, total_amount, has_installments, installment_count || 1, start_date]
    );
    
    const expenseId = expenseResult.rows[0].id;
    
    if (has_installments && installment_count > 1) {
      const installmentAmount = total_amount / installment_count;
      const startDate = new Date(start_date);
      
      for (let i = 0; i < installment_count; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        await client.query(
          `INSERT INTO expense_installments (expense_id, installment_number, amount, due_date) VALUES ($1, $2, $3, $4)`,
          [expenseId, i + 1, installmentAmount, dueDate]
        );
      }
    }
    
    await client.query('COMMIT');
    return res.json(expenseResult.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error creando gasto', detail: e.message });
  } finally {
    client.release();
  }
}

// ============================================
// LISTA DE ESPERA
// ============================================
async function getWaitingList(req, res, pool, queryParams) {
  const { year_id, status } = queryParams;
  
  let sql = `SELECT w.*, l.name as level_name FROM waiting_list w LEFT JOIN levels l ON w.level_id = l.id WHERE w.year_id = $1`;
  let params = [year_id];
  
  if (status) {
    sql += ' AND w.status = $2';
    params.push(status);
  }
  
  sql += ' ORDER BY w.priority DESC, w.registration_date';
  
  try {
    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando lista de espera', detail: error.message });
  }
}

async function addToWaitingList(req, res, pool) {
  const { year_id, level_id, student_name, parent_name, phone, email, notes } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO waiting_list (year_id, level_id, student_name, parent_name, phone, email, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [year_id, level_id, student_name, parent_name, phone, email, notes]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error agregando a lista', detail: error.message });
  }
}

async function convertWaitingToStudent(req, res, pool) {
  const { waiting_id, student_data } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const waitingResult = await client.query('SELECT * FROM waiting_list WHERE id = $1', [waiting_id]);
    if (waitingResult.rows.length === 0) throw new Error('Registro no encontrado');
    
    const waiting = waitingResult.rows[0];
    
    const studentResult = await client.query(
      `INSERT INTO students (year_id, cedula, first_name, last_name, parent_name, parent_phone, parent_email, enrollment_type_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [waiting.year_id, student_data.cedula, waiting.student_name, '', 
       waiting.parent_name, waiting.phone, waiting.email, student_data.enrollment_type_id]
    );
    
    await client.query('UPDATE waiting_list SET status = $1 WHERE id = $2', ['converted', waiting_id]);
    await client.query('COMMIT');
    return res.json(studentResult.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error convirtiendo registro', detail: e.message });
  } finally {
    client.release();
  }
}

// ============================================
// REPORTES
// ============================================
async function getCashFlowReport(req, res, pool, queryParams) {
  const { year_id, month } = queryParams;
  
  try {
    const tuitionIncome = await pool.query(
      `SELECT COALESCE(SUM(amount_paid), 0) as total
       FROM tuition_payments tp
       JOIN students s ON tp.student_id = s.id
       WHERE s.year_id = $1 AND tp.month_year = $2`,
      [year_id, month]
    );
    
    const bookIncome = await pool.query(
      `SELECT COALESCE(SUM(bp.amount), 0) as total
       FROM book_payments bp
       JOIN book_assignments ba ON bp.assignment_id = ba.id
       JOIN students s ON ba.student_id = s.id
       WHERE s.year_id = $1 AND DATE_TRUNC('month', bp.payment_date) = $2::date`,
      [year_id, month + '-01']
    );
    
    const expensesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM expenses WHERE year_id = $1 AND DATE_TRUNC('month', start_date) = $2::date`,
      [year_id, month + '-01']
    );
    
    const income = {
      tuition: parseFloat(tuitionIncome.rows[0].total),
      books: parseFloat(bookIncome.rows[0].total),
      total: parseFloat(tuitionIncome.rows[0].total) + parseFloat(bookIncome.rows[0].total)
    };
    const expenses = parseFloat(expensesResult.rows[0].total);
    
    return res.json({ month, income, expenses, balance: income.total - expenses });
  } catch (error) {
    return res.status(500).json({ error: 'Error generando reporte', detail: error.message });
  }
}

async function getMonthlyStatusReport(req, res, pool, queryParams) {
  const { year_id, month } = queryParams;
  
  try {
    const result = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.parent_name, s.parent_phone,
        tp.status, tp.amount_paid, tp.pending_amount, tp.final_amount
       FROM students s
       LEFT JOIN tuition_payments tp ON s.id = tp.student_id AND tp.month_year = $2
       WHERE s.year_id = $1 AND s.status = 'active'
       ORDER BY s.last_name, s.first_name`,
      [year_id, month]
    );
    
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error generando reporte', detail: error.message });
  }
}

// ============================================
// ALERTAS
// ============================================
async function getAlerts(req, res, pool, queryParams) {
  const { year_id, unread_only } = queryParams;
  
  let sql = `SELECT a.*, s.first_name, s.last_name FROM alerts a
             JOIN students s ON a.student_id = s.id
             WHERE s.year_id = $1`;
  let params = [year_id];
  
  if (unread_only === 'true') {
    sql += ' AND a.is_read = false';
  }
  
  sql += ' ORDER BY a.created_at DESC LIMIT 50';
  
  try {
    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando alertas', detail: error.message });
  }
}

async function markAlertRead(req, res, pool) {
  const id = req.url.split('/')[1];
  
  try {
    const result = await pool.query('UPDATE alerts SET is_read = true WHERE id = $1 RETURNING *', [id]);
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error marcando alerta', detail: error.message });
  }
}

// ============================================
// BACKUP/RESTORE
// ============================================
async function backupEntity(req, res, pool) {
  const entity = req.url.split('/')[1];
  const { year_id } = req.query;
  
  const tables = {
    'students': 'students',
    'books': 'books',
    'payments': 'tuition_payments',
    'book-payments': 'book_payments',
    'expenses': 'expenses',
    'waiting-list': 'waiting_list',
    'all': null
  };
  
  if (!tables.hasOwnProperty(entity)) {
    return res.status(400).json({ error: 'Entidad no válida' });
  }
  
  try {
    const backup = {};
    
    if (entity === 'all') {
      for (const [key, table] of Object.entries(tables)) {
        if (table) {
          const result = await pool.query(`SELECT * FROM ${table}`);
          backup[key] = result.rows;
        }
      }
    } else {
      const table = tables[entity];
      let sql = `SELECT * FROM ${table}`;
      let params = [];
      
      if (year_id && table !== 'book_payments') {
        sql += ' WHERE year_id = $1';
        params.push(year_id);
      }
      
      const result = await pool.query(sql, params);
      backup[entity] = result.rows;
    }
    
    return res.json(backup);
  } catch (error) {
    return res.status(500).json({ error: 'Error generando backup', detail: error.message });
  }
}

async function restoreEntity(req, res, pool) {
  const entity = req.url.split('/')[1];
  const { data } = req.body;
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  
  const tables = {
    'students': 'students',
    'books': 'books',
    'payments': 'tuition_payments',
    'book-payments': 'book_payments',
    'expenses': 'expenses',
    'waiting-list': 'waiting_list'
  };
  
  if (!tables.hasOwnProperty(entity)) {
    return res.status(400).json({ error: 'Entidad no válida' });
  }
  
  const table = tables[entity];
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const columnsResult = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table]
    );
    
    const validColumns = columnsResult.rows.map(r => r.column_name);
    let restoredCount = 0;
    
    for (const item of data) {
      const itemColumns = Object.keys(item).filter(k => validColumns.includes(k));
      const itemValues = itemColumns.map(c => item[c]);
      
      if (itemColumns.length === 0) continue;
      
      const columnsStr = itemColumns.join(', ');
      const placeholders = itemColumns.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO ${table} (${columnsStr}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        itemValues
      );
      
      restoredCount++;
    }
    
    await client.query('COMMIT');
    return res.json({ success: true, restored: restoredCount });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error restaurando datos', detail: e.message });
  } finally {
    client.release();
  }
}

// ============================================
// SISTEMA
// ============================================
async function resetSystem(req, res, pool) {
  const confirmHeader = req.headers['x-confirm-reset'];
  const { confirm } = req.body;
  
  if (confirmHeader !== 'true' || confirm !== 'DELETE_ALL_DATA') {
    return res.status(400).json({ 
      error: 'Confirmación requerida',
      message: 'Debe incluir header X-Confirm-Reset: true y body {confirm: "DELETE_ALL_DATA"}'
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query('DELETE FROM book_payments');
    await client.query('DELETE FROM book_assignments');
    await client.query('DELETE FROM tuition_payments');
    await client.query('DELETE FROM expense_installments');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM waiting_list');
    await client.query('DELETE FROM alerts');
    await client.query('DELETE FROM audit_logs');
    await client.query('DELETE FROM students');
    await client.query('DELETE FROM books');
    await client.query('DELETE FROM levels');
    await client.query('DELETE FROM enrollment_types');
    await client.query('DELETE FROM academic_years');
    
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Sistema reseteado completamente' });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error reseteando sistema', detail: e.message });
  } finally {
    client.release();
  }
}

async function getSystemStats(req, res, pool, queryParams) {
  const { year_id } = queryParams;
  
  try {
    const studentsResult = await pool.query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as active FROM students WHERE year_id = $2',
      ['active', year_id]
    );
    
    const todayIncome = await pool.query(
      `SELECT COALESCE(SUM(amount_paid), 0) as tuition,
        (SELECT COALESCE(SUM(amount), 0) FROM book_payments WHERE DATE(payment_date) = CURRENT_DATE) as books
       FROM tuition_payments WHERE DATE(payment_date) = CURRENT_DATE`
    );
    
    const debtsResult = await pool.query(
      `SELECT 
        (SELECT COALESCE(SUM(pending_amount), 0) FROM tuition_payments tp JOIN students s ON tp.student_id = s.id WHERE s.year_id = $1) as tuition_debt,
        (SELECT COALESCE(SUM(pending_balance), 0) FROM book_assignments ba JOIN students s ON ba.student_id = s.id WHERE s.year_id = $1) as books_debt`,
      [year_id]
    );
    
    const alertsResult = await pool.query(
      `SELECT COUNT(*) as total FROM alerts a JOIN students s ON a.student_id = s.id WHERE s.year_id = $1 AND a.is_read = false`,
      [year_id]
    );
    
    return res.json({
      students: studentsResult.rows[0],
      today_income: todayIncome.rows[0],
      pending_debts: debtsResult.rows[0],
      unread_alerts: parseInt(alertsResult.rows[0].total)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando estadísticas', detail: error.message });
  }
}

// ============================================
// WHATSAPP
// ============================================
async function generateWhatsAppMessage(req, res, pool) {
  const studentId = req.url.split('/')[1];
  const { concept, amount } = req.query;
  
  try {
    const studentResult = await pool.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    
    const student = studentResult.rows[0];
    const now = new Date();
    const limitDate = new Date(now.getFullYear(), now.getMonth(), 15);
    
    const message = `Hola ${student.parent_name || 'Sr./Sra.'}, le recordamos que ${student.first_name} ${student.last_name} tiene pendiente $${amount} de ${concept}. Fecha límite: ${limitDate.toLocaleDateString('es-UY')}. Gracias.`;
    
    return res.json({ message, phone: student.parent_phone });
  } catch (error) {
    return res.status(500).json({ error: 'Error generando mensaje', detail: error.message });
  }
}

// ============================================
// TIPOS DE MATRÍCULA
// ============================================
async function getEnrollmentTypes(req, res, pool, queryParams) {
  const { year_id } = queryParams;
  
  try {
    const result = await pool.query('SELECT * FROM enrollment_types WHERE year_id = $1 ORDER BY base_price', [year_id]);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando tipos', detail: error.message });
  }
}

// ============================================
// NIVELES
// ============================================
async function getLevels(req, res, pool, queryParams) {
  const { year_id } = queryParams;
  
  try {
    const result = await pool.query('SELECT * FROM levels WHERE year_id = $1 ORDER BY name', [year_id]);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error cargando niveles', detail: error.message });
  }
}

async function createLevel(req, res, pool) {
  const { year_id, name, schedule, capacity, teacher_name } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO levels (year_id, name, schedule, capacity, teacher_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [year_id, name, schedule, capacity, teacher_name]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Error creando nivel', detail: error.message });
  }
}
