-- Habilitar tiempo real para la tabla de asignaciones
-- Esto es CRITICO para que los cambios se vean sin refrescar la pagina

-- Asegurar que la publicación exista
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Agregar la tabla assignments a la publicación para que emita eventos
-- Primero intentamos agregarla (esto fallará si ya está, por eso el catch)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Ya estaba en la publicación
END $$;

-- Asegurar Replica Identity Full (necesario para UPDATES sin PK clara)
ALTER TABLE assignments REPLICA IDENTITY FULL;
