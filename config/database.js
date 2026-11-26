const { Pool } = require('pg');
require('dotenv').config();

const isRemoteUrl = Boolean(process.env.DATABASE_URL);
let cleanConnectionString = process.env.DATABASE_URL;
if (cleanConnectionString && cleanConnectionString.includes('sslmode=')) {
  cleanConnectionString = cleanConnectionString.replace(/[?&]sslmode=[^&]+/, '');
}

const poolConfig = isRemoteUrl
  ? {
      connectionString: cleanConnectionString,
      ssl: { rejectUnauthorized: false },
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

