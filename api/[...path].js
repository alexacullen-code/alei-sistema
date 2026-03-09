import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const IMPORT_TABLES = ['alumnos', 'pagos', 'libros', 'gastos', 'preinscripciones', 'alertas'];

const TABLES = {
  alumnos: {
    pk: 'id',
    select: `
      SELECT a.id, a.numero_anual, a.nombre, a.cedula, a.telefono, a.edad, a.direccion,
             a.nivel_id, n.nombre AS nivel, a.tipo_matricula_id, tm.nombre AS tipo_matricula_nombre,
             a.fecha_inscripcion, a.es_hermano, a.monto_cuota_personalizado, a.created_at
      FROM alumnos a
      LEFT JOIN niveles n ON n.id = a.nivel_id
      LEFT JOIN tipos_matricula tm ON tm.id = a.tipo_matricula_id
      WHERE a.anio_lectivo_id = $1 AND a.activo = true
      ORDER BY a.numero_anual ASC
    `,
  },
  pagos: {
    pk: 'id',
    select: `
      SELECT p.*, a.nombre AS alumno_nombre
      FROM pagos p
      LEFT JOIN alumnos a ON a.id = p.alumno_id
      WHERE p.anio_lectivo_id = $1
      ORDER BY p.fecha DESC, p.created_at DESC
    `,
  },
  libros: { pk: 'id', select: 'SELECT * FROM libros WHERE anio_lectivo_id = $1 ORDER BY created_at DESC NULLS LAST, titulo ASC' },
  gastos: { pk: 'id', select: 'SELECT * FROM gastos WHERE anio_lectivo_id = $1 ORDER BY fecha DESC, id DESC' },
  preinscripciones: { pk: 'id', select: 'SELECT * FROM preinscripciones WHERE anio_lectivo_id = $1 ORDER BY id DESC' },
  alertas: { pk: 'id', select: 'SELECT * FROM alertas WHERE anio_lectivo_id = $1 ORDER BY created_at DESC' },
};

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getPath(req) {
  return req.url.split('?')[0].replace(/^\/api\/?/, '').replace(/\/$/, '');
}

function getUrl(req) {
  return new URL(req.url, 'http://localhost');
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido en body.'));
      }
    });
  });
}

async function getAnioLectivoMeta() {
  const cols = await getTableColumns('anios_lectivos');
  const labelCol = cols.has('nombre') ? 'nombre' : cols.has('anio') ? 'anio' : cols.has('year') ? 'year' : null;
  const activeCol = cols.has('activo') ? 'activo' : cols.has('is_active') ? 'is_active' : null;
  return { cols, labelCol, activeCol };
}

async function activeYearOrNull() {
  const meta = await getAnioLectivoMeta();
  let sql = 'SELECT * FROM anios_lectivos';

  if (meta.activeCol) {
    sql += ` WHERE ${meta.activeCol} = true ORDER BY id DESC LIMIT 1`;
  } else {
    sql += ' ORDER BY id DESC LIMIT 1';
  }

  const q = await pool.query(sql);
  if (!q.rowCount) return null;
  const row = q.rows[0];
  return {
    ...row,
    nombre: row.nombre ?? row.anio ?? row.year ?? String(row.id),
  };
}

async function activeYearId() {
  const row = await activeYearOrNull();
  if (!row) throw new Error('No existe año lectivo activo.');
  return row;
}

