// scripts/getInvitationLink.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase env vars missing');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find event template
  const { data: template, error: tmplErr } = await supabase
    .from('templates')
    .select('id, name')
    .eq('name', 'EMPRENDEX 2026')
    .single();
  if (tmplErr || !template) {
    console.error('Evento no encontrado:', tmplErr?.message);
    process.exit(1);
  }

  // Find Marcos Loja registration
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
