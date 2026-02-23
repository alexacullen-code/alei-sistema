# ALEI - Sistema de Gestión Escolar v4.0

Sistema completo de gestión para institutos de inglés, con soporte para múltiples años lectivos, control de pagos con recargos/descuentos automáticos, gestión de libros, gastos, lista de espera y más.

## Características Principales

- **Gestión de Alumnos**: Registro completo con contactos, niveles, tipos de matrícula
- **Sistema de Pagos**: Matrículas y mensualidades con recargos/descuentos automáticos
- **Pagos Parciales**: Soporte para pagos parciales de libros y mensualidades
- **Hermanos**: Precios especiales para hermanos sin recargos ni descuentos
- **Libros**: Inventario, asignación a alumnos, control de stock
- **Gastos**: Registro de gastos con soporte para cuotas
- **Lista de Espera**: Pre-inscripciones y conversión a alumnos
- **Reportes**: Flujo de caja, estado de mensualidades, estadísticas
- **Backup/Restore**: Exportar e importar datos por secciones
- **Modo POS**: Pantalla rápida para registrar pagos
- **WhatsApp**: Generador de mensajes de cobranza
- **Alertas**: Notificaciones de cumpleaños, pagos atrasados, stock bajo
- **Separación por Año**: Datos completamente separados por año lectivo

## Tecnología

- **Frontend**: Vanilla JavaScript SPA
- **Backend**: Vercel Serverless Functions (Node.js 24.x, ESM)
- **Base de Datos**: PostgreSQL (Neon.tech)
- **Despliegue**: Vercel

## Instalación Local

1. **Clonar el repositorio**:
```bash
git clone <repo-url>
cd alei-gestion
```

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno**:
Crear archivo `.env`:
```
DATABASE_URL=postgresql://usuario:password@host:puerto/database
```

4. **Crear base de datos**:
Ejecutar el script `db/schema.sql` en tu base de datos PostgreSQL.

5. **Iniciar servidor de desarrollo**:
```bash
npm run dev
```

## Despliegue en Vercel

### 1. Preparar el proyecto

Asegúrate de que los archivos estén correctamente estructurados:
```
alei-gestion/
├── api/
│   └── [...path].js
├── public/
│   └── index.html
├── db/
│   └── schema.sql
├── package.json
├── vercel.json
└── README.md
```

### 2. Configurar Vercel

1. Crear cuenta en [vercel.com](https://vercel.com)
2. Conectar con tu repositorio GitHub/GitLab
3. Importar el proyecto

### 3. Variables de Entorno

En el dashboard de Vercel, ir a Settings > Environment Variables y agregar:
- `DATABASE_URL`: URL de conexión a PostgreSQL (Neon.tech)

### 4. Deploy

```bash
vercel --prod
```

### 5. Configurar Neon.tech

1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear un nuevo proyecto
3. Copiar la cadena de conexión
4. Pegar en las variables de entorno de Vercel

## Estructura del Proyecto

### Backend (API)

Todas las rutas están en `api/[...path].js`:

- `GET /api/years` - Listar años lectivos
- `POST /api/years` - Crear año lectivo
- `PUT /api/years/:id/activate` - Activar año

- `GET /api/students` - Listar alumnos
- `POST /api/students` - Crear alumno
- `PUT /api/students/:id` - Actualizar alumno
- `GET /api/students/:id/full-profile` - Ficha completa

- `GET /api/payments/pending` - Pagos pendientes
- `POST /api/payments/tuition` - Pago de mensualidad
- `POST /api/payments/books` - Pago de libro
- `POST /api/payments/quick` - Pago rápido (POS)

- `GET /api/books` - Listar libros
- `POST /api/books` - Crear libro
- `POST /api/books/assign` - Asignar libro a alumno

- `GET /api/expenses` - Listar gastos
- `POST /api/expenses` - Crear gasto

- `GET /api/waiting-list` - Lista de espera
- `POST /api/waiting-list/convert` - Convertir a alumno

- `GET /api/reports/dashboard` - Estadísticas del dashboard
- `GET /api/reports/cash-flow` - Flujo de caja
- `GET /api/reports/monthly-status` - Estado de mensualidades

- `GET /api/backup/:entity` - Backup (students, books, payments, all)
- `POST /api/restore/:entity` - Restore

- `POST /api/system/reset` - Resetear sistema (con confirmación)

## Lógica de Recargos/Descuentos (Uruguay)

El sistema implementa las siguientes reglas para mensualidades:

1. **Descuento Pronto Pago**: Si paga antes del día 10 del mes que corresponde: **-$150 UYU**
2. **Precio Normal**: Entre el 11 y 15 del mes: **Precio base**
3. **Recargo**: A partir del 16 del mes: **+$150 UYU**

### Lógica Especial de Fechas:

- Si paga el **16 de febrero** el mes de **marzo** → **Descuento** (pagó anticipado)
- Si paga el **9 de octubre** el mes de **septiembre** → **Recargo** (pagó tarde el mes anterior)

### Hermanos:

Los alumnos marcados como "hermano" con precio custom no reciben recargos ni descuentos. Siempre pagan el monto fijo configurado.

## Uso del Sistema

### Primer inicio

1. Acceder al sistema
2. Seleccionar o crear un año lectivo
3. Configurar precios en Configuración
4. Crear niveles/cursos
5. Registrar alumnos

### Flujo de trabajo típico

1. **Registrar alumno**: Alumnos > Nuevo Alumno
2. **Asignar libro**: Libros > Asignar (si aplica)
3. **Registrar pago**: Pagos > Registrar Pago o Modo Caja Rápida
4. **Ver deudas**: Dashboard o Pagos > Pendientes
5. **Enviar recordatorio**: WhatsApp desde la ficha del alumno

### Backup y Restore

**Exportar**:
1. Ir a Backup/Restore
2. Seleccionar la sección a exportar
3. El archivo JSON se descargará automáticamente

**Importar**:
1. Ir a Backup/Restore
2. Seleccionar la sección
3. Pegar el JSON o subir el archivo
4. Click en Importar

### Resetear Sistema

⚠️ **ADVERTENCIA**: Esta acción elimina TODOS los datos del año seleccionado.

1. Ir a Backup/Restore
2. En Zona de Peligro, click en "Resetear Sistema"
3. Escribir "ELIMINAR" para confirmar

## Seguridad

- Uso de prepared statements en todas las consultas SQL
- Validación de datos en el servidor
- Confirmación doble para acciones destructivas
- Separación de datos por año lectivo

## Soporte

Para reportar problemas o solicitar características, contactar al desarrollador.

## Licencia

Sistema propietario - ALEI Academia de Inglés
