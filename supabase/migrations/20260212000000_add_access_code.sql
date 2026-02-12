-- Add access code column for cross-device login
ALTER TABLE registros 
ADD COLUMN IF NOT EXISTS codigo_acceso TEXT UNIQUE;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_registros_codigo_acceso ON registros(codigo_acceso);
