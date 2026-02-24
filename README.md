# ALEI Sistema – Guía paso a paso (Neon + Vercel + GitHub)

Esta guía está escrita para que la puedas seguir **sin ser programador**.

---

## 1) Qué ya tenés bien (según lo que contaste)

- ✅ Neon conectado a Vercel.
- ✅ Vercel conectado a tu repositorio de GitHub.

Con eso ya tenés lo más difícil resuelto.

---

## 2) Estructura actual del proyecto (resumen simple)

- Frontend: React + Vite.
- API en Vercel Serverless: `api/[...path].js`.
- Base de datos: PostgreSQL en Neon.
- Configuración de Vercel: `vercel.json`.
- Esquema SQL: `db/schema.sql`.

---

## 3) Paso a paso para dejarlo funcionando online

## Paso A — Cargar tablas en Neon

1. Entrá a tu panel de **Neon**.
2. Abrí tu proyecto y buscá el editor SQL.
3. Copiá todo el contenido del archivo `db/schema.sql`.
4. Pegalo en Neon y ejecutalo.
5. Verificá que se crearon las tablas (por ejemplo: `alumnos`, `pagos`, `gastos`, etc.).

> Si ya las creaste antes, no pasa nada: el script usa `CREATE TABLE IF NOT EXISTS`.

## Paso B — Configurar variables de entorno en Vercel

1. Entrá a **Vercel → tu proyecto → Settings → Environment Variables**.
2. Creá la variable:
   - `DATABASE_URL` = string de conexión de Neon (la que empieza con `postgres://` o `postgresql://`).
3. Guardá.
4. Aplicala en **Production**, **Preview** y **Development**.

## Paso C — Verificar configuración anti-error ESM

El error que querés evitar es:

> `Warning: Node.js functions are compiled from ESM to CommonJS`

Checklist rápido:

- `package.json` debe tener: `"type": "module"` ✅
- Tu API debe usar `import ...` y no `require(...)` ✅
- Tu API debe exportar handler con `export default` ✅

Este proyecto ya viene configurado en ese estilo.

## Paso D — Hacer deploy desde GitHub

1. Subí cambios al repositorio (`git push`).
2. Vercel detecta el push y hace deploy automático.
3. Esperá a que termine (estado "Ready").

## Paso E — Probar que quedó bien

Cuando termine el deploy, abrí estas URLs en tu dominio de Vercel:

- Frontend: `https://TU-DOMINIO.vercel.app`
- API health básico (ejemplo): `https://TU-DOMINIO.vercel.app/api/anios-lectivos`

Si no sabés qué endpoint usar primero, probá alguno de lectura de datos (`GET`) para ver respuesta JSON.

---

## 4) Qué hacer si falla

## Error: `DATABASE_URL` no definida

- Revisá que esté escrita exactamente igual en Vercel (`DATABASE_URL`).
- Hacé **Redeploy** después de agregarla.

## Error de CORS

- Este proyecto ya define headers CORS en `vercel.json` y en la API.
- Si persiste, revisá que estés llamando al mismo dominio correcto.

## Error ESM/CommonJS

- No uses `require` ni `module.exports` en `api/[...path].js`.
- Dejá `"type": "module"` en `package.json`.
- Redeploy completo después del cambio.

---

## 5) Flujo recomendado para vos (día a día)

1. Hacer cambios en el proyecto.
2. Probar local (`npm run dev`).
3. Subir a GitHub.
4. Verificar deploy en Vercel.
5. Probar 2 o 3 pantallas clave:
   - Alumnos
   - Pagos
   - Dashboard

---

## 6) Comandos útiles (si alguien técnico te ayuda)

```bash
npm install
npm run build
```

Si `npm run build` funciona, normalmente el deploy también está bien encaminado.

---

## 7) Siguiente paso recomendado

Como ya tenés Neon y Vercel vinculados, el siguiente paso práctico es:

1. Confirmar que `db/schema.sql` está ejecutado en Neon.
2. Confirmar `DATABASE_URL` en Vercel.
3. Hacer un deploy y probar un endpoint `/api/...`.

Con eso ya quedás con la base funcionando online.

---

## 8) Respuesta directa: ¿tenés que hacer algo o solo deploy?

**Respuesta corta:** no es solo deploy. Antes del deploy final tenés que chequear **2 cosas obligatorias**:

1. Que corriste `db/schema.sql` en Neon (tablas creadas).
2. Que `DATABASE_URL` está cargada en Vercel para Production/Preview/Development.

Si esas dos cosas ya están listas, ahí sí: **hacés deploy y probás**.

Checklist final (rápido):

- [ ] Schema ejecutado en Neon
- [ ] `DATABASE_URL` en Vercel
- [ ] Deploy en estado `Ready`
- [ ] Abrir frontend
- [ ] Probar al menos un endpoint `/api/...`

Si querés, podés seguir este orden exacto:

1. Cargar schema en Neon
2. Verificar variable en Vercel
3. Deploy
4. Probar web + API

Con eso ya quedás operativo.
