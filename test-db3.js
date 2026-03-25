const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  const { data } = await supabase.from('assignments').select('template_id').limit(1);
  if (data && data.length > 0) {
    const template_id = data[0].template_id;
    const testSeat = 'W-WL-998';
    const { error: err1 } = await supabase.from('assignments').upsert([{
      seat_id: testSeat, template_id, categoria: 'invitado', nombre_invitado: 'Test 3'
    }], { onConflict: 'idx_assignments_template_seat_unique' });
    
    console.log('Upsert with exact index name:', err1);
  }
}
test();
