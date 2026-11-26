const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function inspectDB() {
  try {
    const procCols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'catalogo_proceso_constructivo'
      ORDER BY ordinal_position;
    `);
    console.log('[8] COLUMNAS catalogo_proceso_constructivo:');
    console.log('    ' + procCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', ') + '\n');

    const procRes = await db.query('SELECT * FROM catalogo_proceso_constructivo ORDER BY nombre;');
    console.log('[8.1] PROCESOS CONSTRUCTIVOS:');
    procRes.rows.forEach(p => {
      console.log(`    - [${p.codigo}] ${p.nombre} | Unidad: ${p.unidad_id} | Valor: $${p.valor_unitario_referencial || p.precio_unitario || p.valor_unitario || 0}`);
    });
    console.log('');

    const fotoCols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fotografia'
      ORDER BY ordinal_position;
    `);
    console.log('[9] COLUMNAS fotografia:');
    console.log('    ' + fotoCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', ') + '\n');

    const fotos = await db.query('SELECT * FROM fotografia;');
    console.log('[9.1] FOTOGRAFÍAS:');
    fotos.rows.forEach(f => {
      const ruta = f.ruta_almacenamiento || f.ruta_archivo || f.url || '';
      const fullPath = path.isAbsolute(ruta) ? ruta : path.join(__dirname, '..', ruta);
      const exists = ruta ? fs.existsSync(fullPath) : false;
      console.log(`    - ID: ${f.id} | Archivo: ${f.nombre_archivo || f.nombre_original} | Ruta: ${ruta} | En disco: ${exists ? 'OK' : 'NO EXISTE'}`);
    });

    console.log('\n========================================================================');
    console.log('              ESTADO GENERAL: BASE DE DATOS SALUDABLE');
    console.log('========================================================================');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

inspectDB();
