# Guía de Configuración - Neon PostgreSQL

## Paso 1: Crear Cuenta en Neon

1. Ve a https://neon.tech
2. Regístrate con tu email o GitHub
3. Verifica tu cuenta

## Paso 2: Crear Proyecto

1. Haz clic en "New Project"
2. Nombre del proyecto: `alei-gestion` (o el que prefieras)
3. Región: Elige la más cercana a tu ubicación (recomendado: US East)
4. PostgreSQL version: 15 o superior
5. Haz clic en "Create Project"

## Paso 3: Obtener Connection String

1. En el dashboard del proyecto, ve a la pestaña "Connection"
2. Copia el string que aparece (tiene formato:
   ```
   postgresql://usuario:password@host:puerto/database?sslmode=require
   ```
3. Guárdalo en un lugar seguro, lo necesitarás para Vercel

## Paso 4: Ejecutar el Schema SQL

### Opción A: SQL Editor (Recomendado)

1. En el dashboard de Neon, haz clic en "SQL Editor"
2. Copia TODO el contenido del archivo `schema.sql`
3. Pégalo en el editor
4. Haz clic en "Run" (botón play)
5. Verifica que no haya errores

### Opción B: psql (Terminal)

```bash
# Instalar psql si no lo tienes
# macOS: brew install libpq
# Ubuntu: sudo apt-get install postgresql-client

# Conectar y ejecutar
psql "TU_CONNECTION_STRING" -f schema.sql
```

## Paso 5: Verificar Instalación

Ejecuta estas queries para verificar:

```sql
-- Ver tablas creadas
\dt

-- Ver datos iniciales
SELECT * FROM academic_years;
SELECT * FROM enrollment_types;

-- Ver funciones creadas (si ejecutaste functions.sql)
\df
```

Deberías ver:
- 13 tablas creadas
- 1 año lectivo (2025) activo
- 3 tipos de matrícula (Regular, Beca 50%, Hermano)

## Paso 6: (Opcional) Ejecutar Funciones Adicionales

Si quieres las funciones auxiliares:

1. Abre el archivo `functions.sql`
2. Copia todo el contenido
3. Ejecuta en el SQL Editor de Neon

## Paso 7: Configurar en Vercel

```bash
# En tu proyecto local
cd alei-gestion

# Agregar variable de entorno
vercel env add DATABASE_URL

# Cuando te pregunte, pega tu connection string de Neon
```

O manualmente en la web:
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a "Settings" > "Environment Variables"
4. Agrega:
   - Name: `DATABASE_URL`
   - Value: `postgresql://usuario:password@host:puerto/database?sslmode=require`

## Solución de Problemas

### Error: "extension pgcrypto does not exist"
Neon ya tiene habilitada la extensión pgcrypto por defecto. Este error no debería ocurrir, pero si pasa:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Error: "permission denied"
Verifica que estás usando el connection string correcto con el usuario propietario del proyecto.

### Error: "relation already exists"
Si necesitas recrear todo desde cero:

```sql
-- Eliminar en orden correcto (cuidado: borra todos los datos!)
DROP TABLE IF EXISTS book_payments CASCADE;
DROP TABLE IF EXISTS book_assignments CASCADE;
DROP TABLE IF EXISTS tuition_payments CASCADE;
DROP TABLE IF EXISTS expense_installments CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS waiting_list CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS levels CASCADE;
DROP TABLE IF EXISTS enrollment_types CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;

-- Luego vuelve a ejecutar schema.sql
```

## Próximos Pasos

Una vez configurada la base de datos:

1. **Deploy en Vercel**: `vercel --prod`
2. **Accede a tu app**: La URL que te da Vercel
3. **Prueba el sistema**: Crea un alumno de prueba
4. **Verifica la conexión**: El dashboard debería mostrar 0 alumnos activos inicialmente

## Datos de Prueba (Opcional)

Si quieres datos de prueba, ejecuta:

```sql
-- Insertar alumno de prueba
INSERT INTO students (
    year_id, cedula, first_name, last_name, 
    email, phone_primary, parent_name, parent_phone,
    enrollment_type_id, status
)
SELECT 
    ay.id,
    '12345678',
    'Juan',
    'Pérez',
    'juan@email.com',
    '099123456',
    'María Pérez',
    '099987654',
    et.id,
    'active'
FROM academic_years ay
CROSS JOIN enrollment_types et
WHERE ay.year_name = '2025' AND et.name = 'Regular';

-- Insertar libro de prueba
INSERT INTO books (year_id, title, author, price, stock)
SELECT id, 'English File Elementary', 'Oxford', 1500.00, 10
FROM academic_years WHERE year_name = '2025';
```

---

**Nota importante**: El plan gratuito de Neon incluye:
- 500 MB de almacenamiento
- 190 horas de computación/mes (aprox 6 horas/día)
- Base de datos suspende después de inactividad (se reactiva automáticamente)

Para producción con uso constante, considera actualizar a un plan pago.
