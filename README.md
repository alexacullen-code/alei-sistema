# ALEI Gestión (Vercel + Neon)

Esta versión reinicia el proyecto con más cobertura funcional: **Alumnos, Pagos, Materiales (Libros), Gastos, Reportes, Backup/Import (texto y archivo JSON) y Reset por año lectivo**.

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
- `POST /api/backup/preview` con body `{ backup }` (preview de cambios antes de importar)
- `POST /api/backup/import` con body `{ modo, backup }`
- `POST /api/reset` con body `{ "confirmacion": "ELIMINAR TODO 2026" }`


## Variables de entorno (.env.example)

El repositorio incluye un archivo `.env.example` con las variables mínimas para ejecutar en local y en Vercel:

- `DATABASE_URL`
- `NODE_ENV`

Podés copiarlo como base local:

```bash
cp .env.example .env
```

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


## Importación JSON (2 formas)

En la pestaña **Config/Backup** ahora podés importar:

1. **Pegando texto JSON** en el textarea y usando *Preview importación* para validar antes de importar.
2. **Subiendo archivo `.json`** con el selector y usando *Preview importación* antes de *Importar desde archivo JSON*.

> La importación ahora es tolerante a diferencias de estructura entre backups: ignora columnas inexistentes en tu base actual y mapea `nivel`/`tipo_matricula_nombre` a IDs cuando corresponde.

La UI también se ajustó a una paleta inspirada en la bandera inglesa (azul/rojo/blanco) y se agregó una insignia Union Jack junto al nombre ALEI.
