# ALEI - Sistema de Gestión Escolar v4.0

Sistema completo para la gestión de institutos de inglés, con manejo de alumnos, pagos, libros, gastos y reportes.

## Características Principales

- **Gestión de Alumnos**: Registro completo con datos de contacto, tipos de matrícula y sistema de hermanos
- **Pagos Inteligentes**: Cálculo automático de descuentos por pronto pago y recargos por atraso (reglas de Uruguay)
- **Pagos Parciales**: Sistema de pagos fraccionados para libros y mensualidades
- **Gestión de Libros**: Inventario, asignación y seguimiento de pagos
- **Control de Gastos**: Con soporte para cuotas mensuales
- **Lista de Espera**: Pre-inscripciones con conversión a alumnos
- **Reportes**: Flujo de caja y estado de mensualidades
- **Backup/Restore**: Exportación e importación de datos en JSON
- **Modo Caja Rápida**: Interfaz simplificada para cobros rápidos
- **Generador WhatsApp**: Mensajes de cobranza automáticos

## Stack Tecnológico

- **Frontend**: SPA Vanilla JS (HTML5, CSS3, JavaScript ES6+)
- **Backend**: Vercel Serverless Functions (Node.js 24.x)
- **Base de Datos**: PostgreSQL (Neon.tech)
- **Tipo de Módulos**: ESM (ECMAScript Modules)

## Requisitos Previos

- Node.js 24.x o superior
- Cuenta en [Vercel](https://vercel.com)
- Cuenta en [Neon](https://neon.tech) (PostgreSQL)
- CLI de Vercel instalado: `npm i -g vercel`

## Instalación Local

1. **Clonar o descargar el proyecto**
```bash
cd alei-gestion
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
Crear archivo `.env`:
```env
DATABASE_URL=postgresql://usuario:password@host:puerto/database
```

4. **Crear base de datos**
En Neon.tech, ejecutar el contenido de `db/schema.sql` en el SQL Editor.

5. **Iniciar servidor de desarrollo**
```bash
vercel dev
```

## Despliegue en Vercel

### Paso 1: Preparar el proyecto
```bash
vercel
```
Sigue las instrucciones para vincular tu proyecto.

### Paso 2: Configurar variables de entorno en Vercel
```bash
vercel env add DATABASE_URL
```
Ingresa tu connection string de Neon cuando se solicite.

### Paso 3: Deploy
```bash
vercel --prod
```

## Configuración de la Base de Datos (Neon)

1. Crear un nuevo proyecto en [Neon](https://console.neon.tech)
2. Copiar el **Connection String** (en formato `postgresql://...`)
3. Ejecutar el script `db/schema.sql` en el SQL Editor de Neon

## Estructura del Proyecto

```
alei-gestion/
├── api/
│   └── [...path].js          # API Catch-all (Serverless Functions)
├── public/
│   └── index.html            # SPA Vanilla JS
├── db/
│   └── schema.sql            # Esquema PostgreSQL
├── package.json              # Configuración ESM + dependencias
├── vercel.json               # Configuración de rutas
└── README.md                 # Este archivo
```

## Lógica de Recargos/Descuentos (Uruguay)

El sistema implementa las siguientes reglas:

1. **Descuento Pronto Pago**: Si paga antes del día 10 del mes que corresponde: **-$150 UYU**
2. **Precio Normal**: Entre el 11 y 15 del mes: **Precio base**
3. **Recargo**: A partir del 16 del mes: **+$150 UYU**

### Ejemplos:
- Pagar el **16 de febrero** el mes de **marzo** → **Descuento** (pagó anticipado)
- Pagar el **9 de octubre** el mes de **septiembre** → **Recargo** (pagó tarde el mes anterior)

### Excepción - Hermanos:
Los alumnos marcados como "hermanos" tienen un precio fijo personalizado y **no** se aplican recargos ni descuentos.

## API Endpoints

### Años Lectivos
- `GET /api/years` - Listar años
- `POST /api/years` - Crear año
- `PUT /api/years/:id/activate` - Activar año

### Estudiantes
- `GET /api/students?year_id=xxx&search=xxx` - Listar/buscar
- `POST /api/students` - Crear
- `PUT /api/students/:id` - Actualizar
- `GET /api/students/:id/full-profile` - Perfil completo

### Pagos
- `POST /api/payments/tuition` - Pago mensualidad/matricula
- `POST /api/payments/books` - Pago de libro
- `POST /api/payments/quick` - Modo POS
- `GET /api/payments/pending` - Deudas pendientes

### Libros
- `GET /api/books` - Listar
- `POST /api/books` - Crear
- `POST /api/books/assign` - Asignar a estudiante

### Reportes
- `GET /api/reports/cash-flow?month=2025-03` - Flujo de caja
- `GET /api/reports/monthly-status?month=2025-03` - Estado mensualidades

### Backup/Restore
- `GET /api/backup/:entity` - Exportar (students, books, payments, all)
- `POST /api/restore/:entity` - Importar

### Sistema
- `POST /api/system/reset` - Reset completo (requiere confirmación)
- `GET /api/system/stats` - Estadísticas del dashboard

## Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `DATABASE_URL` | Connection string de PostgreSQL | Sí |

## Seguridad

- Todas las queries usan **prepared statements** para prevenir SQL Injection
- El reset del sistema requiere **doble confirmación** (header + body)
- Las transacciones de pagos usan **BEGIN/COMMIT/ROLLBACK** para garantizar integridad

## Primer Uso

1. Accede a la aplicación desplegada
2. El sistema creará automáticamente el año 2025 con tipos de matrícula básicos
3. Ve a "Configuración" > "Años Lectivos" para crear más años si es necesario
4. Comienza a registrar alumnos en "Alumnos" > "Nuevo Alumno"

## Soporte

Para reportar problemas o solicitar funcionalidades, contacta al administrador del sistema.

---

**ALEI - Sistema de Gestión Escolar v4.0**  
Desarrollado para Institutos de Inglés
