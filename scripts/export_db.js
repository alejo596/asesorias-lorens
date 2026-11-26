const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
const tempFile = path.join(__dirname, '..', 'temp_dump.sql');
const outputFile = path.join(__dirname, '..', 'backup_completo_lorens.sql');

console.log('Generando respaldo universal compatible con Supabase, Neon y Web SQL Editors...');
try {
  const env = Object.assign({}, process.env, { PGPASSWORD: process.env.PGPASSWORD || process.env.DB_PASSWORD || '' });
  
  // Usar --inserts y --column-inserts para evitar COPY FROM stdin y \.
  const cmd = `"${pgDumpPath}" -h localhost -p 6012 -U postgres -d lorens_db --inserts --column-inserts --no-owner --no-privileges -F p -f "${tempFile}"`;
  execSync(cmd, { env, stdio: 'inherit' });

  let content = fs.readFileSync(tempFile, 'utf8');

  // 1. Filtrar líneas de comandos psql que empiezan con backslash (\., \restrict, etc.)
  let lines = content
    .split(/\r?\n/)
    .filter(line => {
      const trimmed = line.trim();
      if (trimmed === '\\.' || trimmed.startsWith('\\') || trimmed.startsWith('--\\')) {
        return false;
      }
      return true;
    });

  let sql = lines.join('\n');

  // 2. Normalizar creación de extensiones para Supabase/Neon (remover WITH SCHEMA public)
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;/g, 'CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;/g, 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // 3. Reemplazar public.uuid_generate_v4() por la función nativa estándar gen_random_uuid()
  sql = sql.replace(/public\.uuid_generate_v4\(\)/g, 'gen_random_uuid()');

  // 4. Inyectar función de compatibilidad al inicio por si alguna consulta la invoca
  const compatibilityHeader = `
-- =============================================================================
-- COMPATIBILIDAD UNIVERSAL CON SUPABASE / NEON / POSTGRESQL 13+
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función de compatibilidad por si se invoca explícitamente public.uuid_generate_v4()
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;
-- =============================================================================
`;

  sql = compatibilityHeader + '\n' + sql;

  fs.writeFileSync(outputFile, sql, 'utf8');

  // Eliminar temporal
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }

  const stat = fs.statSync(outputFile);
  console.log(`✓ Respaldo universal generado: backup_completo_lorens.sql (${Math.round(stat.size / 1024)} KB)`);
} catch (err) {
  console.error('Error al exportar:', err.message);
  process.exit(1);
}
