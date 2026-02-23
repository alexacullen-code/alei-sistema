# Resumen del Sistema ALEI v4.0

## Estructura del Proyecto

```
alei-gestion/
├── api/
│   └── [...path].js          # Backend completo (1,860 líneas)
├── public/
│   └── index.html            # Frontend SPA (3,335 líneas)
├── db/
│   └── schema.sql            # Esquema PostgreSQL (451 líneas)
├── package.json              # Configuración NPM (ESM)
├── vercel.json               # Configuración Vercel
├── setup.js                  # Script de configuración
├── README.md                 # Documentación completa
├── .env.example              # Ejemplo de variables
└── .gitignore                # Archivos ignorados
```

## Funcionalidades Implementadas

### 1. Gestión de Alumnos ✅
- Registro completo con datos personales
- Contactos mejorados (padre/madre/tutor)
- Validación de cédula única
- Asignación a niveles
- Tipos de matrícula (Regular, Beca, Hermano)
- Precio especial para hermanos
- Estados: activo, inactivo, suspendido, graduado
- Ficha completa del alumno (datos, libros, pagos)

### 2. Sistema de Pagos ✅
- **Mensualidades** con cálculo automático de recargos/descuentos
- **Matrículas** con precio configurable
- **Pagos parciales** para mensualidades y libros
- **Modo POS** rápido (3 clicks)
- Múltiples métodos de pago (efectivo, transferencia, tarjeta, MercadoPago)
- Comentarios en pagos

### 3. Recargos/Descuentos Automáticos (Uruguay) ✅
- **Descuento pronto pago**: -$150 si paga antes del día 10
- **Precio normal**: entre el 11 y 15
- **Recargo**: +$150 a partir del día 16
- **Lógica especial de fechas**: pago anticipado vs atrasado
- **Hermanos**: precio fijo sin recargos ni descuentos

### 4. Gestión de Libros ✅
- Inventario completo
- Control de stock con alertas
- Asignación a alumnos
- Pagos parciales
- Precio de costo y venta
- Nivel específico

### 5. Gastos ✅
- Categorías: servicios, materiales, sueldos, alquiler, impuestos, otros
- Sistema de cuotas
- Control de pagos por cuota
- Proveedor y descripción

### 6. Niveles/Cursos ✅
- Nombre, horario, profesor, aula
- Capacidad máxima
- Conteo de alumnos

### 7. Lista de Espera ✅
- Pre-inscripciones
- Prioridad configurable
- Conversión a alumnos
- Estados: espera, contactado, convertido, cancelado

### 8. Reportes ✅
- Dashboard con estadísticas
- Flujo de caja (ingresos vs gastos)
- Estado de mensualidades por mes
- Deudas totales

### 9. Backup/Restore ✅
- Exportar por secciones (alumnos, libros, pagos, gastos, etc.)
- Backup completo
- Importar desde archivo o texto
- Validación de datos

### 10. Reset del Sistema ✅
- Doble confirmación (header + body)
- Texto "ELIMINAR" requerido
- Elimina datos del año seleccionado

### 11. WhatsApp Integration ✅
- Generador de mensajes de cobranza
- Copia automática al portapapeles
- Apertura directa de WhatsApp

### 12. Alertas ✅
- Cumpleaños
- Pagos atrasados (+30 días)
- Libros no retirados
- Stock bajo

### 13. Separación por Año Lectivo ✅
- Selector de año activo
- Datos completamente separados
- Cambio de año sin mezclar información

## API Endpoints

### Años Lectivos
- `GET /api/years` - Listar años
- `POST /api/years` - Crear año
- `PUT /api/years/:id/activate` - Activar año

### Alumnos
- `GET /api/students` - Listar alumnos
- `POST /api/students` - Crear alumno
- `PUT /api/students/:id` - Actualizar alumno
- `DELETE /api/students/:id` - Desactivar alumno
- `GET /api/students/:id/full-profile` - Ficha completa

### Pagos
- `GET /api/payments/pending` - Pagos pendientes
- `POST /api/payments/tuition` - Pago mensualidad
- `POST /api/payments/books` - Pago libro
- `POST /api/payments/quick` - Pago rápido POS
- `POST /api/payments/tuition/partial` - Pago parcial

### Libros
- `GET /api/books` - Listar libros
- `POST /api/books` - Crear libro
- `PUT /api/books/:id` - Actualizar libro
- `POST /api/books/assign` - Asignar a alumno

### Gastos
- `GET /api/expenses` - Listar gastos
- `POST /api/expenses` - Crear gasto
- `PUT /api/expenses/:id` - Actualizar gasto
- `GET /api/expenses/:id/installments` - Ver cuotas
- `PUT /api/expenses/installments/:id` - Pagar cuota

### Lista de Espera
- `GET /api/waiting-list` - Listar
- `POST /api/waiting-list` - Crear
- `PUT /api/waiting-list/:id` - Actualizar
- `POST /api/waiting-list/convert` - Convertir a alumno

### Reportes
- `GET /api/reports/dashboard` - Estadísticas
- `GET /api/reports/cash-flow` - Flujo de caja
- `GET /api/reports/monthly-status` - Estado mensualidades

### Backup/Restore
- `GET /api/backup/:entity` - Backup (students, books, payments, expenses, all)
- `POST /api/restore/:entity` - Restore

### Sistema
- `POST /api/system/reset` - Resetear sistema
- `GET /api/validate/cedula` - Validar cédula única
- `GET /api/whatsapp-message/:id` - Generar mensaje WhatsApp

## Base de Datos (PostgreSQL)

### Tablas Principales
1. `academic_years` - Años lectivos
2. `enrollment_types` - Tipos de matrícula
3. `levels` - Niveles/cursos
4. `students` - Alumnos
5. `books` - Libros
6. `book_assignments` - Asignaciones de libros
7. `book_payments` - Pagos de libros
8. `tuition_payments` - Mensualidades y matrículas
9. `tuition_partial_payments` - Pagos parciales
10. `expenses` - Gastos
11. `expense_installments` - Cuotas de gastos
12. `waiting_list` - Lista de espera
13. `alerts` - Alertas del sistema
14. `audit_logs` - Auditoría

## Configuración de Precios por Año

```sql
matricula_price: 2500
mensualidad_price: 3200
descuento_pronto_pago: 150
recargo_atraso: 150
dia_limite_descuento: 10
dia_limite_normal: 15
```

## Solución al Error ESM/CommonJS

El archivo `package.json` incluye:
```json
{
  "type": "module",
  "engines": {
    "node": "24.x"
  }
}
```

Y el archivo `vercel.json` configura:
```json
{
  "functions": {
    "api/[...path].js": {
      "maxDuration": 30
    }
  }
}
```

## Próximos Pasos

1. Ejecutar `node setup.js` para configuración inicial
2. Crear base de datos en Neon.tech
3. Ejecutar script `db/schema.sql`
4. Configurar variables de entorno
5. Desplegar en Vercel

## Soporte

Para cualquier consulta o problema, revisar:
- README.md - Documentación completa
- Logs de Vercel - Errores de deploy
- Consola del navegador - Errores frontend
