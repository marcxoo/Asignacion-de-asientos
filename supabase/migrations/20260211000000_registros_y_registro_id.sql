-- Tabla de registros (personas que se registran para elegir asiento)
CREATE TABLE IF NOT EXISTS registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('autoridad', 'docente', 'invitado', 'estudiante')),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar por token (cookie)
CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_token ON registros(token);

-- Añadir registro_id a assignments (nullable: null = asignado por organizador)
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS registro_id UUID REFERENCES registros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_registro_id ON assignments(registro_id);

-- Comentarios
COMMENT ON TABLE registros IS 'Personas que se registran por el link público para elegir su asiento';
COMMENT ON COLUMN assignments.registro_id IS 'Si no es null, la asignación la hizo la persona con este registro (solo ella puede liberarla)';
