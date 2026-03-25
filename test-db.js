const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  const { data, error } = await supabase.from('assignments').select('*').limit(1);
  if (data && data.length > 0) {
    const template_id = data[0].template_id;
    console.log('Got template_id:', template_id);
    const updates = [{
      seat_id: 'W-WL-1',
      nombre_invitado: 'Test Invitado',
      categoria: 'invitado',
      assigned_at: new Date().toISOString(),
      template_id
    }];
    const { error: error2 } = await supabase.from('assignments').upsert(updates, { onConflict: 'template_id,seat_id' });
    console.log('Upsert error with real template_id (invitado) and onConflict:', error2);
  } else {
    console.log('No data to grab template_id from');
  }
}
test();
