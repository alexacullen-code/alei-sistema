# ALEI Gestión (Vercel + Neon)

Esta versión reinicia el proyecto con más cobertura funcional: **Alumnos, Pagos, Materiales (Libros), Gastos, Reportes, Backup/Import y Reset por año lectivo**.

## Estructura

- `api/[...path].js` → API unificada serverless (ESM puro).
- `public/index.html` → SPA (HTML + JS + Tailwind CDN) con secciones completas.
- `db/schema.sql` → tablas + datos iniciales para Neon.
- `db/seed_alumnos_ejemplo.sql` → seed opcional de alumnos.
- `package.json` + `vercel.json` → configuración Vercel + ESM.

## Endpoints implementados

### CRUD principal
- `GET/POST/PUT/DELETE /api/alumnos`
- `GET/POST/PUT/DELETE /api/pagos`
- `GET/POST/PUT/DELETE /api/libros` (Materiales)
- `GET/POST/PUT/DELETE /api/gastos`
- `GET/POST/PUT/DELETE /api/preinscripciones`
- `GET/POST/PUT/DELETE /api/alertas`

> Para `PUT/DELETE`, usar query param `?id=...`

### Reportes
- `GET /api/reportes/mensualidades?mes=xx&anio=xxxx`
- `GET /api/reportes/flujo-caja?desde=yyyy-mm-dd&hasta=yyyy-mm-dd`

### Backup y reset
- `GET /api/backup/export?tipo=alumnos|pagos|libros|gastos|preinscripciones|alertas`
- `POST /api/backup/import` con body `{ modo, backup }`
- `POST /api/reset` con body `{ "confirmacion": "ELIMINAR TODO 2026" }`

## Deploy paso a paso (sin programar)

1. **Neon** → SQL Editor → pegar y ejecutar `db/schema.sql`.
2. (Opcional) ejecutar `db/seed_alumnos_ejemplo.sql`.
3. **Vercel** → Project Settings → Environment Variables:
   - `DATABASE_URL`
   - `NODE_ENV=production`
4. Push a GitHub (rama vinculada a Vercel).
5. Vercel deploya automático.
6. Abrir app y cargar datos en cada sección.

## Punto crítico del error ESM

Este repo evita el warning por:
- `"type": "module"` en `package.json`.
- `import { Pool } from 'pg'`.
- `export default async function handler(...)`.
- Sin `require` ni `module.exports`.
