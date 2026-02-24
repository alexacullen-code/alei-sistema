import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
  });
}

function getPath(req) {
  return req.url.split('?')[0].replace(/^\/api\/?/, '').replace(/\/$/, '');
}

async function listAlumnos(res, anioLectivoId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.numero_anual, a.nombre, a.cedula, a.telefono, a.edad, a.direccion,
            n.nombre AS nivel, a.fecha_inscripcion, a.tipo_matricula_id, tm.nombre AS tipo_matricula_nombre,
            a.created_at
     FROM alumnos a
     LEFT JOIN niveles n ON n.id = a.nivel_id
     LEFT JOIN tipos_matricula tm ON tm.id = a.tipo_matricula_id
     WHERE a.anio_lectivo_id = $1 AND a.activo = true
     ORDER BY a.numero_anual ASC`,
    [anioLectivoId],
  );
  send(res, 200, { alumnos: rows });
}

async function createAlumno(req, res, anioLectivoId) {
  const body = await parseBody(req);
  const {
    nombre,
    cedula,
    telefono,
    edad,
    direccion,
    nivel_id,
    tipo_matricula_id,
    fecha_inscripcion,
    es_hermano = false,
    monto_cuota_personalizado = null,
  } = body;

  if (!nombre || !cedula || !nivel_id || !tipo_matricula_id || !fecha_inscripcion) {
    return send(res, 400, { error: 'Faltan campos obligatorios de alumno.' });
  }

  const dup = await pool.query(
    'SELECT 1 FROM alumnos WHERE cedula = $1 AND anio_lectivo_id = $2 AND activo = true LIMIT 1',
    [cedula, anioLectivoId],
  );
  if (dup.rowCount) {
    return send(res, 409, { error: 'La cédula ya existe en este año lectivo.' });
  }

  const nextNumber = await pool.query(
    'SELECT COALESCE(MAX(numero_anual), 0) + 1 AS next FROM alumnos WHERE anio_lectivo_id = $1',
    [anioLectivoId],
  );

  const insert = await pool.query(
    `INSERT INTO alumnos
      (numero_anual, nombre, cedula, telefono, edad, direccion, nivel_id, tipo_matricula_id,
       fecha_inscripcion, anio_lectivo_id, es_hermano, monto_cuota_personalizado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      nextNumber.rows[0].next,
      nombre,
      cedula,
      telefono ?? null,
      edad ?? null,
      direccion ?? null,
      nivel_id,
      tipo_matricula_id,
      fecha_inscripcion,
      anioLectivoId,
      es_hermano,
      monto_cuota_personalizado,
    ],
  );

  send(res, 201, { alumno: insert.rows[0] });
}

