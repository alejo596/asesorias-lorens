const db = require('../config/database');
const bcrypt = require('bcryptjs');

async function migrateClientPortal() {
  console.log('=== MIGRACIÓN POSTGRESQL: PORTAL DEL CLIENTE ===');

  try {
    // 1. Agregar 'cliente' al ENUM user_role (debe ejecutarse fuera de bloque de transacción)
    console.log('1. Verificando rol cliente en user_role...');
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
          WHERE typname = 'user_role' AND enumlabel = 'cliente'
        ) THEN
          ALTER TYPE user_role ADD VALUE 'cliente';
        END IF;
      END $$;
    `);
    console.log('✓ Rol cliente asegurado en enum user_role.');

    // 2. Crear tabla de Etapas del Expediente
    console.log('2. Creando tabla etapa_expediente...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS etapa_expediente (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion_publica TEXT,
        orden INT NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    // Insertar catálogo oficial de etapas
    const etapas = [
      { id: 'ingresado', nombre: 'Expediente ingresado', descripcion_publica: 'Recepción formal del denuncio y creación del expediente de siniestro.', orden: 1 },
      { id: 'asignacion_inspector', nombre: 'Asignación de inspector', descripcion_publica: 'Designación del perito inspector responsable de la evaluación.', orden: 2 },
      { id: 'visita_programada', nombre: 'Visita programada', descripcion_publica: 'Coordinación y calendarización de la inspección pericial en el inmueble.', orden: 3 },
      { id: 'inspeccion_terreno', nombre: 'Inspección en terreno', descripcion_publica: 'Levantamiento pericial de daños, mediciones y antecedentes en sitio.', orden: 4 },
      { id: 'evidencia', nombre: 'Evidencia', descripcion_publica: 'Revisión, procesamiento técnico y validación de las evidencias fotográficas.', orden: 5 },
      { id: 'revision_tecnica', nombre: 'Revisión técnica', descripcion_publica: 'Análisis de daños estructurales y verificación pericial de partidas.', orden: 6 },
      { id: 'cuantificacion', nombre: 'Cuantificación', descripcion_publica: 'Cálculo de presupuestos, metrajes y costos directos de reparación.', orden: 7 },
      { id: 'liquidacion', nombre: 'Liquidación', descripcion_publica: 'Determinación de cobertura y emisión del informe oficial de liquidación.', orden: 8 },
      { id: 'finalizado', nombre: 'Proceso finalizado', descripcion_publica: 'Expediente cerrado y formalmente tramitado.', orden: 9 }
    ];

    for (const e of etapas) {
      await db.query(`
        INSERT INTO etapa_expediente (id, nombre, descripcion_publica, orden)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          descripcion_publica = EXCLUDED.descripcion_publica,
          orden = EXCLUDED.orden;
      `, [e.id, e.nombre, e.descripcion_publica, e.orden]);
    }
    console.log('✓ Catálogo de 9 etapas del siniestro configurado.');

    // 3. Columna etapa_actual en expediente
    console.log('3. Agregando etapa_actual a expediente...');
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'expediente' AND column_name = 'etapa_actual'
        ) THEN
          ALTER TABLE expediente ADD COLUMN etapa_actual VARCHAR(50) DEFAULT 'evidencia' REFERENCES etapa_expediente(id);
        END IF;
      END $$;
    `);

    // 4. Tabla de relación expediente_cliente (M:N verificada)
    console.log('4. Creando tabla expediente_cliente...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS expediente_cliente (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
        usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
        titular BOOLEAN NOT NULL DEFAULT TRUE,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_expediente_cliente UNIQUE (expediente_id, usuario_id)
      );
      CREATE INDEX IF NOT EXISTS idx_expediente_cliente_usuario ON expediente_cliente(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_expediente_cliente_expediente ON expediente_cliente(expediente_id);
    `);
    console.log('✓ Tabla expediente_cliente creada con índices.');

    // 5. Tabla de Historial de Etapas del Expediente (Timeline oficial)
    console.log('5. Creando tabla expediente_etapa_historial...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS expediente_etapa_historial (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
        etapa_id VARCHAR(50) NOT NULL REFERENCES etapa_expediente(id),
        estado_proceso VARCHAR(30) NOT NULL DEFAULT 'completada' CHECK (estado_proceso IN ('completada', 'en_curso', 'pendiente', 'observada')),
        fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        fecha_fin TIMESTAMP WITH TIME ZONE,
        descripcion_interna TEXT,
        descripcion_publica TEXT NOT NULL,
        visible_cliente BOOLEAN NOT NULL DEFAULT TRUE,
        usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_etapa_historial_expediente ON expediente_etapa_historial(expediente_id, created_at ASC);
    `);
    console.log('✓ Tabla expediente_etapa_historial creada.');

    // 6. Columna visible_cliente en tabla fotografia
    console.log('6. Agregando visible_cliente a fotografia...');
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'fotografia' AND column_name = 'visible_cliente'
        ) THEN
          ALTER TABLE fotografia ADD COLUMN visible_cliente BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
      END $$;
    `);

    // 7. Insertar / Actualizar usuarios clientes de prueba
    console.log('7. Sembrando usuarios clientes...');
    const clientPassHash = await bcrypt.hash('Cliente2026!', 10);

    const clientUsers = [
      {
        id: 'a0000000-0000-0000-0000-000000000010',
        nombre: 'Juan Pérez (Asegurado)',
        email: 'juan.perez@gmail.com',
        caseCode: 'SIS-2026-084',
        stage: 'evidencia'
      },
      {
        id: 'a0000000-0000-0000-0000-000000000011',
        nombre: 'María González (Asegurada)',
        email: 'maria.gonzalez@gmail.com',
        caseCode: 'SIS-2026-085',
        stage: 'visita_programada' // Bloqueado: antes de Evidencia
      },
      {
        id: 'a0000000-0000-0000-0000-000000000012',
        nombre: 'Roberto Silva (Asegurado)',
        email: 'roberto.silva@empresa.cl',
        caseCode: 'SIS-2026-086',
        stage: 'finalizado' // Desbloqueado: finalizado
      }
    ];

    for (const c of clientUsers) {
      await db.query(`
        INSERT INTO usuario (id, nombre, email, password_hash, rol, doble_perfil, roles, activo)
        VALUES ($1, $2, $3, $4, 'cliente', FALSE, ARRAY['cliente'], TRUE)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          rol = 'cliente',
          roles = ARRAY['cliente'],
          activo = TRUE;
      `, [c.id, c.nombre, c.email, clientPassHash]);

      // Asociar con el expediente respectivo
      const caseRes = await db.query('SELECT id FROM expediente WHERE codigo = $1', [c.caseCode]);
      if (caseRes.rows.length > 0) {
        const caseId = caseRes.rows[0].id;
        
        // Actualizar etapa_actual del expediente
        await db.query('UPDATE expediente SET etapa_actual = $1 WHERE id = $2', [c.stage, caseId]);

        // Vincular en expediente_cliente
        await db.query(`
          INSERT INTO expediente_cliente (expediente_id, usuario_id, titular, activo)
          VALUES ($1, $2, TRUE, TRUE)
          ON CONFLICT (expediente_id, usuario_id) DO UPDATE SET activo = TRUE;
        `, [caseId, c.id]);

        // Poblar eventos históricos de etapas si no existen
        const histCount = await db.query('SELECT COUNT(*) FROM expediente_etapa_historial WHERE expediente_id = $1', [caseId]);
        if (parseInt(histCount.rows[0].count, 10) === 0) {
          console.log(`   Poblando historial de etapas para expediente ${c.caseCode} (${c.stage})...`);
          
          if (c.caseCode === 'SIS-2026-084') {
            // Caso en Evidencia: Etapas 1-4 completadas, etapa 5 en curso, 6-9 pendientes
            await db.query(`
              INSERT INTO expediente_etapa_historial (expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_publica, visible_cliente) VALUES
              ($1, 'ingresado', 'completada', '2026-05-31 09:30:00-04', '2026-05-31 10:15:00-04', 'Denuncio recepcionado correctamente en plataforma oficial Lorens.', TRUE),
              ($1, 'asignacion_inspector', 'completada', '2026-05-31 11:00:00-04', '2026-05-31 11:45:00-04', 'Perito inspector Pedro Pérez asignado al caso pericial.', TRUE),
              ($1, 'visita_programada', 'completada', '2026-06-01 10:00:00-04', '2026-06-01 16:30:00-04', 'Visita pericial confirmada y coordinada para el 02/06/2026.', TRUE),
              ($1, 'inspeccion_terreno', 'completada', '2026-06-02 09:00:00-04', '2026-06-02 12:30:00-04', 'Inspección de daños realizada exitosamente en el inmueble.', TRUE),
              ($1, 'evidencia', 'en_curso', '2026-06-02 14:00:00-04', NULL, 'Se está realizando la revisión y organización de antecedentes fotográficos del siniestro.', TRUE);
            `, [caseId]);
          } else if (c.caseCode === 'SIS-2026-085') {
            // Caso en Visita programada (Antes de Evidencia)
            await db.query(`
              INSERT INTO expediente_etapa_historial (expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_publica, visible_cliente) VALUES
              ($1, 'ingresado', 'completada', '2026-06-01 14:20:00-04', '2026-06-01 15:00:00-04', 'Expediente registrado en el sistema.', TRUE),
              ($1, 'asignacion_inspector', 'completada', '2026-06-01 16:00:00-04', '2026-06-01 16:30:00-04', 'Inspector técnico asignado para la atención del siniestro.', TRUE),
              ($1, 'visita_programada', 'en_curso', '2026-06-02 09:00:00-04', NULL, 'En proceso de coordinación telefónica de la fecha de visita pericial.', TRUE);
            `, [caseId]);
          } else if (c.caseCode === 'SIS-2026-086') {
            // Caso Finalizado: Todas las etapas completadas
            await db.query(`
              INSERT INTO expediente_etapa_historial (expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_publica, visible_cliente) VALUES
              ($1, 'ingresado', 'completada', '2026-05-20 08:30:00-04', '2026-05-20 09:00:00-04', 'Expediente recepcionado.', TRUE),
              ($1, 'asignacion_inspector', 'completada', '2026-05-20 10:00:00-04', '2026-05-20 10:30:00-04', 'Inspector Pedro Pérez asignado.', TRUE),
              ($1, 'visita_programada', 'completada', '2026-05-21 11:00:00-04', '2026-05-21 17:00:00-04', 'Visita coordinada.', TRUE),
              ($1, 'inspeccion_terreno', 'completada', '2026-05-22 09:30:00-04', '2026-05-22 13:00:00-04', 'Inspección en terreno completada.', TRUE),
              ($1, 'evidencia', 'completada', '2026-05-22 14:00:00-04', '2026-05-23 11:00:00-04', 'Evidencias fotográficas procesadas y validadas.', TRUE),
              ($1, 'revision_tecnica', 'completada', '2026-05-23 11:30:00-04', '2026-05-24 16:00:00-04', 'Revisión técnica de partidas aprobada.', TRUE),
              ($1, 'cuantificacion', 'completada', '2026-05-25 09:00:00-04', '2026-05-25 18:00:00-04', 'Cálculo de presupuestos y cubicaciones completado.', TRUE),
              ($1, 'liquidacion', 'completada', '2026-05-26 10:00:00-04', '2026-05-27 15:00:00-04', 'Informe pericial de liquidación emitido.', TRUE),
              ($1, 'finalizado', 'completada', '2026-05-28 12:00:00-04', '2026-05-28 12:00:00-04', 'Proceso de siniestro liquidado y cerrado exitosamente.', TRUE);
            `, [caseId]);
          }
        }
      }
    }

    console.log('✓ Usuarios clientes vinculados con expedientes y etapas históricas.');

    // 8. Asegurar que las fotos del caso SIS-2026-084 tengan visible_cliente = TRUE
    await db.query(`
      UPDATE fotografia SET visible_cliente = TRUE WHERE visible_cliente IS NULL;
    `);

    console.log('=== MIGRACIÓN DEL PORTAL DEL CLIENTE EXITOSA ===');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migración del portal del cliente:', err);
    process.exit(1);
  }
}

migrateClientPortal();

