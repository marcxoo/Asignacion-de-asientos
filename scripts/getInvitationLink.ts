// scripts/getInvitationLink.ts
import { createSupabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

(async () => {
  const supabase = createSupabaseServer();
  // Find the template (event) named "EMPRENDEX 2026"
  const { data: template, error: tmplErr } = await supabase
    .from('templates')
    .select('id, name')
    .eq('name', 'EMPRENDEX 2026')
    .single();
  if (tmplErr || !template) {
    console.error('Evento no encontrado:', tmplErr?.message);
    process.exit(1);
  }
  // Find the registration for Marcos Loja in that event
  const { data: registro, error: regErr } = await supabase
    .from('registros')
    .select('token')
    .eq('nombre', 'Marcos Loja')
    .eq('template_id', template.id)
    .single();
  if (regErr || !registro) {
    console.error('Registro no encontrado:', regErr?.message);
    process.exit(1);
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const link = `${origin}/invitacion/${registro.token}`;
  console.log('Enlace de invitación:', link);
})();
