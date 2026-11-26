/**
 * Queries SQL parametrizadas para ASESORÍAS LORENS
 */
module.exports = {
  // Usuarios y RBAC
  FIND_USER_BY_EMAIL: `
    SELECT id, nombre, email, password_hash, rol, doble_perfil, roles, activo
    FROM usuario
    WHERE (LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($1 || '@lorens.cl')) AND activo = TRUE
  `,
  FIND_USER_BY_ID: `
    SELECT id, nombre, email, rol, doble_perfil, roles, activo, created_at
    FROM usuario
    WHERE id = $1
  `,
  LIST_USERS: `
    SELECT id, nombre, email, rol, doble_perfil, roles, activo, created_at
    FROM usuario
    ORDER BY created_at DESC
  `,
  LIST_AUDIT_LOGS: `
    SELECT a.*, u.nombre AS usuario_nombre, u.email AS usuario_email
    FROM auditoria_log a
    LEFT JOIN usuario u ON a.usuario_id = u.id
    ORDER BY a.fecha DESC
    LIMIT 50
  `,

  // Liquidadores y Catálogos
  LIST_LIQUIDADORES: `
    SELECT l.*, c.id AS catalogo_id, c.version AS catalogo_version
    FROM liquidador l
    LEFT JOIN catalogo_liquidador c ON l.id = c.liquidador_id AND c.vigente = TRUE
    WHERE l.activo = TRUE
    ORDER BY l.nombre
  `,
  GET_CATALOGO_PROCESOS: `
    SELECT * FROM proceso_liquidador
    WHERE catalogo_id = $1 AND activo = TRUE
    ORDER BY categoria, nombre
  `,
  GET_CATALOGO_MATERIALES: `
    SELECT * FROM material_liquidador
    WHERE catalogo_id = $1 AND activo = TRUE
    ORDER BY categoria, nombre
  `,

  // Expedientes
  LIST_CASES: `
    SELECT c.*, l.nombre AS liquidador_nombre,
      COALESCE(ee.nombre, 'Activo') AS estado_nombre,
      COALESCE(ee.color, '#10b981') AS estado_color,
      COALESCE(ee.badge_clase, 'green lighten-5 green-text text-darken-3') AS estado_badge,
      (SELECT COUNT(*) FROM partida_dano WHERE expediente_id = c.id) AS total_partidas,
      (SELECT COUNT(*) FROM evidencia_fotografica WHERE expediente_id = c.id) AS total_fotos
    FROM expediente c
    JOIN liquidador l ON c.liquidador_id = l.id
    LEFT JOIN estado_expediente ee ON c.estado = ee.id
    ORDER BY c.created_at DESC
  `,
  LIST_CASES_BY_INSPECTOR: `
    SELECT c.*, l.nombre AS liquidador_nombre,
      COALESCE(ee.nombre, 'Activo') AS estado_nombre,
      COALESCE(ee.color, '#10b981') AS estado_color,
      COALESCE(ee.badge_clase, 'green lighten-5 green-text text-darken-3') AS estado_badge,
      (SELECT COUNT(*) FROM partida_dano WHERE expediente_id = c.id) AS total_partidas,
      (SELECT COUNT(*) FROM evidencia_fotografica WHERE expediente_id = c.id) AS total_fotos
    FROM expediente c
    JOIN liquidador l ON c.liquidador_id = l.id
    LEFT JOIN estado_expediente ee ON c.estado = ee.id
    WHERE c.inspector_id = $1 OR c.inspector_nombre ILIKE $2
    ORDER BY c.created_at DESC
  `,
  GET_CASE_BY_ID: `
    SELECT c.*, l.nombre AS liquidador_nombre, l.rut AS liquidador_rut,
      COALESCE(ee.nombre, 'Activo') AS estado_nombre,
      COALESCE(ee.color, '#10b981') AS estado_color,
      COALESCE(ee.badge_clase, 'green lighten-5 green-text text-darken-3') AS estado_badge
    FROM expediente c
    JOIN liquidador l ON c.liquidador_id = l.id
    LEFT JOIN estado_expediente ee ON c.estado = ee.id
    WHERE c.id = $1
  `,
  CREATE_CASE: `
    INSERT INTO expediente (
      codigo, cliente_nombre, cliente_rut, cliente_telefono, cliente_email,
      direccion, comuna, ciudad, region, liquidador_id, estado, numero_poliza, numero_siniestro,
      tipo_evento, tipo_inmueble, sistema_constructivo, fecha_evento, fecha_visita,
      inspector_id, inspector_nombre, supervisor_nombre, observaciones_generales,
      porcentaje_gg, porcentaje_utilidad, tasa_iva
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    RETURNING *
  `,
  UPDATE_CASE_LIQUIDADOR: `
    UPDATE expediente
    SET liquidador_id = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `,
  UPDATE_CASE_STATUS: `
    UPDATE expediente
    SET estado = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `,
  LIST_EXPEDIENTE_ESTADOS: `
    SELECT * FROM estado_expediente ORDER BY orden ASC
  `,

  // Partidas de Daño
  GET_LINES_BY_CASE: `
    SELECT p.*, u.etiqueta AS unidad_etiqueta, pr.nombre AS proceso_nombre
    FROM partida_dano p
    LEFT JOIN unidad_medida u ON p.unidad_id = u.id
    LEFT JOIN proceso_liquidador pr ON p.proceso_id = pr.id
    WHERE p.expediente_id = $1
    ORDER BY p.sector, p.created_at
  `,
  INSERT_LINE: `
    INSERT INTO partida_dano (
      expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano,
      reparacion_propuesta, proceso_id, es_estructural, referencia_estructural,
      unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento,
      porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion,
      modo_precio, precio_unitario_neto, incluye_iva, subtotal_neto, precio_verificado
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
    ) RETURNING *
  `,
  DELETE_LINE: `
    DELETE FROM partida_dano WHERE id = $1 RETURNING *
  `,
  RESET_CASE_LINE_PRICES: `
    UPDATE partida_dano
    SET precio_unitario_neto = NULL, subtotal_neto = 0, proceso_id = NULL, precio_verificado = FALSE
    WHERE expediente_id = $1
  `,

  // Gastos Adicionales
  GET_EXPENSES_BY_CASE: `
    SELECT * FROM gasto_caso WHERE expediente_id = $1 ORDER BY categoria, descripcion
  `,
  INSERT_EXPENSE: `
    INSERT INTO gasto_caso (expediente_id, categoria, descripcion, unidad, cantidad, precio_unitario_neto, subtotal_neto, verificado)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `,
  DELETE_EXPENSE: `
    DELETE FROM gasto_caso WHERE id = $1 RETURNING *
  `,

  // Fotografías
  GET_PHOTOS_BY_CASE: `
    SELECT id, sector, partida_id, nombre_archivo, ruta_almacenamiento, descripcion, mime_type, created_at
    FROM fotografia WHERE expediente_id = $1 ORDER BY created_at DESC
  `,
  INSERT_PHOTO: `
    INSERT INTO fotografia (expediente_id, partida_id, nombre_archivo, ruta_almacenamiento, sector, descripcion, mime_type, tamano_bytes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `,

  // Snapshots e Informes
  INSERT_SNAPSHOT: `
    INSERT INTO version_informe (
      expediente_id, correlativo, es_valorizado, costo_directo, gastos_generales,
      utilidad, subtotal_neto, iva, total_presupuesto, snapshot_json, supervisor_aprobador
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `,
  GET_SNAPSHOTS_BY_CASE: `
    SELECT id, correlativo, es_valorizado, costo_directo, gastos_generales, utilidad,
           subtotal_neto, iva, total_presupuesto, supervisor_aprobador, emitido_en
    FROM version_informe
    WHERE expediente_id = $1
    ORDER BY emitido_en DESC
  `,
  GET_SNAPSHOT_BY_ID: `
    SELECT * FROM version_informe WHERE id = $1
  `,

  // Auditoría
  LOG_AUDIT: `
    INSERT INTO auditoria_log (expediente_id, usuario_id, accion, detalles)
    VALUES ($1, $2, $3, $4)
  `
};

