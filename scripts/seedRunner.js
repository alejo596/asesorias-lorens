const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function runSeeds() {
  console.log('--- INICIANDO MIGRACIÓN Y SEMILLAS ASESORÍAS LORENS ---');
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    const seedsSql = fs.readFileSync(path.join(__dirname, '..', 'seeds.sql'), 'utf8');

    console.log('1. Ejecutando schema.sql en PostgreSQL...');
    await db.query(schemaSql);
    console.log('✓ Tablas, ENUMs e índices creados correctamente.');

    console.log('2. Ejecutando seeds.sql en PostgreSQL...');
    await db.query(seedsSql);
    console.log('✓ Datos iniciales insertados correctamente (Unidades, Usuarios, Liquidadores, Caso SIS-2026-084, Partidas y Gastos).');

    console.log('--- MIGRACIÓN COMPLETADA EXITOSAMENTE ---');
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar migración:', error.message);
    process.exit(1);
  }
}

runSeeds();