async function listCatalogo(res, table, anioLectivoId) {
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE anio_lectivo_id = $1 ORDER BY id ASC`, [anioLectivoId]);
  send(res, 200, { data: rows });
}

async function listPagos(res, anioLectivoId) {
  const { rows } = await pool.query(
    `SELECT p.*, a.nombre AS alumno_nombre
     FROM pagos p
     LEFT JOIN alumnos a ON a.id = p.alumno_id
     WHERE p.anio_lectivo_id = $1
     ORDER BY p.fecha DESC, p.created_at DESC`,
    [anioLectivoId],
  );
  send(res, 200, { pagos: rows });
}

function calcularMontoMensualidad({ costoBase, fechaPago, mesReferencia, anioReferencia, esHermano }) {
  if (esHermano) return { monto: costoBase, regla: 'hermano_sin_ajuste' };
  const d = new Date(fechaPago);
  const dia = d.getDate();
  const mesPago = d.getMonth() + 1;
  const anioPago = d.getFullYear();
  const pagoAdelantado = anioReferencia > anioPago || (anioReferencia === anioPago && mesReferencia > mesPago);
  const pagoAtrasado = anioReferencia < anioPago || (anioReferencia === anioPago && mesReferencia < mesPago);

  if (dia <= 10 && pagoAdelantado) return { monto: costoBase - 150, regla: 'descuento_adelantado' };
  if (dia >= 16 && pagoAtrasado) return { monto: costoBase + 150, regla: 'recargo_atraso' };
  return { monto: costoBase, regla: 'precio_base' };
}

async function createPago(req, res, anioLectivoId) {
  const body = await parseBody(req);
  const {
    alumno_id,
    concepto,
    monto,
    fecha,
    mes_referencia,
    anio_referencia,
    comentarios,
  } = body;

  if (!alumno_id || !concepto || !fecha) {
    return send(res, 400, { error: 'Faltan campos obligatorios de pago.' });
  }

  let finalMonto = monto;
  let regla = 'manual';

  if (concepto === 'mensualidad' && !monto) {
    const q = await pool.query(
      `SELECT a.es_hermano, a.monto_cuota_personalizado, tm.costo_base
       FROM alumnos a
       JOIN tipos_matricula tm ON tm.id = a.tipo_matricula_id
       WHERE a.id = $1`,
      [alumno_id],
    );

    if (!q.rowCount) return send(res, 404, { error: 'Alumno no encontrado.' });
    const row = q.rows[0];
    if (row.monto_cuota_personalizado) {
      finalMonto = Number(row.monto_cuota_personalizado);
      regla = 'cuota_personalizada';
    } else {
      const calc = calcularMontoMensualidad({
        costoBase: Number(row.costo_base),
        fechaPago: fecha,
        mesReferencia: Number(mes_referencia),
        anioReferencia: Number(anio_referencia),
        esHermano: row.es_hermano,
      });
      finalMonto = calc.monto;
      regla = calc.regla;
    }
  }

  if (!finalMonto) {
    return send(res, 400, { error: 'No se pudo determinar el monto del pago.' });
  }

  const created = await pool.query(
    `INSERT INTO pagos (alumno_id, concepto, monto, monto_original, fecha, mes_referencia, anio_referencia,
                        comentarios, anio_lectivo_id, registrado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      alumno_id,
      concepto,
      finalMonto,
      finalMonto,
      fecha,
      mes_referencia ?? null,
      anio_referencia ?? null,
      comentarios ?? regla,
      anioLectivoId,
      'sistema',
    ],
  );

  send(res, 201, { pago: created.rows[0], regla });
}

async function backupExport(res, anioLectivoId, tipo) {
  const allowed = ['alumnos', 'pagos', 'libros', 'gastos'];
  const tables = tipo && allowed.includes(tipo) ? [tipo] : allowed;
  const result = {};

  for (const table of tables) {
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE anio_lectivo_id = $1`, [anioLectivoId]);
    result[table] = rows;
  }

  send(res, 200, { anio_lectivo_id: anioLectivoId, backup: result });
}

async function activeYear() {
  const q = await pool.query('SELECT id FROM anios_lectivos WHERE activo = true ORDER BY id DESC LIMIT 1');
  if (!q.rowCount) {
    throw new Error('No existe año lectivo activo. Ejecutá el schema y datos iniciales.');
  }
  return q.rows[0].id;
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return send(res, 500, { error: 'Falta DATABASE_URL en variables de entorno.' });
  }

  const path = getPath(req);

  try {
    const anioLectivoId = await activeYear();

    if (req.method === 'GET' && path === 'alumnos') return listAlumnos(res, anioLectivoId);
    if (req.method === 'POST' && path === 'alumnos') return createAlumno(req, res, anioLectivoId);

    if (req.method === 'GET' && path === 'pagos') return listPagos(res, anioLectivoId);
    if (req.method === 'POST' && path === 'pagos') return createPago(req, res, anioLectivoId);

    if (req.method === 'GET' && path === 'libros') return listCatalogo(res, 'libros', anioLectivoId);
    if (req.method === 'GET' && path === 'gastos') return listCatalogo(res, 'gastos', anioLectivoId);
    if (req.method === 'GET' && path === 'preinscripciones') return listCatalogo(res, 'preinscripciones', anioLectivoId);
    if (req.method === 'GET' && path === 'alertas') return listCatalogo(res, 'alertas', anioLectivoId);

    if (req.method === 'GET' && path === 'backup/export') {
      const url = new URL(req.url, 'http://localhost');
      return backupExport(res, anioLectivoId, url.searchParams.get('tipo'));
    }

    return send(res, 404, { error: `Ruta no encontrada: /api/${path}` });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
}
