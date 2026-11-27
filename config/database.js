const { Pool } = require('pg');
require('dotenv').config();

function safeParseDatabaseUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 5432,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'postgres',
      ssl: { rejectUnauthorized: false }
    };
  } catch (err) {
    // Si falla por caracteres especiales no codificados en la contraseña como ? o @
    const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^@:]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4] || '5432', 10),
        database: match[5],
        ssl: { rejectUnauthorized: false }
      };
    }
  }
  return null;
}

const parsedRemoteConfig = safeParseDatabaseUrl(process.env.DATABASE_URL);

const poolConfig = parsedRemoteConfig
  ? {
      ...parsedRemoteConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'lorens_db',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB POOL ERROR] Error inesperado en el cliente idle de PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

