-- Multi-event support extensions (compatible with current templates-based schema)

-- 1) Extend registros for CSV-based invitations
ALTER TABLE registros
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS correo TEXT,
  ADD COLUMN IF NOT EXISTS departamento TEXT,
  ADD COLUMN IF NOT EXISTS invitation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_last_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'registros_invitation_status_check'
  ) THEN
    ALTER TABLE registros
      ADD CONSTRAINT registros_invitation_status_check
      CHECK (invitation_status IN ('pending', 'sent', 'opened', 'reserved', 'expired', 'cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_template_correo_unique
  ON registros(template_id, lower(correo))
  WHERE correo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registros_template_status
  ON registros(template_id, invitation_status);

-- 2) Quotas by event (template)
CREATE TABLE IF NOT EXISTS event_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('autoridad', 'docente', 'invitado', 'estudiante')),
  cupo_total INT NOT NULL CHECK (cupo_total >= 0),
  cupo_usado INT NOT NULL DEFAULT 0 CHECK (cupo_usado >= 0),
  liberar_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, categoria)
);

-- 3) Campaign tracking (provider-agnostic)
CREATE TABLE IF NOT EXISTS invitation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  subject TEXT,
  mode TEXT NOT NULL DEFAULT 'simulate' CHECK (mode IN ('simulate', 'institutional')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'failed')),
  total INT NOT NULL DEFAULT 0,
  sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 4) Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('super_admin', 'admin_evento', 'delegado', 'invitado', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_template_created
  ON audit_logs(template_id, created_at DESC);

-- 5) Assignment uniqueness by event (template)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_template_seat_unique
  ON assignments(template_id, seat_id)
  WHERE template_id IS NOT NULL;
