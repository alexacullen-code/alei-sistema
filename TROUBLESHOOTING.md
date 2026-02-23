# Guía de Solución de Problemas - ALEI

## Problema: "Modo Demo" persiste aunque configuré Neon

### Paso 1: Verificar variable de entorno en Vercel

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** > **Environment Variables**
4. Verifica que exista `DATABASE_URL` con el formato:
   ```
   postgresql://usuario:password@ep-xxxxx.us-east-1.aws.neon.tech/database?sslmode=require
   ```

### Paso 2: Redeploy obligatorio

**IMPORTANTE**: Después de agregar/modificar variables de entorno, debes redeploy:

1. En Vercel, ve a la pestaña **Deployments**
2. Encuentra el deployment más reciente
3. Haz clic en los **tres puntos** (...) 
4. Selecciona **Redeploy**
5. Espera a que termine (estado "Ready")

### Paso 3: Verificar endpoint de health

Abre en tu navegador:
```
https://TU-DOMINIO.vercel.app/api/health
```

Deberías ver algo como:
```json
{
  "status": "ok",
  "database": "connected",
  "time": "2024-01-15T10:30:00.000Z",
  "env": {
    "database_url_configured": true
  }
}
```

Si ves `database: "disconnected"` o error 503, la variable DATABASE_URL no está configurada correctamente.

### Paso 4: Verificar logs de Vercel

1. En Vercel, ve a tu proyecto
2. Ve a **Logs** (pestaña superior)
3. Busca errores relacionados con "DATABASE_URL" o "Pool"

### Paso 5: Diagnóstico desde el navegador

1. Abre tu aplicación en el navegador
2. Abre la consola de desarrollador (F12)
3. Ve a la pestaña **Console**
4. Busca mensajes como:
   - "Health check:"
   - "API no disponible"
   - Errores de fetch

### Paso 6: Verificar esquema de Neon

En el SQL Editor de Neon, ejecuta:
```sql
-- Verificar que las tablas existen
\dt

-- Verificar datos iniciales
SELECT * FROM academic_years;
SELECT * FROM enrollment_types;
```

Deberías ver:
- 13 tablas creadas
- 1 año lectivo (2025)
- 3 tipos de matrícula

### Soluciones Comunes

#### Error: "Database not configured" (503)

**Causa**: La variable DATABASE_URL no está configurada o no se ha redeployado.

**Solución**:
```bash
# Verificar que la variable existe
vercel env ls

# Si no existe, agregarla
vercel env add DATABASE_URL

# Redeploy
vercel --prod
```

#### Error: "connection refused" o timeout

**Causa**: El connection string es incorrecto o Neon está en pausa.

**Solución**:
1. Ve a Neon > tu proyecto
2. Copia el connection string nuevamente
3. Asegúrate de incluir `?sslmode=require`
4. Actualiza la variable en Vercel
5. Redeploy

#### Error: "relation does not exist"

**Causa**: No se ejecutó el schema.sql en Neon.

**Solución**:
1. Ve a Neon > SQL Editor
2. Copia y pega todo el contenido de `db/schema.sql`
3. Ejecuta (botón play)

#### Error: "permission denied"

**Causa**: El usuario de la base de datos no tiene permisos.

**Solución**:
- Usa el connection string del usuario propietario del proyecto Neon
- No uses usuarios de solo lectura

### Comandos Útiles

```bash
# Verificar configuración de Vercel
vercel env ls

# Agregar variable de entorno
vercel env add DATABASE_URL

# Deploy forzado
vercel --prod --force

# Ver logs en tiempo real
vercel logs --json
```

### Contacto

Si después de seguir estos pasos el problema persiste:
1. Copia los logs de Vercel
2. Copia la respuesta del endpoint /api/health
3. Verifica que el schema.sql se ejecutó sin errores
