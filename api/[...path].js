const { createPool } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');

// Configuración de base de datos
const pool = createPool(process.env.DATABASE_URL);

// Helper para CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper para respuestas JSON
const jsonResponse = (data, status = 200) => ({
  statusCode: status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

// Middleware de autenticación básica (puedes mejorarla luego)
const checkAuth = (event) => {
  // Por ahora permitimos todo, luego puedes agregar tokens
  return true;
};

// Router principal
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  const path = req.url.replace('/api/', '').split('?')[0];
  const method = req.method;

  try {
    // Rutas de Alumnos
    if (path === 'alumnos') {
      if (method === 'GET') {
        const { anio, busqueda } = req.query;
        let sql = `
          SELECT a.*, n.nombre as nivel_nombre, t.nombre as tipo_matricula_nombre, t.es_excepcion
          FROM alumnos a
          LEFT JOIN niveles n ON a.nivel_id = n.id
          LEFT JOIN tipos_matricula t ON a.tipo_matricula_id = t.id
          WHERE a.activo = true
        `;
        const params = [];
        
        if (anio) {
          params.push(anio);
          sql += ` AND a.anio_id = $${params.length}`;
        }
        
        if (busqueda) {
          params.push(`%${busqueda}%`);
          sql += ` AND (a.nombre ILIKE $${params.length} OR a.cedula ILIKE $${params.length})`;
        }
        
        sql += ` ORDER BY a.numero_anual`;
        
        const result = await pool.query(sql, params);
        return jsonResponse(result.rows);
      }
      
      if (method === 'POST') {
        const data = req.body;
        
        // Validar cédula única
        const existe = await pool.query('SELECT id FROM alumnos WHERE cedula = $1', [data.cedula]);
        if (existe.rows.length > 0) {
          return jsonResponse({ error: 'La cédula ya está registrada' }, 400);
        }
        
        const sql = `
          INSERT INTO alumnos (
            anio_id, numero_anual, nombre, cedula, email, telefono, telefono_alt, 
            direccion, edad, nombre_padre, telefono_padre, nombre_madre, telefono_madre,
            nivel_id, tipo_matricula_id, es_hermano, precio_especial_hermano, fecha_inscripcion
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *
        `;
        
        const result = await pool.query(sql, [
          data.anio_id, data.numero_anual, data.nombre, data.cedula, data.email, 
          data.telefono, data.telefono_alt, data.direccion, data.edad,
          data.nombre_padre, data.telefono_padre, data.nombre_madre, data.telefono_madre,
          data.nivel_id, data.tipo_matricula_id, data.es_hermano, 
          data.precio_especial_hermano, data.fecha_inscripcion
        ]);
        
        return jsonResponse(result.rows[0], 201);
      }
    }

    // Ficha completa del alumno
    if (path.startsWith('alumnos/') && path.includes('/ficha')) {
      const alumnoId = path.split('/')[1];
      
      const alumno = await pool.query(`
        SELECT a.*, n.nombre as nivel_nombre, n.precio_mensual, t.nombre as tipo_matricula, t.porcentaje
        FROM alumnos a
        LEFT JOIN niveles n ON a.nivel_id = n.id
        LEFT JOIN tipos_matricula t ON a.tipo_matricula_id = t.id
        WHERE a.id = $1
      `, [alumnoId]);
      
      if (alumno.rows.length === 0) {
        return jsonResponse({ error: 'Alumno no encontrado' }, 404);
      }
      
      const libros = await pool.query('SELECT * FROM libros WHERE alumno_id = $1', [alumnoId]);
      const pagos = await pool.query(`
        SELECT * FROM pagos 
        WHERE alumno_id = $1 
        ORDER BY fecha_pago DESC
      `, [alumnoId]);
      
      const deudaMatricula = await calcularDeudaMatricula(alumnoId, pool);
      const deudaMensual = await calcularDeudaMensual(alumnoId, pool);
      
      return jsonResponse({
        alumno: alumno.rows[0],
        libros: libros.rows,
        pagos: pagos.rows,
        deudas: {
          matricula: deudaMatricula,
          mensual: deudaMensual,
          libros: libros.rows.filter(l => l.estado !== 'pagado').reduce((sum, l) => sum + (l.costo_total - l.pagado), 0)
        }
      });
    }

    // Rutas de Pagos
    if (path === 'pagos') {
      if (method === 'GET') {
        const { alumno_id, desde, hasta, tipo } = req.query;
        let sql = `
          SELECT p.*, a.nombre as alumno_nombre, a.cedula
          FROM pagos p
          JOIN alumnos a ON p.alumno_id = a.id
          WHERE 1=1
        `;
        const params = [];
        
        if (alumno_id) {
          params.push(alumno_id);
          sql += ` AND p.alumno_id = $${params.length}`;
        }
        if (desde) {
          params.push(desde);
          sql += ` AND p.fecha_pago >= $${params.length}`;
        }
        if (hasta) {
          params.push(hasta);
          sql += ` AND p.fecha_pago <= $${params.length}`;
        }
        if (tipo) {
          params.push(tipo);
          sql += ` AND p.tipo = $${params.length}`;
        }
        
        sql += ` ORDER BY p.fecha_pago DESC`;
        
        const result = await pool.query(sql, params);
        return jsonResponse(result.rows);
      }
      
      if (method === 'POST') {
        const data = req.body;
        
        // Calcular descuentos/recargos automáticos si es mensualidad
        let descuento = 0;
        let recargo = 0;
        let montoFinal = data.monto;
        
        if (data.tipo === 'mensualidad' && data.fecha_pago && data.mes_referencia) {
          const alumno = await pool.query('SELECT es_hermano, precio_especial_hermano FROM alumnos WHERE id = $1', [data.alumno_id]);
          const esHermanoo = alumno.rows[0]?.es_hermano;
          
          if (!esHermanoo) {
            const fechaPago = new Date(data.fecha_pago);
            const dia = fechaPago.getDate();
            const mesPago = fechaPago.getMonth() + 1;
            
            // Si paga el mes anterior al que corresponde (adelantado) o en el mes correcto
            if (dia <= 10) {
              descuento = 150; // Descuento pronto pago
            } else if (dia >= 16) {
              // Verificar si está pagando atrasado (mes de referencia < mes actual)
              const hoy = new Date();
              if (data.anio_referencia < hoy.getFullYear() || 
                  (data.anio_referencia === hoy.getFullYear() && data.mes_referencia < (hoy.getMonth() + 1))) {
                recargo = 150;
              }
            }
            
            montoFinal = data.monto - descuento + recargo;
          }
        }
        
        const sql = `
          INSERT INTO pagos (
            alumno_id, libro_id, tipo, concepto, monto, metodo_pago,
            mes_referencia, anio_referencia, fecha_pago, comentarios,
            descuento_aplicado, recargo_aplicado, es_abono
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;
        
        const result = await pool.query(sql, [
          data.alumno_id, data.libro_id, data.tipo, data.concepto, montoFinal,
          data.metodo_pago, data.mes_referencia, data.anio_referencia,
          data.fecha_pago, data.comentarios, descuento, recargo, data.es_abono || false
        ]);
        
        // Si es pago de libro, actualizar estado
        if (data.libro_id) {
          const libro = await pool.query('SELECT * FROM libros WHERE id = $1', [data.libro_id]);
          const totalPagado = await pool.query(
            'SELECT COALESCE(SUM(monto), 0) as total FROM pagos WHERE libro_id = $1',
            [data.libro_id]
          );
          
          const nuevoEstado = totalPagado.rows[0].total >= libro.rows[0].costo_total ? 'pagado' : 
                             totalPagado.rows[0].total > 0 ? 'parcial' : 'pendiente';
          
          await pool.query(
            'UPDATE libros SET estado = $1 WHERE id = $2',
            [nuevoEstado, data.libro_id]
          );
        }
        
        return jsonResponse(result.rows[0], 201);
      }
    }

    // Backup y Restore
    if (path === 'backup') {
      if (method === 'GET') {
        // Exportar todo
        const tablas = ['config_anio', 'tipos_matricula', 'niveles', 'alumnos', 'libros', 'pagos', 'gastos', 'preinscripciones'];
        const backup = {};
        
        for (const tabla of tablas) {
          const result = await pool.query(`SELECT * FROM ${tabla}`);
          backup[tabla] = result.rows;
        }
        
        backup.fecha_exportacion = new Date().toISOString();
        backup.version = '2.0';
        
        return jsonResponse(backup);
      }
      
      if (method === 'POST') {
        const data = req.body;
        
        // Importar datos (con transacción)
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Limpiar tablas si es full restore
          if (data.full_restore) {
            await client.query('TRUNCATE TABLE pagos, libros, alumnos, gastos, preinscripciones, niveles, tipos_matricula, config_anio RESTART IDENTITY CASCADE');
          }
          
          // Insertar por tablas
          if (data.config_anio) {
            for (const row of data.config_anio) {
              await client.query(`
                INSERT INTO config_anio (id, anio, activo, matricula_base, mensualidad_base)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET
                activo = EXCLUDED.activo, matricula_base = EXCLUDED.matricula_base
              `, [row.id, row.anio, row.activo, row.matricula_base, row.mensualidad_base]);
            }
          }
          
          // Repetir para otras tablas...
          if (data.alumnos) {
            for (const row of data.alumnos) {
              await client.query(`
                INSERT INTO alumnos (
                  id, anio_id, numero_anual, nombre, cedula, email, telefono, 
                  nivel_id, tipo_matricula_id, es_hermano, fecha_inscripcion, activo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre, telefono = EXCLUDED.telefono, activo = EXCLUDED.activo
              `, [row.id, row.anio_id, row.numero_anual, row.nombre, row.cedula, 
                  row.email, row.telefono, row.nivel_id, row.tipo_matricula_id, 
                  row.es_hermano, row.fecha_inscripcion, row.activo]);
            }
          }
          
          await client.query('COMMIT');
          return jsonResponse({ success: true, message: 'Backup restaurado' });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
    }

    // Reset completo (con doble seguridad)
    if (path === 'reset' && method === 'POST') {
      const { confirmacion, anio_id } = req.body;
      
      if (confirmacion !== 'RESET_TOTAL_2026') {
        return jsonResponse({ error: 'Código de confirmación inválido' }, 403);
      }
      
      await pool.query('TRUNCATE TABLE alertas, auditoria, pagos, libros, alumnos, gastos, preinscripciones, niveles, tipos_matricula RESTART IDENTITY CASCADE');
      
      return jsonResponse({ success: true, message: 'Sistema reseteado completamente' });
    }

    // Dashboard y estadísticas
    if (path === 'dashboard') {
      const { anio_id, mes } = req.query;
      
      // Estadísticas generales
      const totalAlumnos = await pool.query('SELECT COUNT(*) FROM alumnos WHERE activo = true AND anio_id = $1', [anio_id]);
      const ingresosMes = await pool.query(`
        SELECT COALESCE(SUM(monto), 0) as total 
        FROM pagos 
        WHERE EXTRACT(MONTH FROM fecha_pago) = $1 AND EXTRACT(YEAR FROM fecha_pago) = $2
      `, [mes, new Date().getFullYear()]);
      
      const deudores = await pool.query(`
        SELECT a.id, a.nombre, a.cedula, n.nombre as nivel,
               (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE alumno_id = a.id AND tipo = 'matricula') as pagado_mat
        FROM alumnos a
        LEFT JOIN niveles n ON a.nivel_id = n.id
        WHERE a.activo = true AND a.anio_id = $1
      `, [anio_id]);
      
      return jsonResponse({
        total_alumnos: totalAlumnos.rows[0].count,
        ingresos_mes: ingresosMes.rows[0].total,
        deudores: deudores.rows
      });
    }

    // Generar mensaje WhatsApp
    if (path === 'whatsapp') {
      const { alumno_id, tipo } = req.query;
      
      const alumno = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumno_id]);
      if (alumno.rows.length === 0) return jsonResponse({ error: 'No encontrado' }, 404);
      
      const a = alumno.rows[0];
      let mensaje = '';
      
      if (tipo === 'cobranza') {
        const deuda = await calcularDeudaTotal(alumno_id, pool);
        mensaje = `Hola ${a.nombre_padre || 'Padre/Madre'}, le recordamos que ${a.nombre} tiene un saldo pendiente de $${deuda}. Por favor regularice su situación para mantener activa la matrícula. Gracias. ALEI Instituto de Inglés.`;
      } else if (tipo === 'bienvenida') {
        mensaje = `Bienvenido/a ${a.nombre} a ALEI Instituto de Inglés. Su número de estudiante es ${a.numero_anual}. Nos contactaremos por este medio para informar sobre pagos y novedades. ¡Gracias por confiar en nosotros!`;
      }
      
      return jsonResponse({ mensaje, telefono: a.telefono_padre || a.telefono });
    }

    return jsonResponse({ error: 'Ruta no encontrada' }, 404);
    
  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
};

// Funciones auxiliares
async function calcularDeudaMatricula(alumnoId, pool) {
  const alumno = await pool.query(`
    SELECT a.*, t.costo_fijo, t.porcentaje, c.matricula_base
    FROM alumnos a
    JOIN tipos_matricula t ON a.tipo_matricula_id = t.id
    JOIN config_anio c ON a.anio_id = c.id
    WHERE a.id = $1
  `, [alumnoId]);
  
  if (alumno.rows.length === 0) return 0;
  
  const a = alumno.rows[0];
  let costoMatricula = a.costo_fijo || (a.matricula_base * a.porcentaje / 100);
  
  const pagado = await pool.query(`
    SELECT COALESCE(SUM(monto), 0) as total 
    FROM pagos 
    WHERE alumno_id = $1 AND tipo = 'matricula'
  `, [alumnoId]);
  
  return Math.max(0, costoMatricula - pagado.rows[0].total);
}

async function calcularDeudaMensual(alumnoId, pool) {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  
  const pagado = await pool.query(`
    SELECT COALESCE(SUM(monto), 0) as total 
    FROM pagos 
    WHERE alumno_id = $1 AND tipo = 'mensualidad' AND mes_referencia = $2
  `, [alumnoId, mesActual]);
  
  const alumno = await pool.query(`
    SELECT es_hermano, precio_especial_hermano, n.precio_mensual
    FROM alumnos a
    LEFT JOIN niveles n ON a.nivel_id = n.id
    WHERE a.id = $1
  `, [alumnoId]);
  
  if (alumno.rows.length === 0) return 0;
  
  const a = alumno.rows[0];
  const mensualidad = a.es_hermano ? a.precio_especial_hermano : a.precio_mensual;
  
  return Math.max(0, mensualidad - pagado.rows[0].total);
}

async function calcularDeudaTotal(alumnoId, pool) {
  const mat = await calcularDeudaMatricula(alumnoId, pool);
  const men = await calcularDeudaMensual(alumnoId, pool);
  return mat + men;
}
