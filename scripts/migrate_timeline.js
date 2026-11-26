const db = require('../config/database');

async function migrate() {
  console.log('--- INICIANDO MIGRACIÓN: TABLA EVIDENCIA_EVENTOS (TIMELINE) ---');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear tabla de eventos de evidencia fotográfica
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS evidencia_eventos (
        id BIGSERIAL PRIMARY KEY,
        fotografia_id UUID NOT NULL REFERENCES fotografia(id) ON DELETE CASCADE,
        usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
        tipo_evento VARCHAR(60) NOT NULL,
        descripcion TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await client.query(createTableSql);
    console.log('✓ Tabla evidencia_eventos creada o ya existente.');

    // 2. Crear índices para optimizar consultas de timeline
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_evidencia_eventos_foto_fecha 
      ON evidencia_eventos(fotografia_id, created_at ASC);
    `);
    console.log('✓ Índice idx_evidencia_eventos_foto_fecha verificado.');

    // 3. Crear eventos históricos iniciales para fotografías que ya existan sin historial
    const photosWithoutEvents = await client.query(`
      SELECT f.id, f.usuario_id, f.sector, f.nombre_original, f.tamano_bytes, f.created_at, f.dano_id
      FROM fotografia f
      LEFT JOIN evidencia_eventos e ON f.id = e.fotografia_id
      WHERE e.id IS NULL
    `);

    for (const p of photosWithoutEvents.rows) {
      // Evento 1: Fotografía registrada
      await client.query(`
        INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
        VALUES ($1, $2, 'FOTO_REGISTRADA', $3, $4, $5)
      `, [
        p.id,
        p.usuario_id,
        `Fotografía pericial registrada en terreno: ${p.nombre_original || 'evidencia.jpg'}`,
        JSON.stringify({ nombre_original: p.nombre_original, tamano_bytes: p.tamano_bytes }),
        p.created_at || new Date()
      ]);

      // Evento 2: Archivo físico almacenado
      await client.query(`
        INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
        VALUES ($1, $2, 'ARCHIVO_ALMACENADO', $3, $4, $5)
      `, [
        p.id,
        p.usuario_id,
        `Archivo almacenado en almacenamiento persistente (${(parseInt(p.tamano_bytes || 0, 10) / 1024).toFixed(1)} KB)`,
        JSON.stringify({ tamano_bytes: p.tamano_bytes }),
        p.created_at || new Date()
      ]);

      // Evento 3: Sector asociado
      if (p.sector) {
        await client.query(`
          INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
          VALUES ($1, $2, 'SECTOR_ASOCIADO', $3, $4, $5)
        `, [
          p.id,
          p.usuario_id,
          `Evidencia asociada al sector "${p.sector}"`,
          JSON.stringify({ sector: p.sector }),
          p.created_at || new Date()
        ]);
      }

      // Evento 4: Daño vinculado si existiera
      if (p.dano_id) {
        await client.query(`
          INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
          VALUES ($1, $2, 'DANO_VINCULADO', 'Evidencia vinculada a partida de daño pericial', '{}'::jsonb, $3)
        `, [
          p.id,
          p.usuario_id,
          p.created_at || new Date()
        ]);
      }
    }
    console.log(`✓ Generados eventos iniciales para ${photosWithoutEvents.rows.length} fotografías existentes.`);

    await client.query('COMMIT');
    console.log('\n=============================================================');
    console.log('¡MIGRACIÓN DE TIMELINE COMPLETADA CON ÉXITO EN POSTGRESQL!');
    console.log('=============================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en migración:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();

