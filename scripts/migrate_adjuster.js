const db = require('../config/database');
const bcrypt = require('bcryptjs');

async function migrate() {
  console.log('=====================================================');
  console.log('  MIGRACIÓN: MÓDULO AJUSTADOR Y PRESUPUESTO LORENS');
  console.log('=====================================================');

  try {
    // 1. Ampliar user_role enum con 'ajustador'
    console.log('[1/8] Verificando enum user_role en PostgreSQL...');
    await db.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_enum e
              JOIN pg_type t ON e.enumtypid = t.oid
              WHERE t.typname = 'user_role' AND e.enumlabel = 'ajustador'
          ) THEN
              ALTER TYPE user_role ADD VALUE 'ajustador';
          END IF;
      END $$;
    `);
    console.log('✓ Enum user_role incluye "ajustador".');

    // 2. Crear usuario Ajustador de prueba
    console.log('[2/8] Creando usuario ajustador de prueba...');
    const hashed = await bcrypt.hash('Password123!', 10);
    const ajustadorId = 'a0000000-0000-0000-0000-000000000020';
    await db.query(`
      INSERT INTO usuario (id, nombre, email, password_hash, rol, doble_perfil, roles, activo)
      VALUES ($1, $2, $3, $4, 'ajustador', FALSE, ARRAY['ajustador'], TRUE)
      ON CONFLICT (email) DO UPDATE 
      SET nombre = EXCLUDED.nombre,
          password_hash = EXCLUDED.password_hash,
          rol = 'ajustador',
          roles = ARRAY['ajustador'],
          activo = TRUE;
    `, [ajustadorId, 'Carlos Mendoza (Ajustador)', 'ajustador@lorens.cl', hashed]);
    console.log('✓ Usuario ajustador creado/actualizado: ajustador@lorens.cl');

    // 3. Crear catálogo de procesos constructivos
    console.log('[3/8] Creando tabla catalogo_proceso_constructivo...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS catalogo_proceso_constructivo (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          codigo VARCHAR(50) UNIQUE NOT NULL,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          unidad_id VARCHAR(20) NOT NULL REFERENCES unidad_medida(id),
          categoria VARCHAR(100) NOT NULL,
          regla_calculo VARCHAR(50) DEFAULT 'direct',
          precio_referencial NUMERIC(14, 2) NOT NULL DEFAULT 1000.00,
          activo BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Poblar catálogo con procesos del Excel EJEMPLO PRESUPUESTO INSPECCION SISMO.xlsx
    console.log('[4/8] Sembrando procesos constructivos estándar del Excel...');
    const catalogProcesses = [
      ['PREP-SUP', 'Preparación de superficie', 'Limpieza, desbaste y acondicionamiento de superficie a intervenir', 'm²', 'Terminaciones', 'cielo_muro', 1000.00],
      ['EMP-ML', 'Provisión y aplicación de empaste', 'Empastado en fisuras y paramentos previa pintura', 'ml', 'Terminaciones', 'fisura_lineal', 1000.00],
      ['REP-FIS', 'Reparación de fisura', 'Apertura en V, puente de adherencia y masillado elástico', 'ml', 'Albañilería', 'fisura_lineal', 1000.00],
      ['PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Esmalte al agua o látex profesional 2 manos', 'm²', 'Pintura', 'cielo_muro', 1000.00],
      ['MART-ML', 'Provisión y aplicación de martelina', 'Texturado y emparejamiento perimetral de grietas', 'ml', 'Terminaciones', 'fisura_lineal', 1000.00],
      ['PAP-RET', 'Retiro de papel mural', 'Decapado y retiro cuidadoso de papel mural afectado', 'm²', 'Terminaciones', 'muro_area', 3200.00],
      ['PAP-COL', 'Provisión y colocación de papel mural', 'Colocación de papel vinílico o texturado similar al existente', 'm²', 'Terminaciones', 'muro_area', 3200.00],
      ['GG-FLETE', 'Flete', 'Transporte y logística de materiales a obra', 'gl', 'Gastos Generales', 'direct', 1810.00],
      ['GG-ESCOMB', 'Retiro de escombros', 'Carguío y retiro de escombros a botadero autorizado', 'gl', 'Gastos Generales', 'direct', 1810.00],
      ['GG-ASEO', 'Aseo y entrega final', 'Aseo fino y entrega de recintos habitables', 'gl', 'Gastos Generales', 'direct', 1810.00],
      ['GG-PROT', 'Protección de área de trabajo', 'Polietileno y encintado de protección de bienes y pisos', 'gl', 'Gastos Generales', 'direct', 1810.00]
    ];

    for (const p of catalogProcesses) {
      await db.query(`
        INSERT INTO catalogo_proceso_constructivo (codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            descripcion = EXCLUDED.descripcion,
            unidad_id = EXCLUDED.unidad_id,
            categoria = EXCLUDED.categoria,
            regla_calculo = EXCLUDED.regla_calculo,
            precio_referencial = EXCLUDED.precio_referencial,
            activo = TRUE;
      `, p);
    }
    console.log(`✓ ${catalogProcesses.length} procesos constructivos sembrados.`);

    // 5. Crear tabla de historial de precios
    console.log('[5/8] Creando tabla historial_precio_proceso...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS historial_precio_proceso (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          proceso_id UUID NOT NULL REFERENCES catalogo_proceso_constructivo(id) ON DELETE CASCADE,
          valor_unitario NUMERIC(14, 2) NOT NULL,
          moneda VARCHAR(10) NOT NULL DEFAULT 'CLP',
          fecha_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
          ajustador_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
          expediente_id UUID REFERENCES expediente(id) ON DELETE CASCADE,
          observacion TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_historial_proceso ON historial_precio_proceso(proceso_id, fecha_vigencia DESC);
    `);
    console.log('✓ Tabla historial_precio_proceso lista.');

    // 6. Ampliar expediente con ajustador_id, ajustador_nombre, estado_presupuesto
    console.log('[6/8] Actualizando columnas en tabla expediente...');
    await db.query(`
      ALTER TABLE expediente 
      ADD COLUMN IF NOT EXISTS ajustador_id UUID REFERENCES usuario(id),
      ADD COLUMN IF NOT EXISTS ajustador_nombre VARCHAR(150),
      ADD COLUMN IF NOT EXISTS estado_presupuesto VARCHAR(40) DEFAULT 'pendiente_cuantificacion';
    `);

    // Asignar Carlos Mendoza a los casos existentes
    await db.query(`
      UPDATE expediente 
      SET ajustador_id = 'a0000000-0000-0000-0000-000000000020',
          ajustador_nombre = 'Carlos Mendoza (Ajustador)',
          estado_presupuesto = COALESCE(estado_presupuesto, 'pendiente_cuantificacion')
      WHERE ajustador_id IS NULL;
    `);
    console.log('✓ Expedientes vinculados a Carlos Mendoza.');

    // 7. Crear tabla de presupuestos
    console.log('[7/8] Creando tabla presupuesto_ajuste...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS presupuesto_ajuste (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
          ajustador_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
          version INT NOT NULL DEFAULT 1,
          estado VARCHAR(40) NOT NULL DEFAULT 'borrador' 
              CHECK (estado IN ('pendiente_cuantificacion', 'en_cuantificacion', 'borrador', 'enviado_revision', 'observado', 'aprobado', 'rechazado')),
          costo_directo NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          porcentaje_gg NUMERIC(5, 2) NOT NULL DEFAULT 25.00,
          monto_gg NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          neto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          porcentaje_iva NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
          monto_iva NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          observaciones_ajustador TEXT,
          observaciones_revision TEXT,
          aprobado_por UUID REFERENCES usuario(id),
          fecha_aprobacion TIMESTAMPTZ,
          fecha_envio_revision TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT uq_expediente_presupuesto_version UNIQUE (expediente_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_presupuesto_expediente ON presupuesto_ajuste(expediente_id);
    `);

    // 8. Crear tabla de partidas presupuestadas
    console.log('[8/8] Creando tabla partida_presupuesto_ajuste...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS partida_presupuesto_ajuste (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          presupuesto_id UUID NOT NULL REFERENCES presupuesto_ajuste(id) ON DELETE CASCADE,
          expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
          sector_id UUID REFERENCES sector_expediente(id) ON DELETE SET NULL,
          sector_nombre VARCHAR(150),
          dano_id UUID REFERENCES partida_dano(id) ON DELETE SET NULL,
          dano_descripcion TEXT,
          proceso_id UUID REFERENCES catalogo_proceso_constructivo(id) ON DELETE SET NULL,
          proceso_codigo VARCHAR(50),
          proceso_nombre VARCHAR(255) NOT NULL,
          categoria VARCHAR(100) NOT NULL DEFAULT 'Terminaciones',
          unidad_id VARCHAR(20) NOT NULL REFERENCES unidad_medida(id),
          cantidad_base NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
          cantidad NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
          justificacion_cantidad TEXT,
          valor_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          es_gasto_general BOOLEAN NOT NULL DEFAULT FALSE,
          orden INT DEFAULT 1,
          usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_partida_ajuste_presupuesto ON partida_presupuesto_ajuste(presupuesto_id);
      CREATE INDEX IF NOT EXISTS idx_partida_ajuste_dano ON partida_presupuesto_ajuste(dano_id);
    `);
    console.log('✓ Tabla partida_presupuesto_ajuste creada.');

    // Crear tabla de asignaciones de ajustador
    await db.query(`
      CREATE TABLE IF NOT EXISTS asignacion_ajustador (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
          ajustador_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
          asignado_por UUID REFERENCES usuario(id),
          fecha_asignacion TIMESTAMPTZ DEFAULT NOW(),
          estado VARCHAR(30) DEFAULT 'activo',
          observaciones TEXT
      );
    `);

    console.log('=====================================================');
    console.log('  ¡MIGRACIÓN DE BASE DE DATOS FINALIZADA CON ÉXITO!');
    console.log('=====================================================');
    process.exit(0);
  } catch (err) {
    console.error('ERROR EN MIGRACIÓN:', err);
    process.exit(1);
  }
}

migrate();
