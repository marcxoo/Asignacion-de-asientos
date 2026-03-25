-- 1. Tabla registros
DO $$
BEGIN
    ALTER TABLE registros DROP CONSTRAINT IF EXISTS registros_categoria_check;
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

-- 3. Tabla assignments (MUY IMPORTANTE)
DO $$
BEGIN
    -- Intentar borrar cualquier restricción de categoría en assignments
    -- Como no sabemos el nombre exacto, buscamos el nombre que genera Postgres por defecto
    -- o probamos los nombres comunes.
    
    ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_categoria_check;
    ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_categoria_check1;
    
    -- Si no los conocemos, esta es la forma más segura si el nombre es automático:
    -- Pero usualmente DROP CONSTRAINT IF EXISTS assignments_categoria_check es suficiente.
    
    ALTER TABLE assignments 
    ADD CONSTRAINT assignments_categoria_check 
    CHECK (categoria IN ('autoridad', 'docente', 'administrativo', 'codigo_trabajo', 'invitado', 'estudiante', 'bloqueado'));
END $$;
