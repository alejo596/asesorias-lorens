const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function inspectDB() {
  console.log('========================================================================');
  console.log('        DIAGNÓSTICO COMPLETO DE BASE DE DATOS: lorens_db');
  console.log('========================================================================\n');

  try {
    // 1. Conexión y versión del motor
    const versionRes = await db.query('SELECT version();');
    const connInfo = await db.query('SELECT current_database(), current_user, inet_server_port();');
    console.log('[1] CONEXIÓN Y MOTOR:');
    console.log(`    Motor: ${versionRes.rows[0].version.split(',')[0]}`);
    console.log(`    BD Actual: ${connInfo.rows[0].current_database}`);
    console.log(`    Usuario: ${connInfo.rows[0].current_user}`);
    console.log(`    Puerto Servidor: ${connInfo.rows[0].inet_server_port}\n`);

    // 2. Tablas y conteo de filas
    console.log('[2] TABLAS Y REGISTROS EN SCHEMA "public":');
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    for (const t of tablesRes.rows) {
      try {
        const countRes = await db.query(`SELECT count(*) FROM "${t.table_name}";`);
        console.log(`    - ${t.table_name.padEnd(32)}: ${countRes.rows[0].count} registros`);
      } catch (err) {
        console.log(`    - ${t.table_name.padEnd(32)}: Error (${err.message})`);
      }
    }
    console.log('');

    // 3. Enums definidos
    console.log('[3] TIPOS ENUM DEFINIDOS:');
    const enumsRes = await db.query(`
      SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      GROUP BY t.typname
      ORDER BY t.typname;
    `);
    enumsRes.rows.forEach(e => {
      console.log(`    * ${e.typname}: [${e.valores}]`);
    });
    console.log('');

    // 4. Catálogo de Usuarios y Roles
    console.log('[4] USUARIOS REGISTRADOS (usuario):');
    const usersRes = await db.query(`
      SELECT id, nombre, email, rol, doble_perfil, roles, activo, created_at
      FROM usuario
      ORDER BY created_at ASC;
    `);
    usersRes.rows.forEach(u => {
      console.log(`    - [${u.rol.padEnd(10)}] ${u.nombre.padEnd(30)} | ${u.email.padEnd(25)} | Activo: ${u.activo ? 'SÍ' : 'NO'} | Doble: ${u.doble_perfil ? 'SÍ' : 'NO'}`);
    });
    console.log('');

    // 5. Columnas de Expediente
    const expCols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'expediente'
      ORDER BY ordinal_position;
    `);
    console.log('[5] ESTRUCTURA DE LA TABLA "expediente":');
    console.log('    Columnas: ' + expCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', ') + '\n');

    // 6. Expedientes / Casos
    console.log('[6] REGISTROS DE EXPEDIENTES (expediente):');
    const casesRes = await db.query(`SELECT * FROM expediente ORDER BY created_at ASC;`);
    for (const c of casesRes.rows) {
      const secCount = await db.query('SELECT count(*) FROM sector_expediente WHERE expediente_id = $1', [c.id]);
      const danoCount = await db.query('SELECT count(*) FROM partida_dano WHERE expediente_id = $1', [c.id]);
      const fotoCount = await db.query('SELECT count(*) FROM fotografia WHERE expediente_id = $1', [c.id]);

      console.log(`    - Caso ID: ${c.id}`);
      console.log(`      Código: ${c.numero_siniestro || c.codigo} | Asegurado: ${c.asegurado_nombre || c.cliente_nombre || 'N/A'}`);
      console.log(`      Comuna: ${c.comuna || 'N/A'} | Dirección: ${c.direccion || 'N/A'}`);
      console.log(`      Inspector: ${c.inspector_nombre || 'Sin asignar'} | Ajustador: ${c.ajustador_nombre || 'Sin asignar'}`);
      console.log(`      Estado Presupuesto: ${c.estado_presupuesto || 'N/A'}`);
      console.log(`      Contenido: ${secCount.rows[0].count} sectores, ${danoCount.rows[0].count} daños, ${fotoCount.rows[0].count} fotografías\n`);
    }

    // 7. Presupuestos y Partidas del Ajustador
    console.log('[7] PRESUPUESTOS DE AJUSTE (presupuesto_ajuste):');
    const budgetsRes = await db.query(`SELECT * FROM presupuesto_ajuste ORDER BY created_at DESC;`);
    if (budgetsRes.rows.length === 0) {
      console.log('    (Sin presupuestos registrados)');
    } else {
      for (const b of budgetsRes.rows) {
        const pCount = await db.query('SELECT count(*) FROM partida_presupuesto_ajuste WHERE presupuesto_id = $1', [b.id]);
        console.log(`    - Presupuesto ID: ${b.id} (Caso: ${b.expediente_id}) | Versión: v${b.version} | Estado: ${String(b.estado).toUpperCase()}`);
        console.log(`      Partidas valorizadas: ${pCount.rows[0].count}`);
        console.log(`      Costo Directo: $${Number(b.costo_directo || 0).toLocaleString('es-CL')}`);
        console.log(`      GG & Utilidades (${b.porcentaje_gg || 25}%): $${Number(b.monto_gg || 0).toLocaleString('es-CL')}`);
        console.log(`      Neto: $${Number(b.neto || 0).toLocaleString('es-CL')}`);
        console.log(`      IVA (${b.porcentaje_iva || 19}%): $${Number(b.monto_iva || 0).toLocaleString('es-CL')}`);
        console.log(`      TOTAL: $${Number(b.total || 0).toLocaleString('es-CL')}\n`);
      }
    }

    // 8. Catálogo de Procesos Constructivos
    console.log('[8] CATÁLOGO DE PROCESOS CONSTRUCTIVOS (catalogo_proceso_constructivo):');
    const procRes = await db.query(`
      SELECT p.codigo, p.nombre, p.unidad_id, p.precio_unitario_sugerido, p.categoria
      FROM catalogo_proceso_constructivo p
      ORDER BY p.categoria, p.nombre;
    `);
    procRes.rows.forEach(p => {
      console.log(`    - [${p.codigo.padEnd(16)}] ${p.nombre.padEnd(45)} | ${p.unidad_id.padEnd(4)} | Sugerido: $${Number(p.precio_unitario_sugerido).toLocaleString('es-CL')}`);
    });
    console.log('');

    // 9. Verificación de Fotografías
    console.log('[9] VERIFICACIÓN DE FOTOGRAFÍAS:');
    const fotoCols = await db.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'fotografia' ORDER BY ordinal_position;
    `);
    console.log('    Columnas fotografia: ' + fotoCols.rows.map(c => c.column_name).join(', '));
    const fotos = await db.query('SELECT * FROM fotografia LIMIT 5;');
    fotos.rows.forEach(f => {
      const ruta = f.ruta_archivo || f.url_archivo || f.ruta || f.url || '';
      const fullPath = path.isAbsolute(ruta) ? ruta : path.join(__dirname, '..', ruta);
      const exists = ruta ? fs.existsSync(fullPath) : false;
      console.log(`    - ID: ${f.id} | Archivo: ${f.nombre_archivo || f.archivo || 'N/A'} | En disco: ${exists ? 'OK' : 'Falta archivo'}`);
    });

    console.log('\n========================================================================');
    console.log('              ESTADO GENERAL: BASE DE DATOS SALUDABLE');
    console.log('========================================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ ERROR AL INSPECCIONAR BASE DE DATOS:', error.message);
    if (error.code) console.error('  Código de error SQL:', error.code);
    if (error.detail) console.error('  Detalle:', error.detail);
    process.exit(1);
  }
}

inspectDB();
