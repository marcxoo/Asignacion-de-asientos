const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAssignments() {
    const { data, error } = await supabase
        .from('assignments')
        .select('seat_id, categoria, nombre_invitado')
        .eq('categoria', 'docente');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Docente Assignments:', data);

    const slots = data.filter(a => a.nombre_invitado === 'Cupo Disponible');
    console.log('Teacher Slots found:', slots.length);
}

checkAssignments();
