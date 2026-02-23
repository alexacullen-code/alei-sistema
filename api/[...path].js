// ============================================
// ALEI - API Serverless para Vercel
// Maneja todas las operaciones CRUD
// ============================================

import { neon } from '@neondatabase/serverless';

// Configuración de la base de datos
const sql = neon(process.env.DATABASE_URL);

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

function handleError(error, message = 'Error interno del servidor') {
  console.error('Error:', error);
  return createResponse({ error: message, details: error.message }, 500);
}

// Validar UUID
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ============================================
// AÑOS LECTIVOS
// ============================================

async function getAniosLectivos() {
  try {
    const result = await sql`SELECT * FROM anios_lectivos ORDER BY anio DESC`;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function createAnioLectivo(data) {
  try {
    const { anio, fecha_inicio, fecha_fin } = data;
    const result = await sql`
      INSERT INTO anios_lectivos (anio, fecha_inicio, fecha_fin)
      VALUES (${anio}, ${fecha_inicio}, ${fecha_fin})
      RETURNING *
    `;
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear año lectivo');
  }
}

async function setAnioActivo(id) {
  try {
    // Desactivar todos primero
    await sql`UPDATE anios_lectivos SET activo = false`;
    // Activar el seleccionado
    const result = await sql`
      UPDATE anios_lectivos SET activo = true WHERE id = ${id}
      RETURNING *
    `;
    return createResponse(result[0]);
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// NIVELES
// ============================================

async function getNiveles(anioLectivoId) {
  try {
    let result;
    if (anioLectivoId) {
      result = await sql`
        SELECT n.*, 
          (SELECT COUNT(*) FROM alumnos WHERE nivel_id = n.id AND estado = 'activo') as alumnos_count
        FROM niveles n 
        WHERE n.anio_lectivo_id = ${anioLectivoId}
        ORDER BY n.nombre
      `;
    } else {
      result = await sql`
        SELECT n.*, 
          (SELECT COUNT(*) FROM alumnos WHERE nivel_id = n.id AND estado = 'activo') as alumnos_count
        FROM niveles n 
        ORDER BY n.nombre
      `;
    }
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function createNivel(data) {
  try {
    const { anio_lectivo_id, nombre, descripcion, capacidad_maxima, cuota_mensual, horario, profesor } = data;
    const result = await sql`
      INSERT INTO niveles (anio_lectivo_id, nombre, descripcion, capacidad_maxima, cuota_mensual, horario, profesor)
      VALUES (${anio_lectivo_id}, ${nombre}, ${descripcion}, ${capacidad_maxima}, ${cuota_mensual}, ${horario}, ${profesor})
      RETURNING *
    `;
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear nivel');
  }
}

async function updateNivel(id, data) {
  try {
    const { nombre, descripcion, capacidad_maxima, cuota_mensual, horario, profesor, activo } = data;
    const result = await sql`
      UPDATE niveles 
      SET nombre = ${nombre}, descripcion = ${descripcion}, capacidad_maxima = ${capacidad_maxima},
          cuota_mensual = ${cuota_mensual}, horario = ${horario}, profesor = ${profesor}, activo = ${activo}
      WHERE id = ${id}
      RETURNING *
    `;
    return createResponse(result[0]);
  } catch (error) {
    return handleError(error, 'Error al actualizar nivel');
  }
}

async function deleteNivel(id) {
  try {
    await sql`DELETE FROM niveles WHERE id = ${id}`;
    return createResponse({ message: 'Nivel eliminado' });
  } catch (error) {
    return handleError(error, 'Error al eliminar nivel');
  }
}

// ============================================
// ALUMNOS
// ============================================

async function getAlumnos(anioLectivoId, nivelId, search) {
  try {
    let query = sql`
      SELECT a.*, n.nombre as nivel_nombre
      FROM alumnos a
      LEFT JOIN niveles n ON a.nivel_id = n.id
      WHERE 1=1
    `;
    
    if (anioLectivoId) {
      query = sql`${query} AND a.anio_lectivo_id = ${anioLectivoId}`;
    }
    
    if (nivelId) {
      query = sql`${query} AND a.nivel_id = ${nivelId}`;
    }
    
    if (search) {
      query = sql`${query} AND (
        a.nombre ILIKE ${`%${search}%`} OR 
        a.apellido ILIKE ${`%${search}%`} OR 
        a.cedula ILIKE ${`%${search}%`} OR
        a.email ILIKE ${`%${search}%`}
      )`;
    }
    
    query = sql`${query} ORDER BY a.apellido, a.nombre`;
    
    const result = await query;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function getAlumnoById(id) {
  try {
    const result = await sql`
      SELECT a.*, n.nombre as nivel_nombre
      FROM alumnos a
      LEFT JOIN niveles n ON a.nivel_id = n.id
      WHERE a.id = ${id}
    `;
    
    if (result.length === 0) {
      return createResponse({ error: 'Alumno no encontrado' }, 404);
    }
    
    // Obtener pagos del alumno
    const pagos = await sql`
      SELECT * FROM pagos WHERE alumno_id = ${id} ORDER BY created_at DESC
    `;
    
    // Obtener préstamos de libros
    const prestamos = await sql`
      SELECT pl.*, l.titulo as libro_titulo
      FROM prestamos_libros pl
      JOIN libros l ON pl.libro_id = l.id
      WHERE pl.alumno_id = ${id}
      ORDER BY pl.fecha_prestamo DESC
    `;
    
    // Calcular deuda total
    const deudaResult = await sql`
      SELECT COALESCE(SUM(saldo_pendiente), 0) as total_deuda
      FROM pagos
      WHERE alumno_id = ${id} AND estado IN ('pendiente', 'parcial')
    `;
    
    return createResponse({
      ...result[0],
      pagos,
      prestamos,
      total_deuda: deudaResult[0]?.total_deuda || 0
    });
  } catch (error) {
    return handleError(error);
  }
}

async function createAlumno(data) {
  try {
    // Verificar si la cédula ya existe
    const existing = await sql`SELECT id FROM alumnos WHERE cedula = ${data.cedula}`;
    if (existing.length > 0) {
      return createResponse({ error: 'Ya existe un alumno con esta cédula' }, 400);
    }
    
    const result = await sql`
      INSERT INTO alumnos (
        anio_lectivo_id, cedula, nombre, apellido, fecha_nacimiento,
        email, telefono, telefono_alternativo, direccion,
        nombre_tutor, telefono_tutor, email_tutor, relacion_tutor,
        nivel_id, es_hermano, grupo_hermanos, cuota_especial
      ) VALUES (
        ${data.anio_lectivo_id}, ${data.cedula}, ${data.nombre}, ${data.apellido}, ${data.fecha_nacimiento},
        ${data.email}, ${data.telefono}, ${data.telefono_alternativo}, ${data.direccion},
        ${data.nombre_tutor}, ${data.telefono_tutor}, ${data.email_tutor}, ${data.relacion_tutor},
        ${data.nivel_id}, ${data.es_hermano || false}, ${data.grupo_hermanos}, ${data.cuota_especial}
      )
      RETURNING *
    `;
    
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear alumno');
  }
}

async function updateAlumno(id, data) {
  try {
    // Verificar si la cédula ya existe en otro alumno
    if (data.cedula) {
      const existing = await sql`
        SELECT id FROM alumnos WHERE cedula = ${data.cedula} AND id != ${id}
      `;
      if (existing.length > 0) {
        return createResponse({ error: 'Ya existe otro alumno con esta cédula' }, 400);
      }
    }
    
    const result = await sql`
      UPDATE alumnos SET
        cedula = ${data.cedula},
        nombre = ${data.nombre},
        apellido = ${data.apellido},
        fecha_nacimiento = ${data.fecha_nacimiento},
        email = ${data.email},
        telefono = ${data.telefono},
        telefono_alternativo = ${data.telefono_alternativo},
        direccion = ${data.direccion},
        nombre_tutor = ${data.nombre_tutor},
        telefono_tutor = ${data.telefono_tutor},
        email_tutor = ${data.email_tutor},
        relacion_tutor = ${data.relacion_tutor},
        nivel_id = ${data.nivel_id},
        es_hermano = ${data.es_hermano},
        grupo_hermanos = ${data.grupo_hermanos},
        cuota_especial = ${data.cuota_especial},
        estado = ${data.estado}
      WHERE id = ${id}
      RETURNING *
    `;
    
    return createResponse(result[0]);
  } catch (error) {
    return handleError(error, 'Error al actualizar alumno');
  }
}

async function deleteAlumno(id) {
  try {
    await sql`DELETE FROM alumnos WHERE id = ${id}`;
    return createResponse({ message: 'Alumno eliminado' });
  } catch (error) {
    return handleError(error, 'Error al eliminar alumno');
  }
}

// ============================================
// PAGOS
// ============================================

async function getPagos(alumnoId, anioLectivoId, mes, estado) {
  try {
    let query = sql`
      SELECT p.*, a.nombre as alumno_nombre, a.apellido as alumno_apellido
      FROM pagos p
      JOIN alumnos a ON p.alumno_id = a.id
      WHERE 1=1
    `;
    
    if (alumnoId) {
      query = sql`${query} AND p.alumno_id = ${alumnoId}`;
    }
    
    if (anioLectivoId) {
      query = sql`${query} AND a.anio_lectivo_id = ${anioLectivoId}`;
    }
    
    if (mes) {
      query = sql`${query} AND p.mes = ${mes}`;
    }
    
    if (estado) {
      query = sql`${query} AND p.estado = ${estado}`;
    }
    
    query = sql`${query} ORDER BY p.created_at DESC`;
    
    const result = await query;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function createPago(data) {
  try {
    const saldoPendiente = data.monto_total - (data.descuento || 0) + (data.recargo || 0);
    
    const result = await sql`
      INSERT INTO pagos (
        alumno_id, tipo, concepto, mes, anio,
        monto_total, monto_pagado, saldo_pendiente,
        descuento, tipo_descuento, recargo, tipo_recargo,
        estado, fecha_vencimiento, comentarios
      ) VALUES (
        ${data.alumno_id}, ${data.tipo}, ${data.concepto}, ${data.mes}, ${data.anio},
        ${data.monto_total}, 0, ${saldoPendiente},
        ${data.descuento || 0}, ${data.tipo_descuento}, ${data.recargo || 0}, ${data.tipo_recargo},
        'pendiente', ${data.fecha_vencimiento}, ${data.comentarios}
      )
      RETURNING *
    `;
    
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear pago');
  }
}

async function registrarPagoParcial(data) {
  try {
    const { pago_id, monto, metodo_pago, comentarios, created_by } = data;
    
    // Obtener información del pago
    const pago = await sql`SELECT * FROM pagos WHERE id = ${pago_id}`;
    if (pago.length === 0) {
      return createResponse({ error: 'Pago no encontrado' }, 404);
    }
    
    const pagoActual = pago[0];
    const nuevoMontoPagado = parseFloat(pagoActual.monto_pagado) + parseFloat(monto);
    const nuevoSaldo = parseFloat(pagoActual.monto_total) - nuevoMontoPagado + 
                       parseFloat(pagoActual.recargo || 0) - parseFloat(pagoActual.descuento || 0);
    
    let nuevoEstado = 'parcial';
    if (nuevoSaldo <= 0) {
      nuevoEstado = 'pagado';
    }
    
    // Registrar el pago parcial
    await sql`
      INSERT INTO pagos_detalle (pago_id, monto, metodo_pago, comentarios, created_by)
      VALUES (${pago_id}, ${monto}, ${metodo_pago}, ${comentarios}, ${created_by})
    `;
    
    // Actualizar el pago principal
    const result = await sql`
      UPDATE pagos SET
        monto_pagado = ${nuevoMontoPagado},
        saldo_pendiente = ${Math.max(0, nuevoSaldo)},
        estado = ${nuevoEstado},
        fecha_pago = ${nuevoEstado === 'pagado' ? new Date() : pagoActual.fecha_pago}
      WHERE id = ${pago_id}
      RETURNING *
    `;
    
    return createResponse(result[0]);
  } catch (error) {
    return handleError(error, 'Error al registrar pago parcial');
  }
}

async function getDetallePagos(pagoId) {
  try {
    const result = await sql`
      SELECT * FROM pagos_detalle WHERE pago_id = ${pagoId} ORDER BY fecha_pago DESC
    `;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// LIBROS
// ============================================

async function getLibros(anioLectivoId, nivelId, search) {
  try {
    let query = sql`
      SELECT l.*, n.nombre as nivel_nombre
      FROM libros l
      LEFT JOIN niveles n ON l.nivel_id = n.id
      WHERE 1=1
    `;
    
    if (anioLectivoId) {
      query = sql`${query} AND l.anio_lectivo_id = ${anioLectivoId}`;
    }
    
    if (nivelId) {
      query = sql`${query} AND l.nivel_id = ${nivelId}`;
    }
    
    if (search) {
      query = sql`${query} AND (
        l.titulo ILIKE ${`%${search}%`} OR 
        l.autor ILIKE ${`%${search}%`} OR
        l.codigo ILIKE ${`%${search}%`}
      )`;
    }
    
    query = sql`${query} ORDER BY l.titulo`;
    
    const result = await query;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function createLibro(data) {
  try {
    const result = await sql`
      INSERT INTO libros (
        anio_lectivo_id, codigo, titulo, autor, editorial,
        materia, nivel_id, precio, stock_total, stock_disponible, descripcion
      ) VALUES (
        ${data.anio_lectivo_id}, ${data.codigo}, ${data.titulo}, ${data.autor}, ${data.editorial},
        ${data.materia}, ${data.nivel_id}, ${data.precio}, ${data.stock_total}, ${data.stock_total}, ${data.descripcion}
      )
      RETURNING *
    `;
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear libro');
  }
}

async function updateLibro(id, data) {
  try {
    const result = await sql`
      UPDATE libros SET
        codigo = ${data.codigo},
        titulo = ${data.titulo},
        autor = ${data.autor},
        editorial = ${data.editorial},
        materia = ${data.materia},
        nivel_id = ${data.nivel_id},
        precio = ${data.precio},
        stock_total = ${data.stock_total},
        stock_disponible = ${data.stock_disponible},
        descripcion = ${data.descripcion},
        activo = ${data.activo}
      WHERE id = ${id}
      RETURNING *
    `;
    return createResponse(result[0]);
  } catch (error) {
    return handleError(error, 'Error al actualizar libro');
  }
}

async function deleteLibro(id) {
  try {
    await sql`DELETE FROM libros WHERE id = ${id}`;
    return createResponse({ message: 'Libro eliminado' });
  } catch (error) {
    return handleError(error, 'Error al eliminar libro');
  }
}

// ============================================
// PRÉSTAMOS DE LIBROS
// ============================================

async function getPrestamos(alumnoId, libroId, estado) {
  try {
    let query = sql`
      SELECT pl.*, a.nombre as alumno_nombre, a.apellido as alumno_apellido, l.titulo as libro_titulo
      FROM prestamos_libros pl
      JOIN alumnos a ON pl.alumno_id = a.id
      JOIN libros l ON pl.libro_id = l.id
      WHERE 1=1
    `;
    
    if (alumnoId) {
      query = sql`${query} AND pl.alumno_id = ${alumnoId}`;
    }
    
    if (libroId) {
      query = sql`${query} AND pl.libro_id = ${libroId}`;
    }
    
    if (estado) {
      query = sql`${query} AND pl.estado = ${estado}`;
    }
    
    query = sql`${query} ORDER BY pl.fecha_prestamo DESC`;
    
    const result = await query;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function createPrestamo(data) {
  try {
    // Verificar stock disponible
    const libro = await sql`SELECT stock_disponible FROM libros WHERE id = ${data.libro_id}`;
    if (libro.length === 0 || libro[0].stock_disponible <= 0) {
      return createResponse({ error: 'No hay stock disponible' }, 400);
    }
    
    // Crear préstamo
    const result = await sql`
      INSERT INTO prestamos_libros (alumno_id, libro_id, fecha_prestamo, fecha_devolucion_esperada, observaciones)
      VALUES (${data.alumno_id}, ${data.libro_id}, ${data.fecha_prestamo}, ${data.fecha_devolucion_esperada}, ${data.observaciones})
      RETURNING *
    `;
    
    // Actualizar stock
    await sql`
      UPDATE libros SET stock_disponible = stock_disponible - 1 WHERE id = ${data.libro_id}
    `;
    
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear préstamo');
  }
}

async function devolverLibro(id, data) {
  try {
    const result = await sql`
      UPDATE prestamos_libros 
      SET estado = 'devuelto', fecha_devolucion_real = ${data.fecha_devolucion || new Date()}, observaciones = ${data.observaciones}
      WHERE id = ${id}
      RETURNING *
    `;
    
    // Restaurar stock
    if (result.length > 0) {
      await sql`
        UPDATE libros SET stock_disponible = stock_disponible + 1 WHERE id = ${result[0].libro_id}
      `;
    }
    
    return createResponse(result[0]);
  } catch (error) {
    return handleError(error, 'Error al registrar devolución');
  }
}

// ============================================
// GASTOS
// ============================================

async function getGastos(anioLectivoId, categoria, estado) {
  try {
    let query = sql`SELECT * FROM gastos WHERE 1=1`;
    
    if (anioLectivoId) {
      query = sql`${query} AND anio_lectivo_id = ${anioLectivoId}`;
    }
    
    if (categoria) {
      query = sql`${query} AND categoria = ${categoria}`;
    }
    
    if (estado) {
      query = sql`${query} AND estado = ${estado}`;
    }
    
    query = sql`${query} ORDER BY fecha_gasto DESC`;
    
    const result = await query;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function createGasto(data) {
  try {
    const result = await sql`
      INSERT INTO gastos (
        anio_lectivo_id, concepto, categoria, proveedor,
        monto_total, es_cuota, numero_cuotas, cuota_actual,
        fecha_gasto, fecha_vencimiento, numero_comprobante, tipo_comprobante, comentarios
      ) VALUES (
        ${data.anio_lectivo_id}, ${data.concepto}, ${data.categoria}, ${data.proveedor},
        ${data.monto_total}, ${data.es_cuota || false}, ${data.numero_cuotas || 1}, 1,
        ${data.fecha_gasto}, ${data.fecha_vencimiento}, ${data.numero_comprobante}, ${data.tipo_comprobante}, ${data.comentarios}
      )
      RETURNING *
    `;
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear gasto');
  }
}

async function registrarPagoGasto(data) {
  try {
    const { gasto_id, monto, metodo_pago, comentarios, created_by } = data;
    
    // Obtener información del gasto
    const gasto = await sql`SELECT * FROM gastos WHERE id = ${gasto_id}`;
    if (gasto.length === 0) {
      return createResponse({ error: 'Gasto no encontrado' }, 404);
    }
    
    const gastoActual = gasto[0];
    const nuevoMontoPagado = parseFloat(gastoActual.monto_pagado) + parseFloat(monto);
    const cuotaActual = (gastoActual.cuota_actual || 1) + 1;
    
    let nuevoEstado = 'parcial';
    if (nuevoMontoPagado >= parseFloat(gastoActual.monto_total)) {
      nuevoEstado = 'pagado';
    }
    
    // Registrar el pago
    await sql`
      INSERT INTO gastos_detalle (gasto_id, monto, metodo_pago, numero_cuota, comentarios, created_by)
      VALUES (${gasto_id}, ${monto}, ${metodo_pago}, ${gastoActual.cuota_actual}, ${comentarios}, ${created_by})
    `;
    
    // Actualizar el gasto
    const result = await sql`
      UPDATE gastos SET
        monto_pagado = ${nuevoMontoPagado},
        estado = ${nuevoEstado},
        cuota_actual = ${cuotaActual}
      WHERE id = ${gasto_id}
      RETURNING *
    `;
    
    return createResponse(result[0]);
  } catch (error) {
    return handleError(error, 'Error al registrar pago de gasto');
  }
}

// ============================================
// PRE-INSCRIPCIONES
// ============================================

async function getPreinscripciones(anioLectivoId, estado) {
  try {
    let query = sql`
      SELECT p.*, n.nombre as nivel_nombre
      FROM preinscripciones p
      LEFT JOIN niveles n ON p.nivel_interesado_id = n.id
      WHERE 1=1
    `;
    
    if (anioLectivoId) {
      query = sql`${query} AND p.anio_lectivo_id = ${anioLectivoId}`;
    }
    
    if (estado) {
      query = sql`${query} AND p.estado = ${estado}`;
    }
    
    query = sql`${query} ORDER BY p.created_at DESC`;
    
    const result = await query;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function createPreinscripcion(data) {
  try {
    const result = await sql`
      INSERT INTO preinscripciones (
        anio_lectivo_id, nombre, apellido, cedula, fecha_nacimiento,
        email, telefono, telefono_alternativo, nombre_tutor, telefono_tutor,
        nivel_interesado_id, horario_preferido, fuente, comentarios
      ) VALUES (
        ${data.anio_lectivo_id}, ${data.nombre}, ${data.apellido}, ${data.cedula}, ${data.fecha_nacimiento},
        ${data.email}, ${data.telefono}, ${data.telefono_alternativo}, ${data.nombre_tutor}, ${data.telefono_tutor},
        ${data.nivel_interesado_id}, ${data.horario_preferido}, ${data.fuente}, ${data.comentarios}
      )
      RETURNING *
    `;
    return createResponse(result[0], 201);
  } catch (error) {
    return handleError(error, 'Error al crear pre-inscripción');
  }
}

async function convertirPreinscripcion(id, data) {
  try {
    // Crear alumno
    const alumnoResult = await sql`
      INSERT INTO alumnos (
        anio_lectivo_id, cedula, nombre, apellido, fecha_nacimiento,
        email, telefono, telefono_alternativo,
        nombre_tutor, telefono_tutor, nivel_id
      ) VALUES (
        ${data.anio_lectivo_id}, ${data.cedula}, ${data.nombre}, ${data.apellido}, ${data.fecha_nacimiento},
        ${data.email}, ${data.telefono}, ${data.telefono_alternativo},
        ${data.nombre_tutor}, ${data.telefono_tutor}, ${data.nivel_id}
      )
      RETURNING *
    `;
    
    // Actualizar pre-inscripción
    await sql`
      UPDATE preinscripciones 
      SET estado = 'convertido', fecha_conversion = ${new Date()}, alumno_id = ${alumnoResult[0].id}
      WHERE id = ${id}
    `;
    
    return createResponse(alumnoResult[0], 201);
  } catch (error) {
    return handleError(error, 'Error al convertir pre-inscripción');
  }
}

// ============================================
// DASHBOARD Y REPORTES
// ============================================

async function getDashboard(anioLectivoId, mes, anio) {
  try {
    const anioActual = anio || new Date().getFullYear();
    const mesActual = mes || new Date().getMonth() + 1;
    
    // Total de alumnos activos
    const alumnosCount = await sql`
      SELECT COUNT(*) as total FROM alumnos 
      WHERE anio_lectivo_id = ${anioLectivoId} AND estado = 'activo'
    `;
    
    // Pagos del mes
    const pagosMes = await sql`
      SELECT 
        COUNT(*) as total_pagos,
        COALESCE(SUM(monto_pagado), 0) as total_recaudado,
        COALESCE(SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END), 0) as pagos_completos,
        COALESCE(SUM(CASE WHEN estado IN ('pendiente', 'parcial') THEN 1 ELSE 0 END), 0) as pagos_pendientes
      FROM pagos
      WHERE mes = ${mesActual} AND anio = ${anioActual}
    `;
    
    // Deuda total
    const deudaTotal = await sql`
      SELECT COALESCE(SUM(saldo_pendiente), 0) as total
      FROM pagos
      WHERE estado IN ('pendiente', 'parcial')
    `;
    
    // Gastos del mes
    const gastosMes = await sql`
      SELECT COALESCE(SUM(monto_pagado), 0) as total
      FROM gastos
      WHERE EXTRACT(MONTH FROM fecha_gasto) = ${mesActual} 
      AND EXTRACT(YEAR FROM fecha_gasto) = ${anioActual}
    `;
    
    // Alumnos con deuda
    const alumnosDeuda = await sql`
      SELECT COUNT(DISTINCT alumno_id) as total
      FROM pagos
      WHERE estado IN ('pendiente', 'parcial')
    `;
    
    // Libros prestados
    const librosPrestados = await sql`
      SELECT COUNT(*) as total FROM prestamos_libros WHERE estado = 'prestado'
    `;
    
    // Pre-inscripciones pendientes
    const preinscripciones = await sql`
      SELECT COUNT(*) as total FROM preinscripciones 
      WHERE anio_lectivo_id = ${anioLectivoId} AND estado = 'pendiente'
    `;
    
    return createResponse({
      alumnos_activos: parseInt(alumnosCount[0]?.total) || 0,
      pagos_mes: {
        total: parseInt(pagosMes[0]?.total_pagos) || 0,
        recaudado: parseFloat(pagosMes[0]?.total_recaudado) || 0,
        completos: parseInt(pagosMes[0]?.pagos_completos) || 0,
        pendientes: parseInt(pagosMes[0]?.pagos_pendientes) || 0
      },
      deuda_total: parseFloat(deudaTotal[0]?.total) || 0,
      gastos_mes: parseFloat(gastosMes[0]?.total) || 0,
      alumnos_con_deuda: parseInt(alumnosDeuda[0]?.total) || 0,
      libros_prestados: parseInt(librosPrestados[0]?.total) || 0,
      preinscripciones_pendientes: parseInt(preinscripciones[0]?.total) || 0,
      flujo_caja: (parseFloat(pagosMes[0]?.total_recaudado) || 0) - (parseFloat(gastosMes[0]?.total) || 0)
    });
  } catch (error) {
    return handleError(error);
  }
}

async function getEstadoCuentaMensual(anioLectivoId, mes, anio) {
  try {
    const result = await sql`
      SELECT 
        a.id,
        a.nombre,
        a.apellido,
        a.cedula,
        n.nombre as nivel_nombre,
        COALESCE(p.monto_total, 0) as monto_cuota,
        COALESCE(p.monto_pagado, 0) as monto_pagado,
        COALESCE(p.saldo_pendiente, 0) as saldo_pendiente,
        p.estado,
        p.fecha_pago
      FROM alumnos a
      LEFT JOIN niveles n ON a.nivel_id = n.id
      LEFT JOIN pagos p ON a.id = p.alumno_id AND p.mes = ${mes} AND p.anio = ${anio} AND p.tipo = 'mensualidad'
      WHERE a.anio_lectivo_id = ${anioLectivoId} AND a.estado = 'activo'
      ORDER BY a.apellido, a.nombre
    `;
    
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function getPagosAtrasados(dias) {
  try {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    
    const result = await sql`
      SELECT 
        p.*,
        a.nombre as alumno_nombre,
        a.apellido as alumno_apellido,
        a.telefono,
        a.telefono_tutor
      FROM pagos p
      JOIN alumnos a ON p.alumno_id = a.id
      WHERE p.estado IN ('pendiente', 'parcial')
      AND p.fecha_vencimiento < ${fechaLimite}
      ORDER BY p.fecha_vencimiento ASC
    `;
    
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// CONFIGURACIÓN
// ============================================

async function getConfiguracion() {
  try {
    const result = await sql`SELECT * FROM configuracion`;
    const config = {};
    result.forEach(row => {
      config[row.clave] = row.valor;
    });
    return createResponse(config);
  } catch (error) {
    return handleError(error);
  }
}

async function updateConfiguracion(data) {
  try {
    for (const [clave, valor] of Object.entries(data)) {
      await sql`
        UPDATE configuracion SET valor = ${valor}, updated_at = CURRENT_TIMESTAMP
        WHERE clave = ${clave}
      `;
    }
    return createResponse({ message: 'Configuración actualizada' });
  } catch (error) {
    return handleError(error, 'Error al actualizar configuración');
  }
}

// ============================================
// BACKUP Y RESTORE
// ============================================

async function backupData(anioLectivoId) {
  try {
    const backup = {
      anio_lectivo: await sql`SELECT * FROM anios_lectivos WHERE id = ${anioLectivoId}`,
      niveles: await sql`SELECT * FROM niveles WHERE anio_lectivo_id = ${anioLectivoId}`,
      alumnos: await sql`SELECT * FROM alumnos WHERE anio_lectivo_id = ${anioLectivoId}`,
      libros: await sql`SELECT * FROM libros WHERE anio_lectivo_id = ${anioLectivoId}`,
      pagos: await sql`
        SELECT p.* FROM pagos p
        JOIN alumnos a ON p.alumno_id = a.id
        WHERE a.anio_lectivo_id = ${anioLectivoId}
      `,
      gastos: await sql`SELECT * FROM gastos WHERE anio_lectivo_id = ${anioLectivoId}`,
      examenes: await sql`SELECT * FROM examenes WHERE anio_lectivo_id = ${anioLectivoId}`,
      preinscripciones: await sql`SELECT * FROM preinscripciones WHERE anio_lectivo_id = ${anioLectivoId}`,
      prestamos: await sql`
        SELECT pl.* FROM prestamos_libros pl
        JOIN alumnos a ON pl.alumno_id = a.id
        WHERE a.anio_lectivo_id = ${anioLectivoId}
      `,
      fecha_backup: new Date().toISOString()
    };
    
    return createResponse(backup);
  } catch (error) {
    return handleError(error, 'Error al generar backup');
  }
}

async function restoreData(data, anioLectivoId) {
  try {
    // Esta función requiere lógica más compleja para manejar dependencias
    // y evitar duplicados. Por ahora, solo insertamos datos básicos.
    
    const results = {
      niveles: 0,
      alumnos: 0,
      libros: 0,
      pagos: 0,
      gastos: 0,
      preinscripciones: 0
    };
    
    // Restaurar niveles
    if (data.niveles && Array.isArray(data.niveles)) {
      for (const nivel of data.niveles) {
        try {
          await sql`
            INSERT INTO niveles (anio_lectivo_id, nombre, descripcion, capacidad_maxima, cuota_mensual, horario, profesor)
            VALUES (${anioLectivoId}, ${nivel.nombre}, ${nivel.descripcion}, ${nivel.capacidad_maxima}, ${nivel.cuota_mensual}, ${nivel.horario}, ${nivel.profesor})
          `;
          results.niveles++;
        } catch (e) {
          console.error('Error al restaurar nivel:', e);
        }
      }
    }
    
    // Restaurar alumnos
    if (data.alumnos && Array.isArray(data.alumnos)) {
      for (const alumno of data.alumnos) {
        try {
          await sql`
            INSERT INTO alumnos (anio_lectivo_id, cedula, nombre, apellido, fecha_nacimiento, email, telefono, direccion)
            VALUES (${anioLectivoId}, ${alumno.cedula}, ${alumno.nombre}, ${alumno.apellido}, ${alumno.fecha_nacimiento}, ${alumno.email}, ${alumno.telefono}, ${alumno.direccion})
          `;
          results.alumnos++;
        } catch (e) {
          console.error('Error al restaurar alumno:', e);
        }
      }
    }
    
    return createResponse({ message: 'Restore completado', results });
  } catch (error) {
    return handleError(error, 'Error al restaurar datos');
  }
}

// ============================================
// RESET SISTEMA
// ============================================

async function resetSistema(anioLectivoId) {
  try {
    // Eliminar datos del año lectivo
    await sql`DELETE FROM prestamos_libros WHERE alumno_id IN (SELECT id FROM alumnos WHERE anio_lectivo_id = ${anioLectivoId})`;
    await sql`DELETE FROM pagos_detalle WHERE pago_id IN (SELECT id FROM pagos WHERE alumno_id IN (SELECT id FROM alumnos WHERE anio_lectivo_id = ${anioLectivoId}))`;
    await sql`DELETE FROM pagos WHERE alumno_id IN (SELECT id FROM alumnos WHERE anio_lectivo_id = ${anioLectivoId})`;
    await sql`DELETE FROM examenes_notas WHERE examen_id IN (SELECT id FROM examenes WHERE anio_lectivo_id = ${anioLectivoId})`;
    await sql`DELETE FROM examenes WHERE anio_lectivo_id = ${anioLectivoId}`;
    await sql`DELETE FROM gastos_detalle WHERE gasto_id IN (SELECT id FROM gastos WHERE anio_lectivo_id = ${anioLectivoId})`;
    await sql`DELETE FROM gastos WHERE anio_lectivo_id = ${anioLectivoId}`;
    await sql`DELETE FROM libros WHERE anio_lectivo_id = ${anioLectivoId}`;
    await sql`DELETE FROM alumnos WHERE anio_lectivo_id = ${anioLectivoId}`;
    await sql`DELETE FROM preinscripciones WHERE anio_lectivo_id = ${anioLectivoId}`;
    await sql`DELETE FROM niveles WHERE anio_lectivo_id = ${anioLectivoId}`;
    await sql`DELETE FROM alertas WHERE anio_lectivo_id = ${anioLectivoId}`;
    
    return createResponse({ message: 'Sistema reseteado correctamente' });
  } catch (error) {
    return handleError(error, 'Error al resetear sistema');
  }
}

// ============================================
// BÚSQUEDA GLOBAL
// ============================================

async function busquedaGlobal(query, anioLectivoId) {
  try {
    const searchTerm = `%${query}%`;
    
    const [alumnos, libros, pagos] = await Promise.all([
      sql`
        SELECT 'alumno' as tipo, id, nombre, apellido, cedula, email, telefono
        FROM alumnos
        WHERE anio_lectivo_id = ${anioLectivoId}
        AND (nombre ILIKE ${searchTerm} OR apellido ILIKE ${searchTerm} OR cedula ILIKE ${searchTerm} OR email ILIKE ${searchTerm})
        LIMIT 10
      `,
      sql`
        SELECT 'libro' as tipo, id, titulo, autor, codigo
        FROM libros
        WHERE anio_lectivo_id = ${anioLectivoId}
        AND (titulo ILIKE ${searchTerm} OR autor ILIKE ${searchTerm} OR codigo ILIKE ${searchTerm})
        LIMIT 10
      `,
      sql`
        SELECT 'pago' as tipo, p.id, p.concepto, p.estado, a.nombre as alumno_nombre, a.apellido as alumno_apellido
        FROM pagos p
        JOIN alumnos a ON p.alumno_id = a.id
        WHERE a.anio_lectivo_id = ${anioLectivoId}
        AND (p.concepto ILIKE ${searchTerm} OR a.nombre ILIKE ${searchTerm} OR a.apellido ILIKE ${searchTerm})
        LIMIT 10
      `
    ]);
    
    return createResponse({
      alumnos,
      libros,
      pagos,
      total: alumnos.length + libros.length + pagos.length
    });
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// CAJA DIARIA
// ============================================

async function getCajaDiaria(fecha) {
  try {
    const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
    
    const ingresos = await sql`
      SELECT 
        pd.*,
        p.concepto,
        p.tipo,
        a.nombre as alumno_nombre,
        a.apellido as alumno_apellido
      FROM pagos_detalle pd
      JOIN pagos p ON pd.pago_id = p.id
      JOIN alumnos a ON p.alumno_id = a.id
      WHERE DATE(pd.fecha_pago) = ${fechaConsulta}
      ORDER BY pd.fecha_pago DESC
    `;
    
    const egresos = await sql`
      SELECT *
      FROM gastos_detalle gd
      JOIN gastos g ON gd.gasto_id = g.id
      WHERE DATE(gd.fecha_pago) = ${fechaConsulta}
      ORDER BY gd.fecha_pago DESC
    `;
    
    const totalIngresos = ingresos.reduce((sum, i) => sum + parseFloat(i.monto), 0);
    const totalEgresos = egresos.reduce((sum, e) => sum + parseFloat(e.monto), 0);
    
    return createResponse({
      fecha: fechaConsulta,
      ingresos,
      egresos,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      balance: totalIngresos - totalEgresos
    });
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// CAJA RÁPIDA (POS)
// ============================================

async function cajaRapida(data) {
  try {
    const { alumno_id, concepto, tipo, monto, metodo_pago, comentarios } = data;
    
    // Crear el pago
    const pagoResult = await sql`
      INSERT INTO pagos (
        alumno_id, tipo, concepto, monto_total, monto_pagado, saldo_pendiente, estado, fecha_pago
      ) VALUES (
        ${alumno_id}, ${tipo}, ${concepto}, ${monto}, ${monto}, 0, 'pagado', ${new Date()}
      )
      RETURNING *
    `;
    
    // Registrar el detalle
    await sql`
      INSERT INTO pagos_detalle (pago_id, monto, metodo_pago, comentarios)
      VALUES (${pagoResult[0].id}, ${monto}, ${metodo_pago}, ${comentarios})
    `;
    
    return createResponse(pagoResult[0], 201);
  } catch (error) {
    return handleError(error, 'Error en caja rápida');
  }
}

// ============================================
// MENSAJE WHATSAPP
// ============================================

async function generarMensajeWhatsApp(alumnoId, tipo) {
  try {
    const alumno = await sql`
      SELECT a.*, 
        COALESCE(SUM(p.saldo_pendiente), 0) as deuda_total
      FROM alumnos a
      LEFT JOIN pagos p ON a.id = p.alumno_id AND p.estado IN ('pendiente', 'parcial')
      WHERE a.id = ${alumnoId}
      GROUP BY a.id
    `;
    
    if (alumno.length === 0) {
      return createResponse({ error: 'Alumno no encontrado' }, 404);
    }
    
    const a = alumno[0];
    let mensaje = '';
    
    if (tipo === 'cobranza') {
      mensaje = `Hola ${a.nombre_tutor || a.nombre}, le recordamos que ${a.nombre} ${a.apellido} tiene pendiente un pago de $${a.deuda_total} en el instituto. Por favor, regularice su situación. Gracias.`;
    } else if (tipo === 'bienvenida') {
      mensaje = `Hola ${a.nombre_tutor || a.nombre}, bienvenido/a al instituto. ${a.nombre} ${a.apellido} ha sido matriculado/a exitosamente.`;
    } else if (tipo === 'recordatorio') {
      mensaje = `Hola ${a.nombre_tutor || a.nombre}, le recordamos que la mensualidad de ${a.nombre} ${a.apellido} vence pronto. Evite recargos pagando antes del día 10.`;
    }
    
    return createResponse({ mensaje, telefono: a.telefono_tutor || a.telefono });
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// ALERTAS
// ============================================

async function getAlertas(anioLectivoId, soloNoLeidas = false) {
  try {
    let query = sql`SELECT * FROM alertas WHERE anio_lectivo_id = ${anioLectivoId}`;
    
    if (soloNoLeidas) {
      query = sql`${query} AND leida = false`;
    }
    
    query = sql`${query} ORDER BY created_at DESC`;
    
    const result = await query;
    return createResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function marcarAlertaLeida(id) {
  try {
    await sql`UPDATE alertas SET leida = true WHERE id = ${id}`;
    return createResponse({ message: 'Alerta marcada como leída' });
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(request) {
  // Manejar CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const searchParams = url.searchParams;
  
  try {
    // Obtener año lectivo activo si no se especifica
    let anioLectivoId = searchParams.get('anio_lectivo_id');
    if (!anioLectivoId) {
      const anioActivo = await sql`SELECT id FROM anios_lectivos WHERE activo = true LIMIT 1`;
      if (anioActivo.length > 0) {
        anioLectivoId = anioActivo[0].id;
      }
    }
    
    // ============================================
    // RUTAS: AÑOS LECTIVOS
    // ============================================
    if (path === 'anios-lectivos') {
      if (request.method === 'GET') return await getAniosLectivos();
      if (request.method === 'POST') return await createAnioLectivo(await request.json());
    }
    
    if (path.startsWith('anios-lectivos/') && path.endsWith('/activar')) {
      const id = path.split('/')[1];
      if (request.method === 'PUT') return await setAnioActivo(id);
    }
    
    // ============================================
    // RUTAS: NIVELES
    // ============================================
    if (path === 'niveles') {
      if (request.method === 'GET') return await getNiveles(anioLectivoId);
      if (request.method === 'POST') return await createNivel(await request.json());
    }
    
    if (path.startsWith('niveles/')) {
      const id = path.split('/')[1];
      if (request.method === 'PUT') return await updateNivel(id, await request.json());
      if (request.method === 'DELETE') return await deleteNivel(id);
    }
    
    // ============================================
    // RUTAS: ALUMNOS
    // ============================================
    if (path === 'alumnos') {
      if (request.method === 'GET') {
        const search = searchParams.get('search');
        const nivelId = searchParams.get('nivel_id');
        return await getAlumnos(anioLectivoId, nivelId, search);
      }
      if (request.method === 'POST') return await createAlumno(await request.json());
    }
    
    if (path.startsWith('alumnos/')) {
      const id = path.split('/')[1];
      if (request.method === 'GET') return await getAlumnoById(id);
      if (request.method === 'PUT') return await updateAlumno(id, await request.json());
      if (request.method === 'DELETE') return await deleteAlumno(id);
    }
    
    // ============================================
    // RUTAS: PAGOS
    // ============================================
    if (path === 'pagos') {
      if (request.method === 'GET') {
        const alumnoId = searchParams.get('alumno_id');
        const mes = searchParams.get('mes');
        const anio = searchParams.get('anio');
        const estado = searchParams.get('estado');
        return await getPagos(alumnoId, anioLectivoId, mes, estado);
      }
      if (request.method === 'POST') return await createPago(await request.json());
    }
    
    if (path === 'pagos/parcial') {
      if (request.method === 'POST') return await registrarPagoParcial(await request.json());
    }
    
    if (path.startsWith('pagos/') && path.endsWith('/detalle')) {
      const id = path.split('/')[1];
      if (request.method === 'GET') return await getDetallePagos(id);
    }
    
    // ============================================
    // RUTAS: LIBROS
    // ============================================
    if (path === 'libros') {
      if (request.method === 'GET') {
        const search = searchParams.get('search');
        const nivelId = searchParams.get('nivel_id');
        return await getLibros(anioLectivoId, nivelId, search);
      }
      if (request.method === 'POST') return await createLibro(await request.json());
    }
    
    if (path.startsWith('libros/')) {
      const id = path.split('/')[1];
      if (request.method === 'PUT') return await updateLibro(id, await request.json());
      if (request.method === 'DELETE') return await deleteLibro(id);
    }
    
    // ============================================
    // RUTAS: PRÉSTAMOS
    // ============================================
    if (path === 'prestamos') {
      if (request.method === 'GET') {
        const alumnoId = searchParams.get('alumno_id');
        const estado = searchParams.get('estado');
        return await getPrestamos(alumnoId, null, estado);
      }
      if (request.method === 'POST') return await createPrestamo(await request.json());
    }
    
    if (path.startsWith('prestamos/') && path.endsWith('/devolver')) {
      const id = path.split('/')[1];
      if (request.method === 'PUT') return await devolverLibro(id, await request.json());
    }
    
    // ============================================
    // RUTAS: GASTOS
    // ============================================
    if (path === 'gastos') {
      if (request.method === 'GET') {
        const categoria = searchParams.get('categoria');
        const estado = searchParams.get('estado');
        return await getGastos(anioLectivoId, categoria, estado);
      }
      if (request.method === 'POST') return await createGasto(await request.json());
    }
    
    if (path === 'gastos/pagar') {
      if (request.method === 'POST') return await registrarPagoGasto(await request.json());
    }
    
    // ============================================
    // RUTAS: PRE-INSCRIPCIONES
    // ============================================
    if (path === 'preinscripciones') {
      if (request.method === 'GET') {
        const estado = searchParams.get('estado');
        return await getPreinscripciones(anioLectivoId, estado);
      }
      if (request.method === 'POST') return await createPreinscripcion(await request.json());
    }
    
    if (path.startsWith('preinscripciones/') && path.endsWith('/convertir')) {
      const id = path.split('/')[1];
      if (request.method === 'POST') return await convertirPreinscripcion(id, await request.json());
    }
    
    // ============================================
    // RUTAS: DASHBOARD Y REPORTES
    // ============================================
    if (path === 'dashboard') {
      if (request.method === 'GET') {
        const mes = searchParams.get('mes');
        const anio = searchParams.get('anio');
        return await getDashboard(anioLectivoId, mes, anio);
      }
    }
    
    if (path === 'estado-cuenta-mensual') {
      if (request.method === 'GET') {
        const mes = searchParams.get('mes');
        const anio = searchParams.get('anio');
        return await getEstadoCuentaMensual(anioLectivoId, mes, anio);
      }
    }
    
    if (path === 'pagos-atrasados') {
      if (request.method === 'GET') {
        const dias = searchParams.get('dias') || 30;
        return await getPagosAtrasados(dias);
      }
    }
    
    // ============================================
    // RUTAS: CONFIGURACIÓN
    // ============================================
    if (path === 'configuracion') {
      if (request.method === 'GET') return await getConfiguracion();
      if (request.method === 'PUT') return await updateConfiguracion(await request.json());
    }
    
    // ============================================
    // RUTAS: BACKUP Y RESTORE
    // ============================================
    if (path === 'backup') {
      if (request.method === 'GET') return await backupData(anioLectivoId);
    }
    
    if (path === 'restore') {
      if (request.method === 'POST') return await restoreData(await request.json(), anioLectivoId);
    }
    
    // ============================================
    // RUTAS: RESET
    // ============================================
    if (path === 'reset') {
      if (request.method === 'POST') return await resetSistema(anioLectivoId);
    }
    
    // ============================================
    // RUTAS: BÚSQUEDA
    // ============================================
    if (path === 'buscar') {
      if (request.method === 'GET') {
        const q = searchParams.get('q');
        return await busquedaGlobal(q, anioLectivoId);
      }
    }
    
    // ============================================
    // RUTAS: CAJA
    // ============================================
    if (path === 'caja-diaria') {
      if (request.method === 'GET') {
        const fecha = searchParams.get('fecha');
        return await getCajaDiaria(fecha);
      }
    }
    
    if (path === 'caja-rapida') {
      if (request.method === 'POST') return await cajaRapida(await request.json());
    }
    
    // ============================================
    // RUTAS: WHATSAPP
    // ============================================
    if (path.startsWith('whatsapp/')) {
      const alumnoId = path.split('/')[1];
      const tipo = searchParams.get('tipo') || 'cobranza';
      if (request.method === 'GET') return await generarMensajeWhatsApp(alumnoId, tipo);
    }
    
    // ============================================
    // RUTAS: ALERTAS
    // ============================================
    if (path === 'alertas') {
      if (request.method === 'GET') {
        const soloNoLeidas = searchParams.get('no_leidas') === 'true';
        return await getAlertas(anioLectivoId, soloNoLeidas);
      }
    }
    
    if (path.startsWith('alertas/') && path.endsWith('/leer')) {
      const id = path.split('/')[1];
      if (request.method === 'PUT') return await marcarAlertaLeida(id);
    }
    
    // Ruta no encontrada
    return createResponse({ error: 'Ruta no encontrada', path }, 404);
    
  } catch (error) {
    return handleError(error);
  }
}
