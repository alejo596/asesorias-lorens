const db = require('../config/database');

async function enforceClientRoleExclusivity() {
  console.log('--- APLICANDO REGLA ESTRICTA: CLIENTE NO PUEDE SER INSPECTOR NI TENER DOS ROLES ---');

  try {
    // 1. Limpiar cualquier usuario cliente para garantizar que doble_perfil sea FALSE y roles sea únicamente ['cliente']
    console.log('1. Normalizando usuarios con rol cliente en la base de datos...');
    await db.query(`
      UPDATE usuario
      SET doble_perfil = FALSE,
          roles = ARRAY['cliente']
      WHERE rol = 'cliente';
    `);
    console.log('✓ Usuarios clientes actualizados con doble_perfil = FALSE y roles = ARRAY[\'cliente\'].');

    // 2. Normalizar usuarios del personal operativo para asegurar que no tengan 'cliente' en roles
    await db.query(`
      UPDATE usuario
      SET roles = array_remove(roles, 'cliente')
      WHERE rol != 'cliente';
    `);
    console.log('✓ Personal operativo asegurado sin rol cliente.');

    // 3. Crear o actualizar restricción CHECK en tabla usuario
    console.log('3. Creando restricción CHECK chk_cliente_rol_exclusivo...');
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'chk_cliente_rol_exclusivo' AND table_name = 'usuario'
        ) THEN
          ALTER TABLE usuario DROP CONSTRAINT chk_cliente_rol_exclusivo;
        END IF;

        ALTER TABLE usuario ADD CONSTRAINT chk_cliente_rol_exclusivo
        CHECK (
          (rol = 'cliente' AND doble_perfil = FALSE AND roles = ARRAY['cliente'])
          OR
          (rol != 'cliente' AND NOT ('cliente' = ANY(roles)))
        );
      END $$;
    `);
    console.log('✓ Restricción CHECK chk_cliente_rol_exclusivo creada exitosamente.');

    console.log('=== REGLA DE EXCLUSIVIDAD DE ROLES APLICADA EN POSTGRESQL ===');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al aplicar regla de exclusividad de roles:', err);
    process.exit(1);
  }
}

enforceClientRoleExclusivity();

