/**
 * Aplica la migración de registros y registro_id en Supabase.
 * Requiere DATABASE_URL en .env.local (Connection string de Supabase: Settings → Database).
 * Uso: npm run db:migrate
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Cargar .env.local si existe
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211000000_registros_y_registro_id.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL en .env.local.');
    console.error('Obtén la connection URI en Supabase: Settings → Database → Connection string (URI).');
    console.error('O ejecuta el SQL manualmente en Supabase → SQL Editor:');
    console.error(migrationPath);
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('Instala pg: npm install --save-dev pg');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migración aplicada correctamente.');
  } catch (err) {
    console.error('Error aplicando migración:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
