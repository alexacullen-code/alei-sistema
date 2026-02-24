# ALEI Gestión (Vercel + Neon + ESM)

Proyecto base listo para deploy en Vercel con API serverless en Node.js (ESM puro) y PostgreSQL en Neon.

## 1) Estructura

- `api/[...path].js`: API unificada (`/api/alumnos`, `/api/pagos`, etc.)
- `public/index.html`: SPA (HTML + JS + Tailwind CDN)
- `db/schema.sql`: creación de tablas + datos base (2026, niveles y tipos de matrícula)
- `package.json`: incluye `"type": "module"` para evitar errores ESM/CommonJS
- `vercel.json`: rutas para API + SPA

## 2) Paso a paso (sin ser programador)

### Paso A — Cargar base de datos en Neon

1. Entrá a Neon > tu proyecto > **SQL Editor**.
2. Abrí `db/schema.sql` y copiá todo.
3. Pegalo en el editor y ejecutá (**Run**).
4. Verificá que existan tablas (`alumnos`, `pagos`, etc.) y año lectivo activo 2026.

### Paso B — Variables en Vercel

1. Entrá a Vercel > tu proyecto > **Settings** > **Environment Variables**.
2. Creá variable `DATABASE_URL` con la conexión de Neon.
3. Guardá y redeploy.

### Paso C — Subir a GitHub

1. Hacé commit de estos archivos.
2. Push al branch conectado con Vercel.
3. Vercel hará deploy automático.

### Paso D — Probar online

- Abrí la URL de Vercel.
- Cargá un alumno.
- Registrá un pago.
- Probá botón de backup.

## 3) Endpoints disponibles

- `GET/POST /api/alumnos`
- `GET/POST /api/pagos`
- `GET /api/libros`
- `GET /api/gastos`
- `GET /api/preinscripciones`
- `GET /api/alertas`
- `GET /api/backup/export?tipo=alumnos|pagos|libros|gastos`

## 4) Sobre el error ESM

Este repositorio lo evita porque:

- `package.json` tiene `"type": "module"`
- API usa `import { Pool } from 'pg'`
- API exporta `export default async function handler(...)`
- **No** usa `require` ni `module.exports`

## 5) Datos ejemplo para tus alumnos

Podés cargar tus alumnos por la UI o por SQL. Los campos del sistema ya contemplan:

- número anual por año lectivo
- nombre, cédula, teléfono, edad, dirección
- nivel y tipo de matrícula
- fecha de inscripción
