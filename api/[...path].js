import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const route = path.join('/');
  const body = req.body || {};

  try {
    // SWITCH DE RUTAS
    switch(route) {
      
      // ANOS LECTIVOS
      case 'anos':
        if (req.method === 'GET') {
          const anos = await sql`SELECT * FROM anos_lectivos ORDER BY ano DESC`;
          return res.json(anos);
        }
        if (req.method === 'POST') {
          const { ano } = body;
          await sql`INSERT INTO anos_lectivos (ano) VALUES (${ano})`;
          return res.json({ success: true });
        }

      // ALUMNOS CRUD
      case 'alumnos':
        if (req.method === 'GET') {
          const { ano_lectivo_id, search } = req.query;
          if (search) {
            const alumnos = await sql`
              SELECT a.*, n.nombre as nivel_nombre 
              FROM alumnos a 
              LEFT JOIN niveles n ON a.nivel_id = n.id 
              WHERE a.ano_lectivo_id = ${ano_lectivo_id}
              AND (a.nombre ILIKE ${'%'+search+'%'} OR a.cedula ILIKE ${'%'+search+'%'})
              ORDER BY a.numero_anual
            `;
            return res.json(alumnos);
          }
          const alumnos = await sql`
            SELECT a.*, n.nombre as nivel_nombre,
              (SELECT COUNT(*) FROM pagos p WHERE p.alumno_id = a.id) as total_pagos
            FROM alumnos a 
            LEFT JOIN niveles n ON a.nivel_id = n.id 
            WHERE a.ano_lectivo_id = ${ano_lectivo_id}
            ORDER BY a.numero_anual
          `;
          return res.json(alumnos);
        }
        
        if (req.method === 'POST') {
          // Validar cédula duplicada
          const existing = await sql`SELECT id FROM alumnos WHERE cedula = ${body.cedula} AND ano_lectivo_id = ${body.ano_lectivo_id}`;
          if (existing.length > 0) return res.status(400).json({ error: 'Cédula ya registrada' });
          
          const result = await sql`
            INSERT INTO alumnos (
              ano_lectivo_id, nombre, cedula, email, telefono, telefono_alt, 
              tutor_nombre, tutor_telefono, fecha_nacimiento, direccion, 
              nivel_id, es_hermano, monto_especial, cuota_base, fecha_inscripcion
            ) VALUES (
              ${body.ano_lectivo_id}, ${body.nombre}, ${body.cedula}, ${body.email}, 
              ${body.telefono}, ${body.telefono_alt}, ${body.tutor_nombre}, 
              ${body.tutor_telefono}, ${body.fecha_nacimiento}, ${body.direccion},
              ${body.nivel_id}, ${body.es_hermano}, ${body.monto_especial}, 
              ${body.cuota_base}, ${body.fecha_inscripcion}
            ) RETURNING *
          `;
          
          // Auditar
          await sql`INSERT INTO auditoria (tabla, accion, datos_nuevos) VALUES ('alumnos', 'INSERT', ${sql.json(result[0])})`;
          return res.json(result[0]);
        }

        if (req.method === 'PUT') {
          const { id } = body;
          await sql`
            UPDATE alumnos SET 
              nombre = ${body.nombre}, cedula = ${body.cedula}, email = ${body.email},
              telefono = ${body.telefono}, telefono_alt = ${body.telefono_alt},
              tutor_nombre = ${body.tutor_nombre}, tutor_telefono = ${body.tutor_telefono},
              fecha_nacimiento = ${body.fecha_nacimiento}, direccion = ${body.direccion},
              nivel_id = ${body.nivel_id}, es_hermano = ${body.es_hermano},
              monto_especial = ${body.monto_especial}, cuota_base = ${body.cuota_base}
            WHERE id = ${id}
          `;
          return res.json({ success: true });
        }

        if (req.method === 'DELETE') {
          const { id } = body;
          await sql`DELETE FROM alumnos WHERE id = ${id}`;
          return res.json({ success: true });
        }

      // PAGOS CON LÓGICA DE RECARGOS
      case 'pagos':
        if (req.method === 'GET') {
          const { ano_lectivo_id, desde, hasta, concepto } = req.query;
          let query = sql`
            SELECT p.*, a.nombre as alumno_nombre 
            FROM pagos p 
            JOIN alumnos a ON p.alumno_id = a.id 
            WHERE p.ano_lectivo_id = ${ano_lectivo_id}
          `;
          if (desde && hasta) {
            query = sql`
              SELECT p.*, a.nombre as alumno_nombre 
              FROM pagos p 
              JOIN alumnos a ON p.alumno_id = a.id 
              WHERE p.ano_lectivo_id = ${ano_lectivo_id}
              AND p.fecha BETWEEN ${desde} AND ${hasta}
              ${concepto && concepto !== 'todos' ? sql`AND p.concepto = ${concepto}` : sql``}
              ORDER BY p.fecha DESC
            `;
          }
          const pagos = await query;
          return res.json(pagos);
        }

        if (req.method === 'POST') {
          const { alumno_id, concepto, mes, fecha, user_ip } = body;
          let { monto } = body;
          
          // Lógica de recargos/descuentos automáticos
          let recargo = 0;
          let descuento = 0;
          let monto_original = monto;
          
          if (concepto === 'mensualidad') {
            const alumno = await sql`SELECT es_hermano, monto_especial, cuota_base FROM alumnos WHERE id = ${alumno_id}`;
            if (alumno[0]) {
              const a = alumno[0];
              
              // Si es hermano, usa monto especial fijo sin recargos/descuentos
              if (a.es_hermano && a.monto_especial) {
                monto = a.monto_especial;
              } else {
                // Lógica compleja de fechas
                const diaPago = new Date(fecha).getDate();
                const mesPago = new Date(fecha).getMonth() + 1;
                const mesPagado = parseInt(mes);
                
                const esPagoAnticipado = mesPago < mesPagado; // Ej: paga marzo(3) en febrero(2)
                const esPagoAtrasado = mesPago > mesPagado;   // Ej: paga sept(9) en oct(10)
                
                if (esPagoAnticipado || diaPago <= 10) {
                  descuento = 150;
                  monto -= 150;
                } else if (esPagoAtrasado || diaPago >= 16) {
                  recargo = 150;
                  monto += 150;
                }
              }
            }
          }
          
          const result = await sql`
            INSERT INTO pagos (
              alumno_id, ano_lectivo_id, concepto, mes, monto, monto_original,
              recargo, descuento, fecha, comentarios, libro_id, created_by
            ) VALUES (
              ${alumno_id}, ${body.ano_lectivo_id}, ${concepto}, ${mes}, ${monto},
              ${monto_original}, ${recargo}, ${descuento}, ${fecha}, 
              ${body.comentarios}, ${body.libro_id}, ${user_ip}
            ) RETURNING *
          `;
          
          // Si es libro, actualizar saldo
          if (concepto === 'libro' && body.libro_id) {
            await sql`UPDATE libros SET pagado = pagado + ${monto}, saldo = saldo - ${monto} WHERE id = ${body.libro_id}`;
          }
          
          return res.json(result[0]);
        }

        if (req.method === 'DELETE') {
          const { id } = body;
          // Obtener pago antes de borrar para auditoría
          const pago = await sql`SELECT * FROM pagos WHERE id = ${id}`;
          await sql`INSERT INTO auditoria (tabla, registro_id, accion, datos_anteriores) VALUES ('pagos', ${id}, 'DELETE', ${sql.json(pago[0])})`;
          await sql`DELETE FROM pagos WHERE id = ${id}`;
          return res.json({ success: true });
        }

      case 'pagos/ultimos':
        const ultimos = await sql`
          SELECT p.*, a.nombre as alumno_nombre 
          FROM pagos p 
          JOIN alumnos a ON p.alumno_id = a.id 
          WHERE p.ano_lectivo_id = ${req.query.ano_lectivo_id}
          ORDER BY p.created_at DESC LIMIT 50
        `;
        return res.json(ultimos);

      // LIBROS
      case 'libros':
        if (req.method === 'GET') {
          const libros = await sql`
            SELECT l.*, a.nombre as alumno_nombre, a.numero_anual 
            FROM libros l 
            JOIN alumnos a ON l.alumno_id = a.id 
            WHERE a.ano_lectivo_id = ${req.query.ano_lectivo_id}
            ORDER BY l.created_at DESC
          `;
          return res.json(libros);
        }
        
        if (req.method === 'POST') {
          const { alumno_id, titulo, costo_total, abono_inicial, observaciones } = body;
          const saldo = costo_total - (abono_inicial || 0);
          const pagos = abono_inicial > 0 ? JSON.stringify([{fecha: new Date().toISOString().split('T')[0], monto: abono_inicial, comentarios: 'Abono inicial'}]) : '[]';
          
          const result = await sql`
            INSERT INTO libros (alumno_id, titulo, costo_total, pagado, saldo, observaciones, pagos)
            VALUES (${alumno_id}, ${titulo}, ${costo_total}, ${abono_inicial || 0}, ${saldo}, ${observaciones}, ${pagos})
            RETURNING *
          `;
          return res.json(result[0]);
        }

      // GASTOS CON CUOTAS
      case 'gastos':
        if (req.method === 'GET') {
          const gastos = await sql`
            SELECT * FROM gastos 
            WHERE ano_lectivo_id = ${req.query.ano_lectivo_id}
            ORDER BY fecha DESC
          `;
          return res.json(gastos);
        }
        
        if (req.method === 'POST') {
          const result = await sql`
            INSERT INTO gastos (ano_lectivo_id, concepto, proveedor, monto_total, fecha, categoria, es_cuota, numero_cuotas, cuota_actual)
            VALUES (${body.ano_lectivo_id}, ${body.concepto}, ${body.proveedor}, ${body.monto_total}, ${body.fecha}, ${body.categoria}, ${body.es_cuota}, ${body.numero_cuotas}, ${body.cuota_actual || 1})
            RETURNING *
          `;
          return res.json(result[0]);
        }

      // NIVELES
      case 'niveles':
        if (req.method === 'GET') {
          const niveles = await sql`
            SELECT n.*, 
              (SELECT COUNT(*) FROM alumnos WHERE nivel_id = n.id) as alumnos_count,
              (SELECT COUNT(*) FROM lista_espera WHERE nivel_interes_id = n.id AND estado = 'pendiente') as espera_count
            FROM niveles n 
            WHERE n.ano_lectivo_id = ${req.query.ano_lectivo_id}
          `;
          return res.json(niveles);
        }
        
        if (req.method === 'POST') {
          const result = await sql`
            INSERT INTO niveles (ano_lectivo_id, nombre, horario, cupo_maximo)
            VALUES (${body.ano_lectivo_id}, ${body.nombre}, ${body.horario}, ${body.cupo_maximo})
            RETURNING *
          `;
          return res.json(result[0]);
        }

      // LISTA DE ESPERA
      case 'waitlist':
        if (req.method === 'GET') {
          const lista = await sql`
            SELECT l.*, n.nombre as nivel_nombre 
            FROM lista_espera l 
            LEFT JOIN niveles n ON l.nivel_interes_id = n.id 
            WHERE l.ano_lectivo_id = ${req.query.ano_lectivo_id}
            ORDER BY l.fecha_registro DESC
          `;
          return res.json(lista);
        }
        
        if (req.method === 'POST') {
          const result = await sql`
            INSERT INTO lista_espera (ano_lectivo_id, nombre, telefono, email, nivel_interes_id, notas)
            VALUES (${body.ano_lectivo_id}, ${body.nombre}, ${body.telefono}, ${body.email}, ${body.nivel_interes_id}, ${body.notas})
            RETURNING *
          `;
          return res.json(result[0]);
        }
        
        if (req.method === 'PUT') {
          await sql`UPDATE lista_espera SET estado = ${body.estado}, fecha_contacto = NOW() WHERE id = ${body.id}`;
          return res.json({ success: true });
        }

      // DASHBOARD STATS
      case 'dashboard':
        const { ano_lectivo_id } = req.query;
        const hoy = new Date().toISOString().split('T')[0];
        const mesActual = new Date().getMonth() + 1;
        
        const [
          totalAlumnos,
          ingresosMes,
          deudaLibros,
          pagosHoy
        ] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM alumnos WHERE ano_lectivo_id = ${ano_lectivo_id} AND estado = 'activo'`,
          sql`SELECT COALESCE(SUM(monto), 0) as total FROM pagos WHERE ano_lectivo_id = ${ano_lectivo_id} AND EXTRACT(MONTH FROM fecha) = ${mesActual}`,
          sql`SELECT COALESCE(SUM(saldo), 0) as total FROM libros l JOIN alumnos a ON l.alumno_id = a.id WHERE a.ano_lectivo_id = ${ano_lectivo_id}`,
          sql`SELECT COUNT(*) as count FROM pagos WHERE ano_lectivo_id = ${ano_lectivo_id} AND fecha = ${hoy}`
        ]);
        
        // Alumnos que deben mensualidad actual
        const deudores = await sql`
          SELECT a.id, a.nombre, a.telefono, a.tutor_telefono, n.nombre as nivel,
            (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE alumno_id = a.id AND concepto = 'mensualidad' AND mes = ${mesActual}) as pagado
          FROM alumnos a
          LEFT JOIN niveles n ON a.nivel_id = n.id
          WHERE a.ano_lectivo_id = ${ano_lectivo_id} 
          AND a.estado = 'activo'
          AND a.es_hermano = false
          AND NOT EXISTS (
            SELECT 1 FROM pagos p 
            WHERE p.alumno_id = a.id 
            AND p.concepto = 'mensualidad' 
            AND p.mes = ${mesActual}
          )
          ORDER BY a.nombre
          LIMIT 20
        `;
        
        return res.json({
          totalAlumnos: totalAlumnos[0].count,
          ingresosMes: ingresosMes[0].total,
          deudaLibros: deudaLibros[0].total,
          pagosHoy: pagosHoy[0].count,
          deudores
        });

      // FICHA ALUMNO COMPLETA
      case 'alumno/ficha':
        const aid = req.query.id;
        const [alumnoData, pagosAlumno, librosAlumno, alertasAlumno] = await Promise.all([
          sql`SELECT a.*, n.nombre as nivel_nombre FROM alumnos a LEFT JOIN niveles n ON a.nivel_id = n.id WHERE a.id = ${aid}`,
          sql`SELECT * FROM pagos WHERE alumno_id = ${aid} ORDER BY fecha DESC`,
          sql`SELECT * FROM libros WHERE alumno_id = ${aid}`,
          sql`SELECT * FROM alertas WHERE alumno_id = ${aid} AND leida = false ORDER BY fecha_alerta`
        ]);
        return res.json({
          alumno: alumnoData[0],
          pagos: pagosAlumno,
          libros: librosAlumno,
          alertas: alertasAlumno
        });

      // IMPORTACIÓN BULK
      case 'import':
        if (req.method === 'POST') {
          const { tabla, datos, ano_lectivo_id } = body;
          let insertados = 0;
          
          // Transacción manual
          for (const item of datos) {
            try {
              if (tabla === 'alumnos') {
                await sql`
                  INSERT INTO alumnos (ano_lectivo_id, nombre, cedula, email, telefono, nivel_id, es_hermano, fecha_inscripcion)
                  VALUES (${ano_lectivo_id}, ${item.nombre}, ${item.cedula}, ${item.email}, ${item.telefono}, ${item.nivel_id}, ${item.es_hermano || false}, ${item.fecha_inscripcion || new Date().toISOString().split('T')[0]})
                  ON CONFLICT (cedula) DO NOTHING
                `;
                insertados++;
              }
              // Agregar más tablas según necesidad
            } catch(e) { console.error(e); }
          }
          return res.json({ insertados });
        }

      // ALERTAS GENERALES
      case 'alertas':
        const alertas = await sql`
          SELECT a.*, al.nombre as alumno_nombre, al.telefono 
          FROM alertas a 
          JOIN alumnos al ON a.alumno_id = al.id 
          WHERE al.ano_lectivo_id = ${req.query.ano_lectivo_id} 
          AND a.leida = false 
          ORDER BY a.fecha_alerta
        `;
        return res.json(alertas);

      default:
        return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