async function ensureActiveYearForImport() {
  const current = await activeYearOrNull();
  if (current) return current;

  const meta = await getAnioLectivoMeta();
  if (!meta.labelCol) {
    throw new Error('No se encontró columna de nombre de año lectivo (nombre/anio/year).');
  }

  const yearName = String(new Date().getFullYear());

  if (meta.activeCol) {
    await pool.query(`UPDATE anios_lectivos SET ${meta.activeCol} = false WHERE ${meta.activeCol} = true`);
  }

  const existing = await pool.query(
    `SELECT * FROM anios_lectivos WHERE ${meta.labelCol} = $1 ORDER BY id DESC LIMIT 1`,
    [yearName],
  );

  if (existing.rowCount) {
    let row = existing.rows[0];
    if (meta.activeCol) {
      const updated = await pool.query(
        `UPDATE anios_lectivos SET ${meta.activeCol} = true WHERE id = $1 RETURNING *`,
        [row.id],
      );
      row = updated.rows[0];
    }

    return {
      ...row,
      nombre: row.nombre ?? row.anio ?? row.year ?? String(row.id),
    };
  }

  const insertCols = [];
  const insertValues = [];

  if (meta.cols.has('nombre')) {
    insertCols.push('nombre');
    insertValues.push(yearName);
  }
  if (meta.cols.has('anio')) {
    insertCols.push('anio');
    insertValues.push(Number(yearName));
  }
  if (meta.cols.has('year')) {
    insertCols.push('year');
    insertValues.push(Number(yearName));
  }
  if (meta.activeCol) {
    insertCols.push(meta.activeCol);
    insertValues.push(true);
  }

  if (!insertCols.length) {
    throw new Error('No se pudieron determinar columnas para crear anio_lectivo.');
  }

  const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
  const q = await pool.query(
    `INSERT INTO anios_lectivos (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    insertValues,
  );

  const row = q.rows[0];
  return {
    ...row,
    nombre: row.nombre ?? row.anio ?? row.year ?? String(row.id),
  };
}

async function listByTable(res, table, anioLectivoId) {
  if (table === 'alumnos') {
    const nivelCol = await getLabelColumn('niveles');
    const tipoCol = await getLabelColumn('tipos_matricula');

    const nivelExpr = nivelCol ? `n.${nivelCol}` : 'NULL';
    const tipoExpr = tipoCol ? `tm.${tipoCol}` : 'NULL';

    const query = `
      SELECT a.id, a.numero_anual, a.nombre, a.cedula, a.telefono, a.edad, a.direccion,
             a.nivel_id, ${nivelExpr} AS nivel, a.tipo_matricula_id,
             ${tipoExpr} AS tipo_matricula_nombre,
             a.fecha_inscripcion, a.es_hermano, a.monto_cuota_personalizado, a.created_at
      FROM alumnos a
      LEFT JOIN niveles n ON n.id = a.nivel_id
      LEFT JOIN tipos_matricula tm ON tm.id = a.tipo_matricula_id
      WHERE a.anio_lectivo_id = $1 AND a.activo = true
      ORDER BY a.numero_anual ASC
    `;

    const { rows } = await pool.query(query, [anioLectivoId]);
    return send(res, 200, { data: rows });
  }

  const { rows } = await pool.query(TABLES[table].select, [anioLectivoId]);
  send(res, 200, { data: rows });
}

async function createAlumno(req, res, anioLectivoId) {
  const body = await parseBody(req);
  const required = ['nombre', 'cedula', 'nivel_id', 'tipo_matricula_id', 'fecha_inscripcion'];
  const missing = required.filter((field) => !body[field]);
  if (missing.length) return send(res, 400, { error: `Campos obligatorios faltantes: ${missing.join(', ')}` });

  const exists = await pool.query(
    'SELECT 1 FROM alumnos WHERE cedula = $1 AND anio_lectivo_id = $2 AND activo = true LIMIT 1',
    [body.cedula, anioLectivoId],
  );
  if (exists.rowCount) return send(res, 409, { error: 'La cédula ya existe para este año lectivo.' });

  const next = await pool.query('SELECT COALESCE(MAX(numero_anual),0)+1 AS next FROM alumnos WHERE anio_lectivo_id = $1', [anioLectivoId]);
  const insert = await pool.query(
    `INSERT INTO alumnos (
      numero_anual, nombre, cedula, telefono, telefono_alt, email, edad, direccion,
      nombre_tutor, telefono_tutor, nivel_id, tipo_matricula_id, fecha_inscripcion,
      anio_lectivo_id, es_hermano, monto_cuota_personalizado
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    ) RETURNING *`,
    [
      next.rows[0].next,
      body.nombre,
      body.cedula,
      body.telefono ?? null,
      body.telefono_alt ?? null,
      body.email ?? null,
      toNumber(body.edad),
      body.direccion ?? null,
      body.nombre_tutor ?? null,
      body.telefono_tutor ?? null,
      toNumber(body.nivel_id),
      toNumber(body.tipo_matricula_id),
      body.fecha_inscripcion,
      anioLectivoId,
      Boolean(body.es_hermano),
      toNumber(body.monto_cuota_personalizado),
    ],
  );

  send(res, 201, { data: insert.rows[0] });
}

function calcularMensualidad({ costoBase, fechaPago, mesReferencia, anioReferencia, esHermano }) {
  if (esHermano) return { monto: costoBase, regla: 'hermano_sin_ajuste' };
  const pago = new Date(fechaPago);
  const dia = pago.getDate();
  const mesPago = pago.getMonth() + 1;
  const anioPago = pago.getFullYear();

  const adelantado = anioReferencia > anioPago || (anioReferencia === anioPago && mesReferencia > mesPago);
  const atrasado = anioReferencia < anioPago || (anioReferencia === anioPago && mesReferencia < mesPago);

  if (dia <= 10 && adelantado) return { monto: costoBase - 150, regla: 'descuento_adelantado' };
  if (dia >= 16 && atrasado) return { monto: costoBase + 150, regla: 'recargo_atrasado' };
  return { monto: costoBase, regla: 'precio_base' };
}

async function createPago(req, res, anioLectivoId) {
  const body = await parseBody(req);
  if (!body.alumno_id || !body.concepto || !body.fecha) {
    return send(res, 400, { error: 'alumno_id, concepto y fecha son obligatorios.' });
  }

  let montoFinal = toNumber(body.monto);
  let regla = 'manual';

  if (body.concepto === 'mensualidad' && !montoFinal) {
    const q = await pool.query(
      `SELECT a.es_hermano, a.monto_cuota_personalizado, tm.costo_base
       FROM alumnos a
       JOIN tipos_matricula tm ON tm.id = a.tipo_matricula_id
       WHERE a.id = $1`,
      [body.alumno_id],
    );
    if (!q.rowCount) return send(res, 404, { error: 'Alumno no encontrado.' });

    const alumno = q.rows[0];
    if (alumno.monto_cuota_personalizado) {
      montoFinal = Number(alumno.monto_cuota_personalizado);
      regla = 'cuota_personalizada';
    } else {
      const calc = calcularMensualidad({
        costoBase: Number(alumno.costo_base),
        fechaPago: body.fecha,
        mesReferencia: toNumber(body.mes_referencia),
        anioReferencia: toNumber(body.anio_referencia),
        esHermano: alumno.es_hermano,
      });
      montoFinal = calc.monto;
      regla = calc.regla;
    }
  }

  if (!montoFinal) return send(res, 400, { error: 'No se pudo determinar monto final.' });

  const insert = await pool.query(
    `INSERT INTO pagos (
      alumno_id, concepto, monto, monto_original, fecha,
      mes_referencia, anio_referencia, comentarios,
      es_recargo, es_descuento, anio_lectivo_id, registrado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [
      body.alumno_id,
      body.concepto,
      montoFinal,
      montoFinal,
      body.fecha,
      toNumber(body.mes_referencia),
      toNumber(body.anio_referencia),
      body.comentarios ?? regla,
      regla.includes('recargo'),
      regla.includes('descuento'),
      anioLectivoId,
      body.registrado_por ?? 'sistema',
    ],
  );

  send(res, 201, { data: insert.rows[0], regla });
}

async function createLibro(req, res, anioLectivoId) {
  const b = await parseBody(req);
  if (!b.alumno_id || !b.titulo || !toNumber(b.costo_total)) {
    return send(res, 400, { error: 'alumno_id, titulo y costo_total son obligatorios.' });
  }
  const costoTotal = toNumber(b.costo_total);
  const pagado = toNumber(b.pagado) ?? 0;
  const saldo = Math.max(costoTotal - pagado, 0);
  const estado = saldo === 0 ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente';

  const q = await pool.query(
    `INSERT INTO libros (alumno_id, titulo, costo_total, pagado, saldo, observaciones, estado, pagos_json, anio_lectivo_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [b.alumno_id, b.titulo, costoTotal, pagado, saldo, b.observaciones ?? null, estado, JSON.stringify([]), anioLectivoId],
  );
  send(res, 201, { data: q.rows[0] });
}

async function createGasto(req, res, anioLectivoId) {
  const b = await parseBody(req);
  if (!b.concepto || !toNumber(b.monto_total) || !b.fecha) {
    return send(res, 400, { error: 'concepto, monto_total y fecha son obligatorios.' });
  }
  const total = toNumber(b.monto_total);
  const pagado = toNumber(b.monto_pagado) ?? 0;
  const saldo = Math.max(total - pagado, 0);

  const q = await pool.query(
    `INSERT INTO gastos (
      concepto, monto_total, monto_pagado, saldo, fecha,
      es_cuota, cuotas_total, cuotas_pagadas, observaciones, categoria, anio_lectivo_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`,
    [
      b.concepto,
      total,
      pagado,
      saldo,
      b.fecha,
      Boolean(b.es_cuota),
      toNumber(b.cuotas_total),
      toNumber(b.cuotas_pagadas),
      b.observaciones ?? null,
      b.categoria ?? 'otro',
      anioLectivoId,
    ],
  );
  send(res, 201, { data: q.rows[0] });
}

async function createSimple(req, res, table, anioLectivoId) {
  const b = await parseBody(req);
  if (table === 'preinscripciones' && !b.nombre_interesado) return send(res, 400, { error: 'nombre_interesado es obligatorio.' });
  if (table === 'alertas' && !b.tipo) return send(res, 400, { error: 'tipo es obligatorio.' });

  if (table === 'preinscripciones') {
    const q = await pool.query(
      `INSERT INTO preinscripciones (
        nombre_interesado, telefono, email, nivel_interesado, fecha_contacto,
        estado, fecha_conversion, alumno_id_convertido, anio_lectivo_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        b.nombre_interesado,
        b.telefono ?? null,
        b.email ?? null,
        b.nivel_interesado ?? null,
        b.fecha_contacto ?? null,
        b.estado ?? 'pendiente',
        b.fecha_conversion ?? null,
        b.alumno_id_convertido ?? null,
        anioLectivoId,
      ],
    );
    return send(res, 201, { data: q.rows[0] });
  }

  const q = await pool.query(
    `INSERT INTO alertas (tipo, alumno_id, mensaje, fecha_alerta, leida, anio_lectivo_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [b.tipo, b.alumno_id ?? null, b.mensaje ?? null, b.fecha_alerta ?? null, Boolean(b.leida), anioLectivoId],
  );

  return send(res, 201, { data: q.rows[0] });
}

async function updateById(req, res, table) {
  const url = getUrl(req);
  const id = url.searchParams.get('id');
  if (!id) return send(res, 400, { error: 'Falta query param id.' });
  const body = await parseBody(req);
  const keys = Object.keys(body);
  if (!keys.length) return send(res, 400, { error: 'No hay campos para actualizar.' });

  const allowed = keys.filter((k) => k !== 'id' && k !== 'anio_lectivo_id' && k !== 'created_at');
  if (!allowed.length) return send(res, 400, { error: 'No hay campos válidos para actualizar.' });

  const sets = allowed.map((k, idx) => `${k} = $${idx + 1}`);
  const values = allowed.map((k) => body[k]);
  values.push(id);

  const q = await pool.query(
    `UPDATE ${table} SET ${sets.join(', ')} WHERE ${TABLES[table].pk} = $${values.length} RETURNING *`,
    values,
  );

  if (!q.rowCount) return send(res, 404, { error: 'Registro no encontrado.' });
  return send(res, 200, { data: q.rows[0] });
}

async function deleteById(req, res, table) {
  const url = getUrl(req);
  const id = url.searchParams.get('id');
  if (!id) return send(res, 400, { error: 'Falta query param id.' });

  if (table === 'alumnos') {
    const q = await pool.query('UPDATE alumnos SET activo = false WHERE id = $1 RETURNING id', [id]);
    if (!q.rowCount) return send(res, 404, { error: 'Alumno no encontrado.' });
    return send(res, 200, { ok: true, soft_delete: true });
  }

  const q = await pool.query(`DELETE FROM ${table} WHERE ${TABLES[table].pk} = $1 RETURNING ${TABLES[table].pk}`, [id]);
  if (!q.rowCount) return send(res, 404, { error: 'Registro no encontrado.' });
  return send(res, 200, { ok: true });
}

async function reporteMensualidades(res, anioLectivoId, url) {
  const mes = toNumber(url.searchParams.get('mes'));
  const anio = toNumber(url.searchParams.get('anio'));
  if (!mes || !anio) return send(res, 400, { error: 'mes y anio son obligatorios.' });

  const pagos = await pool.query(
    `SELECT a.id AS alumno_id, a.nombre, a.cedula,
            COALESCE(SUM(p.monto), 0) AS total_pagado
     FROM alumnos a
     LEFT JOIN pagos p
       ON p.alumno_id = a.id
      AND p.concepto = 'mensualidad'
      AND p.mes_referencia = $2
      AND p.anio_referencia = $3
      AND p.anio_lectivo_id = $1
     WHERE a.anio_lectivo_id = $1 AND a.activo = true
     GROUP BY a.id, a.nombre, a.cedula
     ORDER BY a.nombre`,
    [anioLectivoId, mes, anio],
  );

  const resumen = pagos.rows.map((r) => ({ ...r, estado: Number(r.total_pagado) > 0 ? 'pagó' : 'debe' }));
  send(res, 200, { mes, anio, resumen });
}

async function reporteFlujoCaja(res, anioLectivoId, url) {
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');
  if (!desde || !hasta) return send(res, 400, { error: 'desde y hasta son obligatorios (YYYY-MM-DD).' });

  const ingresos = await pool.query(
    `SELECT COALESCE(SUM(monto),0) AS total_ingresos
     FROM pagos
     WHERE anio_lectivo_id = $1 AND fecha BETWEEN $2 AND $3`,
    [anioLectivoId, desde, hasta],
  );

  const gastos = await pool.query(
    `SELECT COALESCE(SUM(monto_pagado),0) AS total_gastos
     FROM gastos
     WHERE anio_lectivo_id = $1 AND fecha BETWEEN $2 AND $3`,
    [anioLectivoId, desde, hasta],
  );

  const totalIngresos = Number(ingresos.rows[0].total_ingresos);
  const totalGastos = Number(gastos.rows[0].total_gastos);

  send(res, 200, {
    desde,
    hasta,
    total_ingresos: totalIngresos,
    total_gastos: totalGastos,
    balance: totalIngresos - totalGastos,
  });
}
async function reporteMateriales(res, anioLectivoId) {
  const q = await pool.query(
    `SELECT l.id, l.titulo, l.costo_total, l.pagado, l.saldo, l.estado,
            a.nombre AS alumno_nombre
     FROM libros l
     LEFT JOIN alumnos a ON a.id = l.alumno_id
     WHERE l.anio_lectivo_id = $1
     ORDER BY l.estado ASC, l.saldo DESC, l.titulo ASC`,
    [anioLectivoId],
  );

  const resumen = q.rows.reduce(
    (acc, r) => {
      acc.total_materiales += 1;
      acc.total_costo += Number(r.costo_total || 0);
      acc.total_pagado += Number(r.pagado || 0);
      acc.total_saldo += Number(r.saldo || 0);
      return acc;
    },
    { total_materiales: 0, total_costo: 0, total_pagado: 0, total_saldo: 0 },
  );

  send(res, 200, { resumen, materiales: q.rows });
}

async function reporteGastosCategoria(res, anioLectivoId, url) {
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');

  const filtros = ['anio_lectivo_id = $1'];
  const params = [anioLectivoId];
  if (desde && hasta) {
    filtros.push(`fecha BETWEEN $${params.length + 1} AND $${params.length + 2}`);
    params.push(desde, hasta);
  }

  const q = await pool.query(
    `SELECT COALESCE(categoria, 'sin_categoria') AS categoria,
            COUNT(*) AS cantidad,
            COALESCE(SUM(monto_total),0) AS total,
            COALESCE(SUM(monto_pagado),0) AS total_pagado,
            COALESCE(SUM(saldo),0) AS total_saldo
     FROM gastos
     WHERE ${filtros.join(' AND ')}
     GROUP BY COALESCE(categoria, 'sin_categoria')
     ORDER BY total DESC`,
    params,
  );

  send(res, 200, { desde, hasta, categorias: q.rows });
}

async function reporteDeudores(res, anioLectivoId) {
  const q = await pool.query(
    `SELECT a.id, a.nombre, a.cedula,
            COALESCE(SUM(l.saldo),0) AS saldo_libros,
            COALESCE(SUM(CASE WHEN p.id IS NULL THEN tm.costo_base ELSE 0 END),0) AS deuda_mensual_estimada
     FROM alumnos a
     LEFT JOIN libros l ON l.alumno_id = a.id AND l.anio_lectivo_id = $1
     LEFT JOIN tipos_matricula tm ON tm.id = a.tipo_matricula_id
     LEFT JOIN pagos p ON p.alumno_id = a.id AND p.anio_lectivo_id = $1 AND p.concepto = 'mensualidad'
     WHERE a.anio_lectivo_id = $1 AND a.activo = true
     GROUP BY a.id, a.nombre, a.cedula
     HAVING COALESCE(SUM(l.saldo),0) > 0 OR COALESCE(SUM(CASE WHEN p.id IS NULL THEN tm.costo_base ELSE 0 END),0) > 0
     ORDER BY saldo_libros DESC, deuda_mensual_estimada DESC, a.nombre ASC`,
    [anioLectivoId],
  );

  send(res, 200, { deudores: q.rows });
}

async function reportePreinscripciones(res, anioLectivoId) {
  const q = await pool.query(
    `SELECT estado, COUNT(*) AS cantidad
     FROM preinscripciones
     WHERE anio_lectivo_id = $1
     GROUP BY estado
     ORDER BY cantidad DESC`,
    [anioLectivoId],
  );

  const total = q.rows.reduce((a, r) => a + Number(r.cantidad), 0);
  const convertidos = q.rows.find((r) => String(r.estado).toLowerCase() === 'convertido');
  const conversion = total ? (Number(convertidos?.cantidad || 0) / total) * 100 : 0;

  send(res, 200, { total, tasa_conversion: Number(conversion.toFixed(2)), por_estado: q.rows });
}

async function backupExport(res, anioLectivoId, url) {
  const tipo = url.searchParams.get('tipo');
  const tables = tipo && IMPORT_TABLES.includes(tipo) ? [tipo] : IMPORT_TABLES;
  const backup = {};

  for (const table of tables) {
    const q = await pool.query(`SELECT * FROM ${table} WHERE anio_lectivo_id = $1`, [anioLectivoId]);
    backup[table] = q.rows;
  }

  send(res, 200, { anio_lectivo_id: anioLectivoId, backup });
}

async function getTableColumns(table) {
  const q = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Set(q.rows.map((r) => r.column_name));
}

async function getLabelColumn(table) {
  const cols = await getTableColumns(table);
  if (cols.has('nombre')) return 'nombre';
  if (cols.has('descripcion')) return 'descripcion';
  if (cols.has('name')) return 'name';
  return null;
}

async function getNameToIdMap(table, anioLectivoId) {
  const cols = await getTableColumns(table);
  if (!cols.has('id')) return new Map();

  const where = cols.has('anio_lectivo_id') ? 'WHERE anio_lectivo_id = $1' : '';
  const params = cols.has('anio_lectivo_id') ? [anioLectivoId] : [];
  const q = await pool.query(`SELECT * FROM ${table} ${where}`, params);

  const map = new Map();
  for (const row of q.rows) {
    const label = row.nombre ?? row.descripcion ?? row.name;
    const key = String(label || '').trim().toLowerCase();
    if (key) map.set(key, row.id);
  }

  return map;
}

async function getValidIdSet(table, anioLectivoId) {
  const cols = await getTableColumns(table);
  if (!cols.has('id') || !cols.has('anio_lectivo_id')) return new Set();

  const q = await pool.query(`SELECT id FROM ${table} WHERE anio_lectivo_id = $1`, [anioLectivoId]);
  return new Set(q.rows.map((r) => Number(r.id)));
}

async function nextNumeroAnual(anioLectivoId) {
  const q = await pool.query('SELECT COALESCE(MAX(numero_anual),0)+1 AS next FROM alumnos WHERE anio_lectivo_id = $1', [anioLectivoId]);
  return Number(q.rows[0].next);
}

function sanitizeImportRow(table, raw, anioLectivoId, nameMaps, validIds) {
  const row = { ...raw };

  if (table === 'alumnos') {
    if (!row.nivel_id && row.nivel) {
      row.nivel_id = nameMaps.niveles.get(String(row.nivel).trim().toLowerCase()) ?? null;
    }
    if (!row.tipo_matricula_id && row.tipo_matricula_nombre) {
      row.tipo_matricula_id = nameMaps.tipos.get(String(row.tipo_matricula_nombre).trim().toLowerCase()) ?? null;
    }

    const nivelId = toNumber(row.nivel_id);
    const tipoId = toNumber(row.tipo_matricula_id);
    if (nivelId && !validIds.niveles.has(nivelId)) row.nivel_id = null;
    if (tipoId && !validIds.tipos.has(tipoId)) row.tipo_matricula_id = null;
  }

  row.anio_lectivo_id = anioLectivoId;
  return row;
}

async function insertImportRow(table, row, colsSet, anioLectivoId) {
  const rowData = { ...row };

  if (table === 'alumnos' && colsSet.has('numero_anual') && !toNumber(rowData.numero_anual)) {
    rowData.numero_anual = await nextNumeroAnual(anioLectivoId);
  }

  const candidates = Object.keys(rowData).filter(
    (k) => colsSet.has(k) && k !== 'id' && k !== 'created_at' && k !== 'modified_at',
  );

  if (!candidates.length) return;

  const placeholders = candidates.map((_, i) => `$${i + 1}`).join(',');
  const values = candidates.map((k) => rowData[k]);

  await pool.query(
    `INSERT INTO ${table} (${candidates.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
    values,
  );
}

async function backupPreview(req, res, anioLectivoId) {
  const body = await parseBody(req);
  const payload = body.backup;
  if (!payload || typeof payload !== 'object') return send(res, 400, { error: 'backup inválido.' });

  const summary = {};
  const tableColumns = {};
  for (const t of IMPORT_TABLES) tableColumns[t] = await getTableColumns(t);

  const nameMaps = {
    niveles: await getNameToIdMap('niveles', anioLectivoId),
    tipos: await getNameToIdMap('tipos_matricula', anioLectivoId),
  };
  const validIds = {
    niveles: await getValidIdSet('niveles', anioLectivoId),
    tipos: await getValidIdSet('tipos_matricula', anioLectivoId),
  };

  for (const t of IMPORT_TABLES) {
    const rows = Array.isArray(payload[t]) ? payload[t] : [];
    let withMappableFields = 0;
    let totalMissingInSchema = 0;

    for (const raw of rows) {
      const normalized = sanitizeImportRow(t, raw, anioLectivoId, nameMaps, validIds);
      const keys = Object.keys(normalized).filter((k) => k !== 'id' && k !== 'created_at' && k !== 'modified_at');
      const validKeys = keys.filter((k) => tableColumns[t].has(k));
      const missingKeys = keys.filter((k) => !tableColumns[t].has(k));
      if (validKeys.length > 0) withMappableFields += 1;
      totalMissingInSchema += missingKeys.length;
    }

    summary[t] = {
      registros_en_archivo: rows.length,
      registros_con_campos_insertables: withMappableFields,
      columnas_no_encontradas_en_schema: totalMissingInSchema,
    };
  }

  send(res, 200, { anio_lectivo_id: anioLectivoId, preview: summary });
}

async function backupImport(req, res, anioLectivoId) {
  const body = await parseBody(req);
  const modo = body.modo || 'fusion';
  const payload = body.backup;
  if (!payload || typeof payload !== 'object') return send(res, 400, { error: 'backup inválido.' });

  const tables = IMPORT_TABLES;

  await pool.query('BEGIN');
  try {
    const tableColumns = {};
    for (const t of tables) tableColumns[t] = await getTableColumns(t);

    const nameMaps = {
      niveles: await getNameToIdMap('niveles', anioLectivoId),
      tipos: await getNameToIdMap('tipos_matricula', anioLectivoId),
    };
    const validIds = {
      niveles: await getValidIdSet('niveles', anioLectivoId),
      tipos: await getValidIdSet('tipos_matricula', anioLectivoId),
    };

    if (modo === 'reemplazo_total') {
      for (const t of tables) await pool.query(`DELETE FROM ${t} WHERE anio_lectivo_id = $1`, [anioLectivoId]);
    }

    for (const t of tables) {
      if (!Array.isArray(payload[t])) continue;
      for (const raw of payload[t]) {
        const normalized = sanitizeImportRow(t, raw, anioLectivoId, nameMaps, validIds);
        await insertImportRow(t, normalized, tableColumns[t], anioLectivoId);
      }
    }

    await pool.query('COMMIT');
    send(res, 200, { ok: true, modo });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function resetAnio(req, res, anioLectivo) {
  const body = await parseBody(req);
  const etiquetaAnio = anioLectivo.nombre ?? anioLectivo.id;
  const expected = `ELIMINAR TODO ${etiquetaAnio}`;
  if (body.confirmacion !== expected) {
    return send(res, 400, { error: `Confirmación inválida. Debe ser: ${expected}` });
  }

  const tables = ['pagos', 'libros', 'gastos', 'preinscripciones', 'alertas', 'alumnos'];
  for (const t of tables) await pool.query(`DELETE FROM ${t} WHERE anio_lectivo_id = $1`, [anioLectivo.id]);

  send(res, 200, { ok: true, anio_lectivo_id: anioLectivo.id });
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) return send(res, 500, { error: 'Falta variable DATABASE_URL.' });

  const path = getPath(req);
  const url = getUrl(req);

  try {
    const [head, sub] = path.split('/');

    if (head === 'backup' && sub === 'preview' && req.method === 'POST') {
      const anioLectivo = await ensureActiveYearForImport();
      return backupPreview(req, res, anioLectivo.id);
    }

    if (head === 'backup' && sub === 'import' && req.method === 'POST') {
      const anioLectivo = await ensureActiveYearForImport();
      return backupImport(req, res, anioLectivo.id);
    }

    const anioLectivo = await activeYearId();

    if (head in TABLES) {
      if (req.method === 'GET') return listByTable(res, head, anioLectivo.id);
      if (req.method === 'POST') {
        if (head === 'alumnos') return createAlumno(req, res, anioLectivo.id);
        if (head === 'pagos') return createPago(req, res, anioLectivo.id);
        if (head === 'libros') return createLibro(req, res, anioLectivo.id);
        if (head === 'gastos') return createGasto(req, res, anioLectivo.id);
        return createSimple(req, res, head, anioLectivo.id);
      }
      if (req.method === 'PUT') return updateById(req, res, head);
      if (req.method === 'DELETE') return deleteById(req, res, head);
    }

    if (req.method === 'GET' && head === 'reportes' && sub === 'mensualidades') {
      return reporteMensualidades(res, anioLectivo.id, url);
    }

    if (req.method === 'GET' && head === 'reportes' && sub === 'flujo-caja') {
      return reporteFlujoCaja(res, anioLectivo.id, url);
    }
    if (req.method === 'GET' && head === 'reportes' && sub === 'materiales') {
      return reporteMateriales(res, anioLectivo.id);
    }

    if (req.method === 'GET' && head === 'reportes' && sub === 'gastos-categoria') {
      return reporteGastosCategoria(res, anioLectivo.id, url);
    }

    if (req.method === 'GET' && head === 'reportes' && sub === 'deudores') {
      return reporteDeudores(res, anioLectivo.id);
    }

    if (req.method === 'GET' && head === 'reportes' && sub === 'preinscripciones') {
      return reportePreinscripciones(res, anioLectivo.id);
    }


    if (head === 'backup' && sub === 'export' && req.method === 'GET') {
      return backupExport(res, anioLectivo.id, url);
    }


    if (head === 'reset' && req.method === 'POST') {
      return resetAnio(req, res, anioLectivo);
    }

    return send(res, 404, { error: `Ruta no encontrada: /api/${path}` });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
}
