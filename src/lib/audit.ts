import { createSupabaseServer } from '@/lib/supabase-server';

interface AuditInput {
  templateId?: string | null;
  actorType: 'super_admin' | 'admin_evento' | 'delegado' | 'invitado' | 'system';
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditInput) {
  try {
    const supabase = createSupabaseServer();
    await supabase.from('audit_logs').insert({
      template_id: input.templateId ?? null,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // Silent on purpose: audit should not block business flow
  }
}
