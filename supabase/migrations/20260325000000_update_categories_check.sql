-- Actualizar restricciones de categoría para permitir nuevos roles

-- 1. Tabla registros
DO $$
BEGIN
    -- Intentar borrar la restricción si existe
    ALTER TABLE registros DROP CONSTRAINT IF EXISTS registros_categoria_check;
    
    -- Volver a crearla con los nuevos roles agregados
    ALTER TABLE registros
    ADD CONSTRAINT registros_categoria_check
    CHECK (categoria IN ('autoridad', 'docente', 'administrativo', 'codigo_trabajo', 'invitado', 'estudiante', 'bloqueado'));
END $$;

-- 2. Tabla event_quotas
DO $$
BEGIN
    ALTER TABLE event_quotas DROP CONSTRAINT IF EXISTS event_quotas_categoria_check;
    
    ALTER TABLE event_quotas
    ADD CONSTRAINT event_quotas_categoria_check
    CHECK (categoria IN ('autoridad', 'docente', 'administrativo', 'codigo_trabajo', 'invitado', 'estudiante', 'bloqueado'));
END $$;

-- 3. Tabla assignments (si tuviera restricción, aunque usualmente hereda o no tiene check manual)
-- Por si acaso, nos aseguramos de que acepte los valores
DO $$
BEGIN
    ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_categoria_check;
    -- Si no existe, no hace nada el DROP. Solo la agregamos si queremos validación en DB.
END $$;
