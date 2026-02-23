const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Headers CORS
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, headers);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '');
  const method = req.method;

  try {
    // HEALTH CHECK
    if (path === 'health') {
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ status: 'OK', timestamp: new Date() }));
    }

    // BACKUP - EXPORTAR TODO
    if (path === 'backup' && method === 'GET') {
      const client = await pool.connect();
      try {
        const tables = ['niveles', 'alumnos', 'libros', 'pagos', 'gastos', 'tipos_matricula', 'preinscripciones'];
        const backup = {};
        
        for (const table of tables) {
          const result = await client.query(`SELECT * FROM ${table}`);
          backup[table] = result.rows;
        }
        
        backup.fecha_exportacion = new Date().toISOString();
        backup.version = '2.0';
        backup.anio_activo = new Date().getFullYear();
        
        res.writeHead(200, headers);
        return res.end(JSON.stringify(backup));
      } finally {
        client.release();
      }
    }

    // BACKUP - IMPORTAR
    if (path === 'backup' && method === 'POST') {
      const body = await getBody(req);
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Importar por tablas
        if (body.niveles) {
          await client.query('TRUNCATE niveles RESTART IDENTITY CASCADE');
          for (const row of body.niveles) {
            await client.query(
              `INSERT INTO niveles (id, nombre, precio) VALUES ($1, $2, $3) 
               ON CONFLICT (id) DO UPDATE SET nombre=$2, precio=$3`,
              [row.id, row.nombre, row.precio]
            );
          }
        }
        
        if (body.alumnos) {
          for (const row of body.alumnos) {
            await client.query(
              `INSERT INTO alumnos (id, numero_anual, nombre, cedula, telefono, edad, direccion, nivel, fecha_inscripcion, tipo_matricula_id, email, nombre_padre, telefono_padre, anio_lectivo)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
               ON CONFLICT (id) DO UPDATE SET 
               nombre=$3, telefono=$5, edad=$6, direccion=$7, nivel=$8, email=$11, nombre_padre=$12, telefono_padre=$13`,
              [row.id, row.numero_anual, row.nombre, row.cedula, row.telefono, row.edad, 
               row.direccion, row.nivel, row.fecha_inscripcion, row.tipo_matricula_id || 1,
               row.email, row.nombre_padre, row.telefono_padre, row.anio_lectivo || 2026]
            );
          }
        }

        if (body.libros) {
          for (const row of body.libros) {
            await client.query(
              `INSERT INTO libros (id, alumno_id, titulo, costo_total, pagado, saldo, pagos, estado)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO UPDATE SET
               pagado=$5, saldo=$6, pagos=$7, estado=$8`,
              [row.id, row.alumno_id, row.titulo, row.costo_total, row.pagado, row.saldo, 
               JSON.stringify(row.pagos || []), row.estado || (row.saldo > 0 ? 'pendiente' : 'pagado')]
            );
          }
        }

        if (body.pagos) {
          for (const row of body.pagos) {
            await client.query(
              `INSERT INTO pagos (id, alumno_id, libro_id, tipo, monto, fecha, comentarios, mes_referencia, anio_referencia, es_abono, usuario)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [row.id || Date.now(), row.alumno_id, row.libro_id, row.tipo, row.monto, 
               row.fecha, row.comentarios, row.mes_referencia, row.anio_referencia, 
               row.es_abono || false, row.usuario || 'admin']
            );
          }
        }

        await client.query('COMMIT');
        res.writeHead(200, headers);
        return res.end(JSON.stringify({ success: true, message: 'Importación exitosa' }));
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // RESET TOTAL CON DOBLE SEGURIDAD
    if (path === 'reset' && method === 'POST') {
      const body = await getBody(req);
      
      if (body.codigo !== 'BORRAR_TODO_2026') {
        res.writeHead(403, headers);
        return res.end(JSON.stringify({ error: 'Código de seguridad incorrecto' }));
      }

      const client = await pool.connect();
      try {
        await client.query('TRUNCATE TABLE pagos, libros, alumnos, gastos, preinscripciones RESTART IDENTITY CASCADE');
        res.writeHead(200, headers);
        return res.end(JSON.stringify({ success: true, message: 'Sistema reseteado completamente' }));
      } finally {
        client.release();
      }
    }

    // ALUMNOS - LISTAR
    if (path === 'alumnos' && method === 'GET') {
      const anio = url.searchParams.get('anio') || new Date().getFullYear();
      const busqueda = url.searchParams.get('busqueda') || '';
      
      let sql = `SELECT a.*, n.precio as precio_nivel 
                 FROM alumnos a 
                 LEFT JOIN niveles n ON a.nivel = n.nombre 
                 WHERE a.anio_lectivo = $1`;
      const params = [anio];
      
      if (busqueda) {
        sql += ` AND (a.nombre ILIKE $2 OR a.cedula ILIKE $2)`;
        params.push(`%${busqueda}%`);
      }
      
      sql += ` ORDER BY a.numero_anual`;
      
      const result = await pool.query(sql, params);
      res.writeHead(200, headers);
      return res.end(JSON.stringify(result.rows));
    }

    // ALUMNOS - CREAR/ACTUALIZAR
    if (path === 'alumnos' && method === 'POST') {
      const body = await getBody(req);
      
      // Validar cédula única
      const existe = await pool.query('SELECT id FROM alumnos WHERE cedula = $1 AND id != $2', 
        [body.cedula, body.id || 0]);
      
      if (existe.rows.length > 0) {
        res.writeHead(400, headers);
        return res.end(JSON.stringify({ error: 'La cédula ya está registrada' }));
      }

      if (body.id) {
        // Actualizar
        await pool.query(
          `UPDATE alumnos SET nombre=$1, cedula=$2, telefono=$3, email=$4, nombre_padre=$5, 
           telefono_padre=$6, nivel=$7, tipo_matricula_id=$8, es_hermano=$9, precio_especial=$10,
           direccion=$11, edad=$12
           WHERE id=$13`,
          [body.nombre, body.cedula, body.telefono, body.email, body.nombre_padre,
           body.telefono_padre, body.nivel, body.tipo_matricula_id, body.es_hermano || false,
           body.precio_especial, body.direccion, body.edad, body.id]
        );
        res.writeHead(200, headers);
        return res.end(JSON.stringify({ success: true, id: body.id }));
      } else {
        // Crear nuevo
        const maxNum = await pool.query('SELECT COALESCE(MAX(numero_anual), 0) + 1 as next FROM alumnos WHERE anio_lectivo = $1', 
          [body.anio_lectivo || 2026]);
        
        const result = await pool.query(
          `INSERT INTO alumnos (numero_anual, nombre, cedula, telefono, email, nombre_padre, 
           telefono_padre, nivel, tipo_matricula_id, es_hermano, precio_especial, 
           direccion, edad, fecha_inscripcion, anio_lectivo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_DATE, $14) RETURNING id`,
          [maxNum.rows[0].next, body.nombre, body.cedula, body.telefono, body.email, 
           body.nombre_padre, body.telefono_padre, body.nivel, body.tipo_matricula_id || 1,
           body.es_hermano || false, body.precio_especial, body.direccion, body.edad,
           body.anio_lectivo || 2026]
        );
        res.writeHead(201, headers);
        return res.end(JSON.stringify({ success: true, id: result.rows[0].id }));
      }
    }

    // FICHA COMPLETA DEL ALUMNO
    if (path.startsWith('alumnos/') && path.endsWith('/ficha')) {
      const alumnoId = path.split('/')[1];
      
      const alumno = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumnoId]);
      if (alumno.rows.length === 0) {
        res.writeHead(404, headers);
        return res.end(JSON.stringify({ error: 'No encontrado' }));
      }

      const libros = await pool.query('SELECT * FROM libros WHERE alumno_id = $1', [alumnoId]);
      const pagos = await pool.query('SELECT * FROM pagos WHERE alumno_id = $1 ORDER BY fecha DESC', [alumnoId]);
      
      // Calcular deudas
      const deudaMatricula = await calcularDeudaMatricula(alumnoId, pool);
      const deudaMensual = await calcularDeudaMensualActual(alumnoId, pool, alumno.rows[0]);
      
      res.writeHead(200, headers);
      return res.end(JSON.stringify({
        alumno: alumno.rows[0],
        libros: libros.rows,
        pagos: pagos.rows,
        deudas: {
          matricula: deudaMatricula,
          mensualidad_actual: deudaMensual,
          libros: libros.rows.reduce((sum, l) => sum + parseFloat(l.saldo), 0)
        }
      }));
    }

    // PAGOS - REGISTRAR (con lógica de descuentos/recargos)
    if (path === 'pagos' && method === 'POST') {
      const body = await getBody(req);
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Obtener info del alumno para calcular descuentos
        const alumno = await client.query('SELECT * FROM alumnos WHERE id = $1', [body.alumno_id]);
        const infoAlumno = alumno.rows[0];
        
        let montoFinal = parseInt(body.monto);
        let descuento = 0;
        let recargo = 0;
        let comentarioExtra = '';
        
        // Calcular descuentos/recargos automáticos solo si NO es hermano (excepción)
        if (body.tipo === 'mensualidad' && !infoAlumno.es_hermano) {
          const fechaPago = new Date(body.fecha);
          const dia = fechaPago.getDate();
          const mesPago = fechaPago.getMonth() + 1;
          const mesReferencia = parseInt(body.mes_referencia);
          
          // Lógica: Si paga antes del 10 del mes que corresponde, descuento
          // Si paga después del 15 del mes que corresponde, recargo
          // Si paga mes adelantado (ej: paga marzo en febrero), descuento
          
          if (mesPago < mesReferencia || (mesPago === mesReferencia && dia <= 10)) {
            descuento = 150;
            montoFinal -= 150;
            comentarioExtra = 'Descuento pronto pago (-$150). ';
          } else if (mesPago === mesReferencia && dia >= 16) {
            recargo = 150;
            montoFinal += 150;
            comentarioExtra = 'Recargo por pago tardío (+$150). ';
          }
        }

        // Si es hermano, usar precio especial fijo sin descuentos/recargos
        if (body.tipo === 'mensualidad' && infoAlumno.es_hermano && infoAlumno.precio_especial) {
          montoFinal = infoAlumno.precio_especial;
          descuento = 0;
          recargo = 0;
          comentarioExtra = 'Precio especial hermano. ';
        }

        const comentarioTotal = comentarioExtra + (body.comentarios || '');

        // Insertar pago
        const pagoResult = await client.query(
          `INSERT INTO pagos (alumno_id, libro_id, tipo, concepto, monto_original, monto_final, 
           descuento, recargo, fecha, comentarios, mes_referencia, anio_referencia, es_abono, usuario)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
          [body.alumno_id, body.libro_id, body.tipo, body.concepto, body.monto, montoFinal,
           descuento, recargo, body.fecha, comentarioTotal, body.mes_referencia, 
           body.anio_referencia, body.es_abono || false, body.usuario || 'admin']
        );

        // Si es pago parcial de libro, actualizar saldo
        if (body.libro_id && body.es_abono) {
          const libro = await client.query('SELECT * FROM libros WHERE id = $1', [body.libro_id]);
          const libroData = libro.rows[0];
          const nuevoPagado = parseFloat(libroData.pagado) + montoFinal;
          const nuevoSaldo = parseFloat(libroData.costo_total) - nuevoPagado;
          
          let estado = 'pendiente';
          if (nuevoSaldo <= 0) estado = 'pagado';
          else if (nuevoPagado > 0) estado = 'parcial';
          
          // Agregar a array de pagos del libro
          const pagosLibro = libroData.pagos || [];
          pagosLibro.push({
            fecha: body.fecha,
            monto: montoFinal,
            comentarios: comentarioTotal,
            pago_id: pagoResult.rows[0].id
          });

          await client.query(
            'UPDATE libros SET pagado = $1, saldo = $2, estado = $3, pagos = $4 WHERE id = $5',
            [nuevoPagado, nuevoSaldo, estado, JSON.stringify(pagosLibro), body.libro_id]
          );
        }

        await client.query('COMMIT');
        res.writeHead(201, headers);
        return res.end(JSON.stringify({ 
          success: true, 
          id: pagoResult.rows[0].id,
          monto_final: montoFinal,
          descuento_aplicado: descuento,
          recargo_aplicado: recargo
        }));
        
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // LIBROS - ASIGNAR NUEVO
    if (path === 'libros' && method === 'POST') {
      const body = await getBody(req);
      
      const result = await pool.query(
        `INSERT INTO libros (alumno_id, titulo, costo_total, pagado, saldo, estado, pagos)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [body.alumno_id, body.titulo, body.costo_total, body.primer_abono || 0,
         body.costo_total - (body.primer_abono || 0), 
         body.primer_abono >= body.costo_total ? 'pagado' : 'parcial',
         JSON.stringify([{fecha: new Date(), monto: body.primer_abono || 0, comentarios: 'Asignación inicial'}])]
      );
      
      // Si hay abono inicial, registrar pago
      if (body.primer_abono > 0) {
        await pool.query(
          `INSERT INTO pagos (alumno_id, libro_id, tipo, concepto, monto, fecha, comentarios, es_abono)
           VALUES ($1, $2, 'libro', $3, $4, CURRENT_DATE, 'Primer abono al asignar libro', true)`,
          [body.alumno_id, result.rows[0].id, body.titulo, body.primer_abono]
        );
      }
      
      res.writeHead(201, headers);
      return res.end(JSON.stringify({ success: true, id: result.rows[0].id }));
    }

    // GASTOS
    if (path === 'gastos' && method === 'GET') {
      const anio = url.searchParams.get('anio') || new Date().getFullYear();
      const result = await pool.query(
        'SELECT * FROM gastos WHERE EXTRACT(YEAR FROM fecha) = $1 ORDER BY fecha DESC',
        [an
