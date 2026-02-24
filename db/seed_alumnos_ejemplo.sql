-- Ejecutar después de db/schema.sql
INSERT INTO alumnos (
  numero_anual, nombre, cedula, telefono, edad, direccion,
  nivel_id, tipo_matricula_id, fecha_inscripcion, anio_lectivo_id, created_at
) VALUES
(28, 'LAUTARO ESTEVEZ', '5630969-4', '25148196', 19, 'LEANDRO GOMEZ 7299', 1, 1, '2026-02-03', 1, '2026-02-19 15:00:00'),
(29, 'JULIETA ESTEVEZ', '5769725-8', '097984386', 15, 'LEANDRO GOMEZ 7299', 2, 1, '2026-02-03', 1, '2026-02-19 15:00:00'),
(30, 'MAVI ROMÁN REYNA', '6.114.770-0', '092378039', 11, 'PASAJE 1 ALTA TENSION 7964', 3, 1, '2026-02-03', 1, '2026-02-19 15:00:00')
ON CONFLICT (anio_lectivo_id, cedula) DO NOTHING;
