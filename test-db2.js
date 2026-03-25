const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  const { data, error } = await supabase.from('assignments').select('template_id, seat_id').limit(10);
  console.log('Sample data:', data.slice(0, 2));
  
  // Let's insert the exact same row twice without onConflict to see if we get a unique error
  if (data && data.length > 0) {
    const template_id = data[0].template_id;
    const testSeat = 'W-WL-999';
    await supabase.from('assignments').delete().eq('seat_id', testSeat);
    
    // Insert 1
    const { error: err1 } = await supabase.from('assignments').insert([{
      seat_id: testSeat, template_id, categoria: 'invitado', nombre_invitado: 'Test'
    }]);
    console.log('Insert 1 error:', err1);
    
    // Insert 2
    const { error: err2 } = await supabase.from('assignments').insert([{
      seat_id: testSeat, template_id, categoria: 'invitado', nombre_invitado: 'Test 2'
    }]);
    console.log('Insert 2 error:', err2);
    
    // Check duplicates
    const { data: dups } = await supabase.from('assignments').select('*').eq('seat_id', testSeat);
    console.log('Duplicates found:', dups.length);
    
    // Cleanup
    await supabase.from('assignments').delete().eq('seat_id', testSeat);
  }
}
test();
