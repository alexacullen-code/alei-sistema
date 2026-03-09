-- Compatibilidad para instalaciones antiguas donde anios_lectivos usa columnas anio/year o is_active
-- Ejecutar en Neon SQL Editor si aparece:
--   column "nombre" of relation "anios_lectivos" does not exist

ALTER TABLE anios_lectivos
  ADD COLUMN IF NOT EXISTS nombre TEXT;

ALTER TABLE anios_lectivos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'anios_lectivos' AND column_name = 'anio'
  ) THEN
    EXECUTE 'UPDATE anios_lectivos SET nombre = COALESCE(nombre, anio::text)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'anios_lectivos' AND column_name = 'year'
  ) THEN
    EXECUTE 'UPDATE anios_lectivos SET nombre = COALESCE(nombre, year::text)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'anios_lectivos' AND column_name = 'is_active'
  ) THEN
    EXECUTE 'UPDATE anios_lectivos SET activo = COALESCE(activo, is_active)';
  END IF;
END $$;

UPDATE anios_lectivos SET nombre = COALESCE(nombre, id::text) WHERE nombre IS NULL;
UPDATE anios_lectivos SET activo = COALESCE(activo, false) WHERE activo IS NULL;

ALTER TABLE anios_lectivos
  ALTER COLUMN nombre SET NOT NULL;

ALTER TABLE anios_lectivos
  ALTER COLUMN activo SET NOT NULL;

ALTER TABLE anios_lectivos
  ALTER COLUMN activo SET DEFAULT false;
