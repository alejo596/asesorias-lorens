const db = require('../config/database');

async function migrate() {
  console.log('=== INICIANDO MIGRACIÓN SEGURA PARA MÓDULO INSPECTOR ===');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Extensión UUID
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 2. Columnas en usuario
    console.log('1. Verificando tabla usuario...');
    await client.query(`
      ALTER TABLE usuario 
        ADD COLUMN IF NOT EXISTS doble_perfil BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['inspector'];
    `);

    // 3. Tabla estado_expediente
    console.log('2. Verificando tabla estado_expediente...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS estado_expediente (
        id VARCHAR(30) PRIMARY KEY,
        nombre VARCHAR(60) NOT NULL,
        descripcion VARCHAR(255),
        color VARCHAR(30) DEFAULT '#0284c7',
        badge_clase VARCHAR(50) DEFAULT 'blue lighten-5 blue-text text-darken-3',
        orden INT DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO estado_expediente (id, nombre, descripcion, color, badge_clase, orden) VALUES
        ('activo', 'Activo', 'Expediente en curso de inspección activa', '#10b981', 'green lighten-5 green-text text-darken-3', 1),
        ('en_espera', 'En espera', 'Expediente pausado, en espera de documentación o peritaje', '#f59e0b', 'amber lighten-5 amber-text text-darken-4', 2),
        ('procesado', 'Procesado', 'Expediente liquidado, revisado y procesado oficialmente', '#3b82f6', 'blue lighten-5 blue-text text-darken-3', 3)
      ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        color = EXCLUDED.color,
        badge_clase = EXCLUDED.badge_clase,
        orden = EXCLUDED.orden;
    `);

    // 4. Columnas en expediente
    console.log('3. Verificando tabla expediente...');
    await client.query(`
      ALTER TABLE expediente 
        ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'activo',
        ADD COLUMN IF NOT EXISTS avance_porcentaje INT DEFAULT 0;
    `);

    // Asegurar FK de estado si no existe
    try {
      await client.query(`
        ALTER TABLE expediente 
          ADD CONSTRAINT fk_expediente_estado FOREIGN KEY (estado) REFERENCES estado_expediente(id);
      `);
    } catch (e) {
      // Ignorar si ya existe
    }

    // 5. Tabla sector_expediente
    console.log('4. Creando tabla sector_expediente...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sector_expediente (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT,
        estado VARCHAR(30) NOT NULL DEFAULT 'activo',
        usuario_id UUID REFERENCES usuario(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_expediente_sector UNIQUE (expediente_id, nombre)
      );

      CREATE INDEX IF NOT EXISTS idx_sector_expediente_id ON sector_expediente(expediente_id);
    `);

    // 6. Columnas en partida_dano
    console.log('5. Verificando tabla partida_dano...');
    await client.query(`
      ALTER TABLE partida_dano
        ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sector_expediente(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS materialidad VARCHAR(150),
        ADD COLUMN IF NOT EXISTS cantidad_afectada NUMERIC(12, 3),
        ADD COLUMN IF NOT EXISTS porcentaje_intervencion NUMERIC(5, 2) DEFAULT 100.00;
    `);

    // 7. Columnas en fotografia
    console.log('6. Verificando tabla fotografia...');
    await client.query(`
      ALTER TABLE fotografia
        ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sector_expediente(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS dano_id UUID REFERENCES partida_dano(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS nombre_original VARCHAR(255),
        ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuario(id),
        ADD COLUMN IF NOT EXISTS fecha_captura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS ruta_thumbnail VARCHAR(500);

      CREATE INDEX IF NOT EXISTS idx_fotografia_expediente_id ON fotografia(expediente_id);
      CREATE INDEX IF NOT EXISTS idx_fotografia_sector_id ON fotografia(sector_id);
      CREATE INDEX IF NOT EXISTS idx_fotografia_dano_id ON fotografia(dano_id);
    `);

    // 8. Crear / Sincronizar usuarios base
    console.log('7. Sincronizando usuarios base...');
    await client.query(`
      INSERT INTO usuario (id, nombre, email, password_hash, rol, doble_perfil, roles) VALUES
      ('a0000000-0000-0000-0000-000000000000', 'Webmaster Lorens (Admin General)', 'webmaster@lorens.cl', 
      '$2a$10$uXJDvaQNjpEaIXDMGoADe.fKoAnR8Rg2s1LDxyaXiYPJeEubjdFYW', 'admin', TRUE, ARRAY['admin', 'inspector']),
      ('a0000000-0000-0000-0000-000000000001', 'Pedro Pérez (Inspector)', 'inspector@lorens.cl', 
      '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC', 'inspector', FALSE, ARRAY['inspector']),
      ('a0000000-0000-0000-0000-000000000002', 'Alejandro Vargas (Admin)', 'admin@lorens.cl', 
      '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC', 'admin', FALSE, ARRAY['admin'])
      ON CONFLICT (email) DO UPDATE SET 
        password_hash = EXCLUDED.password_hash, 
        rol = EXCLUDED.rol,
        doble_perfil = EXCLUDED.doble_perfil,
        roles = EXCLUDED.roles;
    `);

    // 9. Sincronizar expedientes asignados a Pedro Pérez (Inspector)
    console.log('8. Sincronizando expedientes asignados...');
    const inspectorId = 'a0000000-0000-0000-0000-000000000001';
    const liquidadorId = 'b0000000-0000-0000-0000-000000000001';

    await client.query(`
      INSERT INTO expediente (
        id, codigo, cliente_nombre, cliente_rut, cliente_telefono, cliente_email, direccion, comuna, ciudad,
        liquidador_id, estado, tipo_evento, tipo_inmueble, sistema_constructivo, fecha_evento, fecha_visita, 
        inspector_id, inspector_nombre, numero_poliza, numero_siniestro,
        porcentaje_gg, porcentaje_utilidad, tasa_iva, avance_porcentaje
      ) VALUES 
      (
        'd0000000-0000-0000-0000-000000000001', 'SIS-2026-084', 'Juan Pérez', '12.345.678-9', '+56 9 8765 4321', 'juan.perez@gmail.com',
        'Av. Arturo Prat 2043, Alto Hospicio', 'Alto Hospicio', 'Alto Hospicio',
        '${liquidadorId}', 'activo', 'Sismo', 'Casa de dos pisos', 'Albañilería confinada', '2026-05-31', '2026-06-02', 
        '${inspectorId}', 'Pedro Pérez (Inspector)', 'POL-99281-2026', 'SIN-881273',
        25.00, 0.00, 19.00, 60
      ),
      (
        'd0000000-0000-0000-0000-000000000002', 'SIS-2026-085', 'María González', '14.892.123-K', '+56 9 7654 3210', 'maria.gonzalez@gmail.com',
        'Calle Los Álamos 450, Iquique', 'Iquique', 'Iquique',
        '${liquidadorId}', 'en_espera', 'Incendio parcial', 'Departamento', 'Hormigón armado', '2026-06-01', '2026-06-03', 
        '${inspectorId}', 'Pedro Pérez (Inspector)', 'POL-77123-2026', 'SIN-449102',
        25.00, 0.00, 19.00, 20
      ),
      (
        'd0000000-0000-0000-0000-000000000003', 'SIS-2026-086', 'Roberto Silva', '9.765.432-1', '+56 9 6543 2109', 'roberto.silva@empresa.cl',
        'Pasaje Central 128, Pozo Almonte', 'Pozo Almonte', 'Pozo Almonte',
        'b0000000-0000-0000-0000-000000000002', 'procesado', 'Inundación Matriz', 'Local Comercial', 'Albañilería', '2026-05-20', '2026-05-22', 
        '${inspectorId}', 'Pedro Pérez (Inspector)', 'POL-66542-2026', 'SIN-339811',
        20.00, 5.00, 19.00, 100
      )
      ON CONFLICT (codigo) DO UPDATE SET
        inspector_id = EXCLUDED.inspector_id,
        inspector_nombre = EXCLUDED.inspector_nombre,
        estado = EXCLUDED.estado,
        cliente_nombre = EXCLUDED.cliente_nombre,
        cliente_rut = EXCLUDED.cliente_rut,
        cliente_telefono = EXCLUDED.cliente_telefono,
        cliente_email = EXCLUDED.cliente_email,
        direccion = EXCLUDED.direccion,
        comuna = EXCLUDED.comuna,
        ciudad = EXCLUDED.ciudad,
        tipo_evento = EXCLUDED.tipo_evento,
        tipo_inmueble = EXCLUDED.tipo_inmueble,
        sistema_constructivo = EXCLUDED.sistema_constructivo,
        fecha_evento = EXCLUDED.fecha_evento,
        fecha_visita = EXCLUDED.fecha_visita,
        numero_poliza = EXCLUDED.numero_poliza,
        numero_siniestro = EXCLUDED.numero_siniestro,
        avance_porcentaje = EXCLUDED.avance_porcentaje;
    `);

    // 10. Población de sectores para el caso SIS-2026-084
    console.log('9. Sincronizando sectores para caso SIS-2026-084...');
    const caseId1 = 'd0000000-0000-0000-0000-000000000001';
    await client.query(`
      INSERT INTO sector_expediente (id, expediente_id, nombre, descripcion, usuario_id) VALUES
      ('f0000000-0000-0000-0000-000000000001', '${caseId1}', 'BAÑO 1', 'Baño principal en primer piso', '${inspectorId}'),
      ('f0000000-0000-0000-0000-000000000002', '${caseId1}', 'LIVING COMEDOR', 'Área común principal acceso', '${inspectorId}'),
      ('f0000000-0000-0000-0000-000000000003', '${caseId1}', 'COCINA', 'Cocina y logia posterior', '${inspectorId}'),
      ('f0000000-0000-0000-0000-000000000004', '${caseId1}', 'DORMITORIO 1', 'Dormitorio secundario poniente', '${inspectorId}')
      ON CONFLICT (expediente_id, nombre) DO NOTHING;
    `);

    // Vincular partidas existentes con los sectores
    await client.query(`
      UPDATE partida_dano p
      SET sector_id = s.id
      FROM sector_expediente s
      WHERE p.expediente_id = s.expediente_id 
        AND UPPER(p.sector) = UPPER(s.nombre)
        AND p.sector_id IS NULL;
    `);

    await client.query('COMMIT');
    console.log('✓ Migración completada exitosamente sin pérdida de datos.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;

