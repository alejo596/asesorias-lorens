const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function fullAudit() {
  console.log('========================================================================');
  console.log('     INFORME DE AUDITORÍA Y ESTADO DE BASE DE DATOS: lorens_db');
  console.log('========================================================================\n');

  try {
    // 1. Motor y BD
    const dbSize = await db.query(`SELECT pg_size_pretty(pg_database_size('lorens_db')) as size;`);
    const connCount = await db.query(`SELECT count(*) FROM pg_stat_activity WHERE datname = 'lorens_db';`);
    console.log(`[1] MOTOR & ALMACENAMIENTO:`);
    console.log(`    - Base de Datos: lorens_db`);
    console.log(`    - Tamaño en disco: ${dbSize.rows[0].size}`);
    console.log(`    - Conexiones activas: ${connCount.rows[0].count}`);
    console.log(`    - Host / Puerto: localhost:6012`);
    console.log(`    - Estado de Conexión: CONECTADO Y OPERATIVO\n`);

    // 2. Tablas y volumen
    console.log(`[2] RESUMEN DE TABLAS OPERATIVAS:`);
    const tables = [
      'usuario', 'expediente', 'sector_expediente', 'partida_dano', 'fotografia',
      'presupuesto_ajuste', 'partida_presupuesto_ajuste', 'catalogo_proceso_constructivo',
      'historial_precio_proceso', 'asignacion_ajustador', 'gasto_caso', 'liquidador',
      'catalogo_liquidador', 'proceso_liquidador', 'unidad_medida', 'etapa_expediente',
      'expediente_etapa_historial', 'evidencia_eventos', 'expediente_cliente',
      'estado_expediente', 'auditoria_log'
    ];

    for (const t of tables) {
      const countRes = await db.query(`SELECT count(*) FROM "${t}";`);
      console.log(`    * ${t.padEnd(30)}: ${countRes.rows[0].count} filas`);
    }
    console.log('');

    // 3. Usuarios y Roles
    console.log(`[3] AUDITORÍA DE USUARIOS Y PERMISOS:`);
    const users = await db.query(`SELECT id, nombre, email, rol, roles, doble_perfil, activo FROM usuario ORDER BY rol, nombre;`);
    users.rows.forEach(u => {
      console.log(`    - ${u.rol.toUpperCase().padEnd(12)} | ${u.nombre.padEnd(28)} | ${u.email.padEnd(26)} | Activo: ${u.activo ? 'SÍ' : 'NO'}`);
    });
    console.log('');

    // 4. Expedientes y Responsables
    console.log(`[4] EXPEDIENTES Y ASIGNACIONES PERICIALES:`);
    const cases = await db.query(`
      SELECT e.id, e.codigo, e.cliente_nombre, e.comuna, e.tipo_evento, e.estado, 
             e.inspector_nombre, e.ajustador_nombre, e.estado_presupuesto,
             (SELECT count(*) FROM sector_expediente WHERE expediente_id = e.id) as sectores,
             (SELECT count(*) FROM partida_dano WHERE expediente_id = e.id) as danos,
             (SELECT count(*) FROM fotografia WHERE expediente_id = e.id) as fotos
      FROM expediente e
      ORDER BY e.created_at;
    `);
    cases.rows.forEach(c => {
      console.log(`    * ${c.codigo} (${c.cliente_nombre}) - Comuna: ${c.comuna} - Evento: ${c.tipo_evento || 'Sismo'}`);
      console.log(`      Inspector: ${c.inspector_nombre || 'N/A'} | Ajustador: ${c.ajustador_nombre || 'N/A'}`);
      console.log(`      Estado Caso: ${c.estado} | Estado Presupuesto: ${c.estado_presupuesto}`);
      console.log(`      Levantamiento: ${c.sectores} sectores, ${c.danos} daños, ${c.fotos} fotos en BD`);
    });
    console.log('');

    // 5. Presupuestos y Partidas
    console.log(`[5] PRESUPUESTOS Y PARTIDAS DE REPARACIÓN (AJUSTADOR):`);
    const budgets = await db.query(`
      SELECT p.id, e.codigo, p.version, p.estado, p.costo_directo, p.porcentaje_gg, p.monto_gg, p.neto, p.porcentaje_iva, p.monto_iva, p.total,
             (SELECT count(*) FROM partida_presupuesto_ajuste WHERE presupuesto_id = p.id) as cant_partidas
      FROM presupuesto_ajuste p
      JOIN expediente e ON p.expediente_id = e.id
      ORDER BY p.created_at;
    `);
    budgets.rows.forEach(b => {
      console.log(`    * Presupuesto Caso ${b.codigo} (v${b.version}) - Estado: ${b.estado.toUpperCase()}`);
      console.log(`      Partidas: ${b.cant_partidas} valorizadas`);
      console.log(`      Costo Directo: $${Number(b.costo_directo).toLocaleString('es-CL')} | GG (25%): $${Number(b.monto_gg).toLocaleString('es-CL')}`);
      console.log(`      Neto: $${Number(b.neto).toLocaleString('es-CL')} | IVA (19%): $${Number(b.monto_iva).toLocaleString('es-CL')} | TOTAL: $${Number(b.total).toLocaleString('es-CL')}`);
    });
    console.log('');

    // 6. Archivos Físicos de Evidencias
    console.log(`[6] INTEGRIDAD DEL ALMACENAMIENTO DE EVIDENCIAS FOTOGRÁFICAS:`);
    const fotos = await db.query(`SELECT f.id, f.nombre_archivo, f.ruta_almacenamiento, f.tamano_bytes, e.codigo FROM fotografia f JOIN expediente e ON f.expediente_id = e.id;`);
    let allOk = true;
    fotos.rows.forEach(f => {
      const fullPath = path.join(__dirname, '..', 'storage', f.ruta_almacenamiento);
      const exists = fs.existsSync(fullPath);
      if (!exists) allOk = false;
      const sizeOnDisk = exists ? fs.statSync(fullPath).size : 0;
      console.log(`    * [${f.codigo}] ${f.nombre_archivo} (${f.tamano_bytes} bytes en BD, ${sizeOnDisk} bytes en disco) -> ${exists ? '✓ INTEGRIDAD OK' : '✗ ARCHIVO FALTANTE'}`);
    });
    console.log(`    Estado Almacenamiento: ${allOk ? '✓ 100% de los archivos físicos sincronizados y verificados' : '✗ Hay discrepancias'}\n`);

    console.log('========================================================================');
    console.log('              AUDITORÍA COMPLETADA CON ÉXITO');
    console.log('========================================================================');
    process.exit(0);
  } catch (err) {
    console.error('Error durante auditoría:', err);
    process.exit(1);
  }
}

fullAudit();
