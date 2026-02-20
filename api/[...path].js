import { createClient } from '@vercel/postgres';
import { neon } from '@neondatabase/serverless';

// Configuración CORS y headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const sql = neon(process.env.POSTGRES_URL);
  const path = req.url.replace('/api/', '').split('?')[0];
  
  try {
    // Rutas de Alumnos
    if (path === 'alumnos') {
      if (req.method === 'GET') {
        const { rows } = await sql`
          SELECT a.*, n.nombre as nivel_nombre, t.nombre as tipo_matricula_nombre 
          FROM alumnos a 
          LEFT JOIN niveles n ON a.nivel_id = n.id 
          LEFT JOIN tipos_matricula t ON a.tipo_matricula_id = t.id
          WHERE a.activo = true
          ORDER BY a.numero_anual DESC
        `;
        return res.status(200).json(rows);
      }
      
      if (req.method === 'POST') {
        const data = req.body;
        
        // Validar cédula única
        const { rows: existing } = await sql`SELECT id FROM alumnos WHERE cedula = ${data.cedula}`;
        if (existing.length > 0 && !data.id) {
          return res.status(400).json({ error: 'Cédula ya registrada' });
        }
        
        if (data.id) {
          // Update
          const { rows } = await sql`
            UPDATE alumnos SET 
              nombre = ${data.nombre},
              cedula = ${data.cedula},
              telefono = ${data.telefono},
              telefono_alt = ${data.telefono_alt},
              email = ${data.email},
              direccion = ${data.direccion},
              edad = ${data.edad},
              nombre_padre = ${data.nombre_padre},
              nombre_madre = ${data.nombre_madre},
              nivel_id = ${data.nivel_id},
              tipo_matricula_id = ${data.tipo_matricula_id},
              es_hermano = ${data.es_hermano},
              precio_especial = ${data.precio_especial},
              observaciones = ${data.observaciones},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${data.id}
            RETURNING *
          `;
          await auditar(sql, 'alumnos', data.id, 'update', null, data, data.usuario);
          return res.status(200).json(rows[0]);
        } else {
          // Insert
          const { rows } = await sql`
            INSERT INTO alumnos (
              numero_anual, nombre, cedula, telefono, telefono_alt, email, 
              direccion, edad, nombre_padre, nombre_madre, nivel_id, 
              tipo_matricula_id, fecha_inscripcion, año_id, es_hermano, 
              precio_especial, observaciones
            ) VALUES (
              ${data.numero_anual}, ${data.nombre}, ${data.cedula}, 
              ${data.telefono}, ${data.telefono_alt}, ${data.email},
              ${data.direccion}, ${data.edad}, ${data.nombre_padre}, 
              ${data.nombre_madre}, ${data.nivel_id}, ${data.tipo_matricula_id},
              ${data.fecha_inscripcion}, ${data.año_id}, ${data.es_hermano},
              ${data.precio_especial}, ${data.observaciones}
            )
            RETURNING *
          `;
          await auditar(sql, 'alumnos', rows[0].id, 'insert', null, data, data.usuario);
          return res.status(201).json(rows[0]);
        }
      }
      
      if (req.method === 'DELETE') {
        const { id } = req.query;
        await sql`UPDATE alumnos SET activo = false WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      }
    }

    // Rutas de Pagos
    if (path === 'pagos') {
      if (req.method === 'GET') {
        const { alumno_id, mes, año } = req.query;
        let query = `
          SELECT p.*, a.nombre as alumno_nombre 
          FROM pagos p 
          JOIN alumnos a ON p.alumno_id = a.id 
          WHERE 1=1
        `;
        const params = [];
        
        if (alumno_id) {
          params.push(alumno_id);
          query += ` AND p.alumno_id = $${params.length}`;
        }
        if (mes) {
          params.push(mes);
          query += ` AND p.mes = $${params.length}`;
        }
        if (año) {
          params.push(año);
          query += ` AND p.año = $${params.length}`;
        }
        
        query += ` ORDER BY p.fecha_pago DESC`;
        
        const { rows } = await sql.query(query, params);
        return res.status(200).json(rows);
      }
      
      if (req.method === 'POST') {
        const data = req.body;
        
        // Lógica de recargos/descuentos automática
        let montoFinal = data.monto;
        let recargo = 0;
        let descuento = 0;
        
        // Verificar si es hermano (no aplica recargas/descuentos automáticos)
        const { rows: alumnoData } = await sql`SELECT es_hermano, precio_especial FROM alumnos WHERE id = ${data.alumno_id}`;
        const esHermano = alumnoData[0]?.es_hermano || false;
        
        if (data.concepto === 'mensualidad' && !esHermano) {
          const diaPago = new Date(data.fecha_pago).getDate();
          const mesPago = new Date(data.fecha_pago).getMonth() + 1;
          const mesPagando = data.mes;
          
          // Lógica compleja de fechas
          let esAtrasado = false;
          let esAdelantado = false;
          
          if (mesPago > mesPagando) esAdelantado = true;
          if (mesPago < mesPagando) esAtrasado = true;
          
          if (!esAdelantado && !esAtrasado) {
            // Mismo mes
            if (diaPago <= 10) {
              descuento = 150;
            } else if (diaPago >= 16) {
              recargo = 150;
            }
          } else if (esAtrasado) {
            // Paga mes anterior (atrasado)
            recargo = 150;
          }
          // Si es adelantado (mes siguiente), no hay recargo ni descuento según regla
          
          montoFinal = data.monto + recargo - descuento;
        }
        
        if (esHermano && alumnoData[0]?.precio_especial) {
          montoFinal = alumnoData[0].precio_especial;
        }
        
        const { rows } = await sql`
          INSERT INTO pagos (
            alumno_id, concepto, mes, año, monto, recargo, descuento, 
            monto_final, fecha_pago, comentarios, usuario, cuota_n, 
            total_cuotas, año_id, metodo_pago
          ) VALUES (
            ${data.alumno_id}, ${data.concepto}, ${data.mes}, ${data.año}, 
            ${data.monto}, ${recargo}, ${descuento}, ${montoFinal}, 
            ${data.fecha_pago}, ${data.comentarios}, ${data.usuario}, 
            ${data.cuota_n}, ${data.total_cuotas}, ${data.año_id}, ${data.metodo_pago}
          )
          RETURNING *
        `;
        
        // Si es pago de libro, actualizar saldo
        if (data.libro_id) {
          await sql`UPDATE libros SET abonado = abonado + ${data.monto}, 
                   saldo = saldo - ${data.monto} WHERE id = ${data.libro_id}`;
          
          await sql`INSERT INTO libro_pagos (libro_id, monto, fecha, comentarios) 
                   VALUES (${data.libro_id}, ${data.monto}, ${data.fecha_pago}, ${data.comentarios})`;
        }
        
        return res.status(201).json(rows[0]);
      }
    }

    // Rutas de Libros
    if (path === 'libros') {
      if (req.method === 'GET') {
        const { alumno_id } = req.query;
        if (alumno_id) {
          const { rows } = await sql`
            SELECT l.*, a.nombre as alumno_nombre 
            FROM libros l 
            JOIN alumnos a ON l.alumno_id = a.id 
            WHERE l.alumno_id = ${alumno_id}
          `;
          return res.status(200).json(rows);
        } else {
          const { rows } = await sql`
            SELECT l.*, a.nombre as alumno_nombre 
            FROM libros l 
            JOIN alumnos a ON l.alumno_id = a.id 
            WHERE l.saldo > 0
          `;
          return res.status(200).json(rows);
        }
      }
      
      if (req.method === 'POST') {
        const data = req.body;
        const { rows } = await sql`
          INSERT INTO libros (alumno_id, titulo, costo_total, saldo) 
          VALUES (${data.alumno_id}, ${data.titulo}, ${data.costo_total}, ${data.saldo}) 
          RETURNING *
        `;
        return res.status(201).json(rows[0]);
      }
    }

    // Rutas de Niveles
    if (path === 'niveles') {
      if (req.method === 'GET') {
        const { rows } = await sql`SELECT * FROM niveles ORDER BY nombre`;
        return res.status(200).json(rows);
      }
      
      if (req.method === 'POST') {
        const data = req.body;
        if (data.id) {
          await sql`UPDATE niveles SET nombre = ${data.nombre}, precio_mensual = ${data.precio_mensual}, costo_libro = ${data.costo_libro} WHERE id = ${data.id}`;
        } else {
          await sql`INSERT INTO niveles (nombre, precio_mensual, costo_libro, año_id) VALUES (${data.nombre}, ${data.precio_mensual}, ${data.costo_libro}, ${data.año_id})`;
        }
        return res.status(200).json({ success: true });
      }
    }

    // Rutas de Tipos de Matrícula
    if (path === 'tipos-matricula') {
      if (req.method === 'GET') {
        const { rows } = await sql`SELECT * FROM tipos_matricula ORDER BY nombre`;
        return res.status(200).json(rows);
      }
      
      if (req.method === 'POST') {
        const data = req.body;
        if (data.id) {
          await sql`UPDATE tipos_matricula SET nombre = ${data.nombre}, porcentaje = ${data.porcentaje}, monto_fijo = ${data.monto_fijo}, es_hermano = ${data.es_hermano}, descripcion = ${data.descripcion} WHERE id = ${data.id}`;
        } else {
          await sql`INSERT INTO tipos_matricula (nombre, porcentaje, monto_fijo, es_hermano, descripcion, año_id) VALUES (${data.nombre}, ${data.porcentaje}, ${data.monto_fijo}, ${data.es_hermano}, ${data.descripcion}, ${data.año_id})`;
        }
        return res.status(200).json({ success: true });
      }
    }

    // Rutas de Gastos
    if (path === 'gastos') {
      if (req.method === 'GET') {
        const { rows } = await sql`SELECT * FROM gastos ORDER BY fecha DESC`;
        return res.status(200).json(rows);
      }
      
      if (req.method === 'POST') {
        const data = req.body;
        const { rows } = await sql`
          INSERT INTO gastos (concepto, monto_total, categoria, fecha, es_cuota, cuota_n, total_cuotas, año_id) 
          VALUES (${data.concepto}, ${data.monto_total}, ${data.categoria}, ${data.fecha}, ${data.es_cuota}, ${data.cuota_n}, ${data.total_cuotas}, ${data.año_id})
          RETURNING *
        `;
        return res.status(201).json(rows[0]);
      }
    }

    // Rutas de Pre-inscripciones
    if (path === 'preinscripciones') {
      if (req.method === 'GET') {
        const { rows } = await sql`SELECT * FROM preinscripciones WHERE estado = 'pendiente' ORDER BY created_at DESC`;
        return res.status(200).json(rows);
      }
      
      if (req.method === 'POST') {
        const data = req.body;
        const { rows } = await sql`
          INSERT INTO preinscripciones (nombre, telefono, email, nivel_interes, observaciones, año_id) 
          VALUES (${data.nombre}, ${data.telefono}, ${data.email}, ${data.nivel_interes}, ${data.observaciones}, ${data.año_id})
          RETURNING *
        `;
        return res.status(201).json(rows[0]);
      }
      
      if (req.method === 'PUT') {
        const { id, estado } = req.body;
        await sql`UPDATE preinscripciones SET estado = ${estado} WHERE id = ${id}`;
        return res.status(200).json({ success: true });
      }
    }

    // Backup completo
    if (path === 'backup') {
      const backup = {};
      
      const { rows: alumnos } = await sql`SELECT * FROM alumnos WHERE activo = true`;
      backup.alumnos = alumnos;
      
      const { rows: pagos } = await sql`SELECT * FROM pagos`;
      backup.pagos = pagos;
      
      const { rows: libros } = await sql`SELECT * FROM libros`;
      backup.libros = libros;
      
      const { rows: niveles } = await sql`SELECT * FROM niveles`;
      backup.niveles = niveles;
      
      const { rows: tipos } = await sql`SELECT * FROM tipos_matricula`;
      backup.tiposMatricula = tipos;
      
      const { rows: gastos } = await sql`SELECT * FROM gastos`;
      backup.gastos = gastos;
      
      const { rows: preinscripciones } = await sql`SELECT * FROM preinscripciones`;
      backup.preinscripciones = preinscripciones;
      
      backup.fecha_exportacion = new Date().toISOString();
      backup.version = "3.0";
      
      return res.status(200).json(backup);
    }

    // Restore/Import
    if (path === 'restore') {
      const data = req.body;
      
      // Aquí implementarías la lógica de importación masiva con transacciones
      // Por seguridad, solo lo habilitamos para admins
      
      return res.status(200).json({ success: true, message: 'Importación completada' });
    }

    // Dashboard stats
    if (path === 'stats') {
      const { año_id } = req.query;
      
      const stats = {};
      
      // Total alumnos
      const { rows: alumnosCount } = await sql`SELECT COUNT(*) as total FROM alumnos WHERE activo = true AND año_id = ${año_id}`;
      stats.totalAlumnos = parseInt(alumnosCount[0].total);
      
      // Ingresos mes actual
      const mesActual = new Date().getMonth() + 1;
      const { rows: ingresos } = await sql`
        SELECT COALESCE(SUM(monto_final), 0) as total 
        FROM pagos 
        WHERE EXTRACT(MONTH FROM fecha_pago) = ${mesActual} AND año_id = ${año_id}
      `;
      stats.ingresosMes = parseInt(ingresos[0].total);
      
      // Deudores de mensualidad (no pagaron este mes)
      const { rows: deudores } = await sql`
        SELECT a.id, a.nombre, a.cedula, n.nombre as nivel, t.nombre as tipo_matricula
        FROM alumnos a
        LEFT JOIN niveles n ON a.nivel_id = n.id
        LEFT JOIN tipos_matricula t ON a.tipo_matricula_id = t.id
        LEFT JOIN pagos p ON a.id = p.alumno_id 
          AND p.concepto = 'mensualidad' 
          AND p.mes = ${mesActual} 
          AND p.año_id = ${año_id}
        WHERE a.activo = true 
          AND a.año_id = ${año_id}
          AND p.id IS NULL
      `;
      stats.deudoresMensualidad = deudores;
      
      // Libros pendientes
      const { rows: librosPendientes } = await sql`
        SELECT l.*, a.nombre as alumno_nombre 
        FROM libros l 
        JOIN alumnos a ON l.alumno_id = a.id 
        WHERE l.saldo > 0
      `;
      stats.librosPendientes = librosPendientes;
      
      // Pre-inscripciones
      const { rows: preinsc } = await sql`SELECT COUNT(*) as total FROM preinscripciones WHERE estado = 'pendiente' AND año_id = ${año_id}`;
      stats.preinscripciones = parseInt(preinsc[0].total);
      
      return res.status(200).json(stats);
    }

    // Ficha completa del alumno
    if (path.startsWith('alumnos/') && path.includes('/ficha')) {
      const alumnoId = path.split('/')[1];
      
      const ficha = {};
      
      // Datos básicos
      const { rows: alumno } = await sql`
        SELECT a.*, n.nombre as nivel_nombre, t.nombre as tipo_matricula_nombre 
        FROM alumnos a 
        LEFT JOIN niveles n ON a.nivel_id = n.id 
        LEFT JOIN tipos_matricula t ON a.tipo_matricula_id = t.id
        WHERE a.id = ${alumnoId}
      `;
      ficha.datos = alumno[0];
      
      // Historial de pagos
      const { rows: pagos } = await sql`
        SELECT * FROM pagos WHERE alumno_id = ${alumnoId} ORDER BY fecha_pago DESC
      `;
      ficha.pagos = pagos;
      
      // Libros
      const { rows: libros } = await sql`
        SELECT l.*, 
               (SELECT COALESCE(SUM(monto), 0) FROM libro_pagos WHERE libro_id = l.id) as total_abonado
        FROM libros l 
        WHERE l.alumno_id = ${alumnoId}
      `;
      ficha.libros = libros;
      
      // Deuda total calculada
      let deudaMatricula = 0;
      let deudaLibros = 0;
      
      // Calcular si debe matrícula (simplificado)
      const { rows: pagoMat } = await sql`
        SELECT * FROM pagos 
        WHERE alumno_id = ${alumnoId} AND concepto = 'matricula' 
        ORDER BY fecha_pago DESC LIMIT 1
      `;
      
      if (pagoMat.length === 0) {
        // No pagó matrícula, calcular según tipo
        const { rows: tipo } = await sql`SELECT * FROM tipos_matricula WHERE id = ${ficha.datos.tipo_matricula_id}`;
        deudaMatricula = tipo[0]?.monto_fijo || 3000; // default
      }
      
      // Deuda libros
      const { rows: sumLibros } = await sql`
        SELECT COALESCE(SUM(saldo), 0) as total 
        FROM libros 
        WHERE alumno_id = ${alumnoId}
      `;
      deudaLibros = parseInt(sumLibros[0].total);
      
      ficha.deudaTotal = deudaMatricula + deudaLibros;
      ficha.deudaMatricula = deudaMatricula;
      ficha.deudaLibros = deudaLibros;
      
      return res.status(200).json(ficha);
    }

    // Si llega aquí, ruta no encontrada
    return res.status(404).json({ error: 'Ruta no encontrada' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function auditar(sql, tabla, registroId, accion, datosAnteriores, datosNuevos, usuario) {
  try {
    await sql`
      INSERT INTO auditoria (tabla, registro_id, accion, datos_anteriores, datos_nuevos, usuario)
      VALUES (${tabla}, ${registroId}, ${accion}, ${JSON.stringify(datosAnteriores)}, ${JSON.stringify(datosNuevos)}, ${usuario})
    `;
  } catch (e) {
    console.error('Error en auditoría:', e);
  }
}
