const db = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Helper para formatear CLP
function formatCLP(amount) {
  const num = Math.round(Number(amount) || 0);
  return '$' + num.toLocaleString('es-CL');
}

// Helper para calcular resumen financiero según reglas del Excel
function calculateBudgetSummary(items = [], ggPercent = 25.00, ivaPercent = 19.00) {
  let costoDirecto = 0;

  for (const it of items) {
    const qty = Number(it.cantidad) || 0;
    const unitPrice = Number(it.valor_unitario) || 0;
    const sub = Math.round(qty * unitPrice);
    costoDirecto += sub;
  }

  const montoGG = Math.round(costoDirecto * (Number(ggPercent) / 100));
  const neto = costoDirecto + montoGG;
  const montoIva = Math.round(neto * (Number(ivaPercent) / 100));
  const total = neto + montoIva;

  return {
    costo_directo: costoDirecto,
    porcentaje_gg: Number(ggPercent),
    monto_gg: montoGG,
    neto: neto,
    porcentaje_iva: Number(ivaPercent),
    monto_iva: montoIva,
    total: total
  };
}

// 1. GET /api/adjuster/dashboard - Indicadores del Ajustador
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const isGlobalAdmin = req.user && (req.user.rol === 'admin' || req.user.rol === 'supervisor' || req.user.rol === 'webmaster');

    const filterClause = isGlobalAdmin ? '' : 'WHERE c.ajustador_id = $1';
    const params = isGlobalAdmin ? [] : [userId];

    const kpiQuery = `
      SELECT 
        COUNT(c.id) AS asignados,
        COUNT(c.id) FILTER (WHERE COALESCE(c.estado_presupuesto, 'pendiente_cuantificacion') = 'pendiente_cuantificacion') AS pendientes,
        COUNT(c.id) FILTER (WHERE c.estado_presupuesto IN ('en_cuantificacion', 'borrador')) AS en_cuantificacion,
        COUNT(c.id) FILTER (WHERE c.estado_presupuesto IN ('aprobado', 'enviado_revision')) AS terminados,
        COUNT(c.id) FILTER (WHERE c.estado_presupuesto = 'observado') AS observados,
        COALESCE((
          SELECT COUNT(p.id) 
          FROM partida_presupuesto_ajuste p 
          JOIN expediente ce ON p.expediente_id = ce.id
          ${isGlobalAdmin ? '' : 'WHERE ce.ajustador_id = $1'}
        ), 0) AS partidas_valorizadas
      FROM expediente c
      ${filterClause};
    `;

    const result = await db.query(kpiQuery, params);
    const row = result.rows[0] || {};

    const kpis = {
      expedientes_asignados: parseInt(row.asignados || 0, 10),
      pendientes_cuantificacion: parseInt(row.pendientes || 0, 10),
      en_cuantificacion: parseInt(row.en_cuantificacion || 0, 10),
      presupuestos_terminados: parseInt(row.terminados || 0, 10),
      presupuestos_observados: parseInt(row.observados || 0, 10),
      partidas_valorizadas: parseInt(row.partidas_valorizadas || 0, 10)
    };

    return res.json({
      kpis,
      asignados: kpis.expedientes_asignados,
      pendientes: kpis.pendientes_cuantificacion,
      en_cuantificacion: kpis.en_cuantificacion,
      terminados: kpis.presupuestos_terminados,
      observados: kpis.presupuestos_observados,
      partidas_valorizadas: kpis.partidas_valorizadas
    });
  } catch (error) {
    console.error('[adjusterController.getDashboard] Error:', error);
    return res.status(500).json({ error: 'Error al consultar indicadores del ajustador: ' + error.message });
  }
};

// 2. GET /api/adjuster/cases - Listado DataTable de expedientes asignados al ajustador
exports.getCases = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const isGlobalAdmin = req.user && (req.user.rol === 'admin' || req.user.rol === 'supervisor' || req.user.rol === 'webmaster');

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim().toLowerCase();
    const status = (req.query.status || 'all').trim();

    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (!isGlobalAdmin) {
      whereConditions.push(`c.ajustador_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }

    if (status && status !== 'all') {
      whereConditions.push(`c.estado_presupuesto = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        LOWER(c.codigo) LIKE $${paramIndex} OR
        LOWER(c.cliente_nombre) LIKE $${paramIndex} OR
        LOWER(c.direccion) LIKE $${paramIndex} OR
        LOWER(COALESCE(c.numero_siniestro, '')) LIKE $${paramIndex} OR
        LOWER(COALESCE(c.inspector_nombre, '')) LIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) FROM expediente c ${whereClause}`;
    const countRes = await db.query(countSql, queryParams);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataSql = `
      SELECT 
        c.id,
        c.codigo,
        c.codigo AS expediente_codigo,
        c.cliente_nombre,
        c.cliente_rut,
        c.direccion,
        c.comuna,
        c.tipo_evento,
        c.tipo_evento AS tipo_siniestro,
        c.numero_siniestro,
        c.inspector_nombre,
        c.ajustador_nombre,
        c.estado AS estado_levantamiento,
        c.estado AS estado_caso,
        COALESCE(c.estado_presupuesto, 'pendiente_cuantificacion') AS estado_presupuesto,
        (SELECT COUNT(*) FROM sector_expediente WHERE expediente_id = c.id) AS total_sectores,
        (SELECT COUNT(*) FROM partida_dano WHERE expediente_id = c.id) AS total_danos,
        (SELECT COUNT(*) FROM partida_presupuesto_ajuste WHERE expediente_id = c.id) AS total_partidas_presupuesto,
        COALESCE((
          SELECT pa.total 
          FROM presupuesto_ajuste pa 
          WHERE pa.expediente_id = c.id 
          ORDER BY pa.version DESC LIMIT 1
        ), 0) AS total_presupuesto,
        c.created_at
      FROM expediente c
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    queryParams.push(limit, offset);
    const dataRes = await db.query(dataSql, queryParams);

    return res.json({
      data: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('[adjusterController.getCases] Error:', error);
    return res.status(500).json({ error: 'Error al consultar expedientes para ajustador: ' + error.message });
  }
};

// 3. GET /api/adjuster/cases/:id - Ficha de cuantificación con levantamiento de inspector (solo lectura) y presupuesto activo
exports.getCaseDetails = async (req, res) => {
  try {
    const caseId = req.params.id;
    const userId = req.user ? req.user.id : null;
    const isGlobalAdmin = req.user && (req.user.rol === 'admin' || req.user.rol === 'supervisor' || req.user.rol === 'webmaster');

    // Consultar expediente
    const caseRes = await db.query(`
      SELECT c.*, 
             c.codigo AS expediente_codigo, 
             c.tipo_evento AS tipo_siniestro, 
             c.fecha_visita AS fecha_inspeccion,
             l.nombre AS liquidador_nombre
      FROM expediente c
      JOIN liquidador l ON c.liquidador_id = l.id
      WHERE c.id = $1
    `, [caseId]);

    if (caseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    const expediente = caseRes.rows[0];

    // Verificar permiso: asignado al ajustador o administrador
    if (!isGlobalAdmin && expediente.ajustador_id && expediente.ajustador_id !== userId) {
      return res.status(403).json({ error: 'No está autorizado para cuantificar este expediente.' });
    }

    // Consultar sectores registrados por el inspector
    const sectorsRes = await db.query(`
      SELECT * FROM sector_expediente 
      WHERE expediente_id = $1 
      ORDER BY created_at ASC
    `, [caseId]);

    // Consultar daños medidos por el inspector (SOLO LECTURA)
    const damagesRes = await db.query(`
      SELECT pd.*, um.etiqueta AS unidad_etiqueta
      FROM partida_dano pd
      JOIN unidad_medida um ON pd.unidad_id = um.id
      WHERE pd.expediente_id = $1
      ORDER BY pd.created_at ASC
    `, [caseId]);

    // Consultar fotografías del inspector asociadas al caso
    const photosRes = await db.query(`
      SELECT id, sector_id, dano_id, sector, descripcion, nombre_archivo, ruta_almacenamiento, created_at
      FROM fotografia
      WHERE expediente_id = $1
      ORDER BY created_at ASC
    `, [caseId]);

    // Consultar o crear presupuesto de ajuste para este expediente
    let budgetRes = await db.query(`
      SELECT * FROM presupuesto_ajuste 
      WHERE expediente_id = $1 
      ORDER BY version DESC 
      LIMIT 1
    `, [caseId]);

    let presupuesto = null;
    if (budgetRes.rows.length === 0) {
      // Crear presupuesto inicial en borrador
      const insertBudget = await db.query(`
        INSERT INTO presupuesto_ajuste (expediente_id, ajustador_id, version, estado, porcentaje_gg, porcentaje_iva)
        VALUES ($1, $2, 1, 'borrador', 25.00, 19.00)
        RETURNING *;
      `, [caseId, userId || expediente.ajustador_id]);
      presupuesto = insertBudget.rows[0];
    } else {
      presupuesto = budgetRes.rows[0];
    }

    // Consultar partidas presupuestadas del ajustador
    const itemsRes = await db.query(`
      SELECT p.*, um.etiqueta AS unidad_etiqueta
      FROM partida_presupuesto_ajuste p
      JOIN unidad_medida um ON p.unidad_id = um.id
      WHERE p.presupuesto_id = $1
      ORDER BY p.es_gasto_general ASC, p.orden ASC, p.created_at ASC
    `, [presupuesto.id]);

    let items = itemsRes.rows;

    // Si el presupuesto está recién creado y no tiene partidas, inicializar a partir de los daños y los 4 gastos generales
    if (items.length === 0 && damagesRes.rows.length > 0) {
      items = await initializeBudgetItemsFromDamages(caseId, presupuesto.id, damagesRes.rows, userId);
    }

    // Recalcular resumen financiero consistente
    const summary = calculateBudgetSummary(items, presupuesto.porcentaje_gg, presupuesto.porcentaje_iva);

    // Actualizar montos en presupuesto_ajuste
    await db.query(`
      UPDATE presupuesto_ajuste
      SET costo_directo = $1, monto_gg = $2, neto = $3, monto_iva = $4, total = $5, updated_at = NOW()
      WHERE id = $6
    `, [summary.costo_directo, summary.monto_gg, summary.neto, summary.monto_iva, summary.total, presupuesto.id]);

    presupuesto = {
      ...presupuesto,
      ...summary
    };

    return res.json({
      expediente,
      case: expediente,
      sectores: sectorsRes.rows,
      danos: damagesRes.rows,
      inspector_damages: damagesRes.rows.map(d => ({
        ...d,
        sector_nombre: d.sector_nombre || d.sector,
        tipo_dano: d.tipo_dano || d.elemento || d.categoria || 'Daño Estructural',
        largo_l: d.largo,
        ancho_a: d.ancho,
        alto_h: d.alto,
        area_afectada_m2: d.area_m2 || d.cantidad_medida,
        volumen_afectado_m3: d.volumen_m3,
        observacion_terreno: d.descripcion_dano || d.observaciones,
        fotos: photosRes.rows.filter(p => p.dano_id === d.id || p.sector_id === d.sector_id)
      })),
      fotografias: photosRes.rows,
      presupuesto,
      budget: {
        ...presupuesto,
        costo_directo: Number(summary.costo_directo || 0),
        gastos_generales: Number(summary.monto_gg || 0),
        subtotal_neto: Number(summary.neto || 0),
        iva: Number(summary.monto_iva || 0),
        total: Number(summary.total || 0)
      },
      partidas: items,
      items: items.map(p => ({
        ...p,
        proceso_constructivo: p.proceso_nombre,
        dano_asociado: p.dano_descripcion,
        justificacion_tecnica: p.justificacion_cantidad,
        unidad_medida: p.unidad_etiqueta || p.unidad_id,
        precio_unitario: Number(p.valor_unitario || 0),
        subtotal: Number(p.subtotal || 0),
        tipo: p.es_gasto_general ? 'gasto_general' : 'partida'
      }))
    });
  } catch (error) {
    console.error('[adjusterController.getCaseDetails] Error:', error);
    return res.status(500).json({ error: 'Error al obtener detalle del caso para ajustador: ' + error.message });
  }
};

// Helper para inicializar partidas de presupuesto automáticamente a partir del levantamiento del inspector
async function initializeBudgetItemsFromDamages(caseId, presupuestoId, damages, userId) {
  const createdItems = [];

  // Mapeo estándar de procesos por daño según el Excel
  // En el Excel cada daño de Muro o Cielo incluye 5 procesos estándar
  for (const dano of damages) {
    const isCielo = (dano.elemento || '').toLowerCase().includes('cielo');
    const isMuro = (dano.elemento || '').toLowerCase().includes('muro');
    const isCornisa = (dano.elemento || '').toLowerCase().includes('cornisa');

    // Medidas base del inspector
    const largo = Number(dano.largo) || 0;
    const ancho = Number(dano.ancho) || 0;
    const alto = Number(dano.alto) || 0;
    const fisuraLineal = Number(dano.cantidad_directa) || Number(dano.cantidad_medida) || 1.5;

    // Área calculada según geometría
    let areaCalculada = 0;
    if (isCielo || isCornisa) {
      areaCalculada = Number((largo * ancho).toFixed(2));
    } else if (isMuro && alto > 0) {
      // Perímetro o área muro
      areaCalculada = Number((2 * (largo + ancho) * alto).toFixed(2));
    }
    if (areaCalculada <= 0) areaCalculada = Number(dano.cantidad_medida) || 10.0;

    // Procesos a sembrar por daño
    const processes = [
      { codigo: 'PREP-SUP', nombre: 'Preparación de superficie', unidad: 'm²', cant: areaCalculada, precio: 1000 },
      { codigo: 'EMP-ML', nombre: 'Provisión y aplicación de empaste', unidad: 'ml', cant: fisuraLineal, precio: 1000 },
      { codigo: 'REP-FIS', nombre: 'Reparación de fisura', unidad: 'ml', cant: fisuraLineal, precio: 1000 },
      { codigo: 'PINT-2M', nombre: 'Provisión y aplicación de pintura dos manos', unidad: 'm²', cant: areaCalculada, precio: 1000 },
      { codigo: 'MART-ML', nombre: 'Provisión y aplicación de martelina', unidad: 'ml', cant: fisuraLineal, precio: 1000 }
    ];

    let orderIdx = 1;
    for (const p of processes) {
      const subtotal = Math.round(p.cant * p.precio);
      const res = await db.query(`
        INSERT INTO partida_presupuesto_ajuste (
          presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion,
          proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad,
          justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'Terminaciones', $9, $10, $11, 'Calculada a partir de dimensiones periciales', $12, $13, FALSE, $14, $15
        ) RETURNING *, $9 AS unidad_etiqueta;
      `, [
        presupuestoId, caseId, dano.sector_id, dano.sector, dano.id,
        `${dano.elemento} - ${dano.reparacion_propuesta || dano.dano_tipo} (L ${largo} · A ${ancho} m)`,
        p.codigo, p.nombre, p.unidad, p.cant, p.cant, p.precio, subtotal, orderIdx++, userId
      ]);
      createdItems.push(res.rows[0]);
    }
  }

  // 4 partidas de Gastos Generales según el Excel (gl, 1, 1810)
  const ggItems = [
    { codigo: 'GG-FLETE', nombre: 'Flete', unidad: 'gl', precio: 1810 },
    { codigo: 'GG-ESCOMB', nombre: 'Retiro de escombros', unidad: 'gl', precio: 1810 },
    { codigo: 'GG-ASEO', nombre: 'Aseo y entrega final', unidad: 'gl', precio: 1810 },
    { codigo: 'GG-PROT', nombre: 'Protección de área de trabajo', unidad: 'gl', precio: 1810 }
  ];

  let ggOrder = 100;
  for (const gg of ggItems) {
    const res = await db.query(`
      INSERT INTO partida_presupuesto_ajuste (
        presupuesto_id, expediente_id, sector_nombre, dano_descripcion,
        proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad,
        justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id
      ) VALUES (
        $1, $2, 'GASTOS GENERALES', 'Gastos operativos globales del proyecto',
        $3, $4, 'Gastos Generales', $5, 1.0, 1.0, 'Global por faena', $6, $6, TRUE, $7, $8
      ) RETURNING *, $5 AS unidad_etiqueta;
    `, [
      presupuestoId, caseId, gg.codigo, gg.nombre, gg.unidad, gg.precio, ggOrder++, userId
    ]);
    createdItems.push(res.rows[0]);
  }

  return createdItems;
}

// 4. GET /api/adjuster/catalog/processes - Catálogo de procesos constructivos
exports.getCatalogProcesses = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, um.etiqueta AS unidad_etiqueta
      FROM catalogo_proceso_constructivo p
      JOIN unidad_medida um ON p.unidad_id = um.id
      WHERE p.activo = TRUE
      ORDER BY p.categoria ASC, p.nombre ASC;
    `);
    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[adjusterController.getCatalogProcesses] Error:', error);
    return res.status(500).json({ error: 'Error al consultar catálogo de procesos: ' + error.message });
  }
};

// 5. POST /api/adjuster/cases/:id/items - Agregar partida al presupuesto
exports.addBudgetItem = async (req, res) => {
  try {
    const caseId = req.params.id;
    const userId = req.user ? req.user.id : null;
    let {
      presupuesto_id,
      sector_id,
      sector_nombre,
      dano_id,
      dano_descripcion,
      proceso_codigo,
      proceso_nombre,
      proceso_constructivo,
      categoria,
      unidad_id,
      unidad_medida,
      cantidad,
      justificacion_cantidad,
      justificacion_tecnica,
      dano_asociado,
      valor_unitario,
      precio_unitario,
      es_gasto_general,
      tipo
    } = req.body;

    const procName = proceso_nombre || proceso_constructivo;
    let unitId = (unidad_id || unidad_medida || 'm2').toLowerCase().replace('²', '2').trim();
    if (unitId === 'm') unitId = 'ml';

    if (!procName) {
      return res.status(400).json({ error: 'Nombre de proceso y unidad de medida son obligatorios.' });
    }

    const qty = Number(cantidad) || 0;
    const unitPrice = Number(valor_unitario !== undefined ? valor_unitario : precio_unitario) || 0;
    const subtotal = Math.round(qty * unitPrice);
    const isGG = Boolean(es_gasto_general || tipo === 'gasto_general');
    const justif = justificacion_cantidad || justificacion_tecnica || dano_asociado || '';
    const danoDesc = dano_descripcion || dano_asociado || '';

    if (!presupuesto_id) {
      let bRes = await db.query('SELECT id FROM presupuesto_ajuste WHERE expediente_id = $1 ORDER BY version DESC LIMIT 1', [caseId]);
      if (bRes.rows.length === 0) {
        bRes = await db.query(`
          INSERT INTO presupuesto_ajuste (expediente_id, ajustador_id, version, estado, porcentaje_gg, porcentaje_iva)
          VALUES ($1, $2, 1, 'borrador', 25.00, 19.00)
          RETURNING id;
        `, [caseId, userId]);
      }
      presupuesto_id = bRes.rows[0].id;
    }

    const insertSql = `
      INSERT INTO partida_presupuesto_ajuste (
        presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion,
        proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad,
        justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, usuario_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *;
    `;

    const result = await db.query(insertSql, [
      presupuesto_id,
      caseId,
      sector_id || null,
      sector_nombre || (isGG ? 'GASTOS GENERALES' : 'GENERAL'),
      dano_id || null,
      danoDesc,
      proceso_codigo || null,
      procName,
      categoria || (isGG ? 'Gastos Generales' : 'Terminaciones'),
      unitId,
      qty,
      qty,
      justif,
      unitPrice,
      subtotal,
      isGG,
      userId
    ]);

    // Registrar en historial de precios
    if (proceso_codigo) {
      const procRes = await db.query('SELECT id FROM catalogo_proceso_constructivo WHERE codigo = $1', [proceso_codigo]);
      if (procRes.rows.length > 0) {
        await db.query(`
          INSERT INTO historial_precio_proceso (proceso_id, valor_unitario, ajustador_id, expediente_id, observacion)
          VALUES ($1, $2, $3, $4, $5);
        `, [procRes.rows[0].id, unitPrice, userId, caseId, 'Ingreso manual ajustador']);
      }
    }

    // Actualizar estado a en_cuantificacion si estaba pendiente
    await db.query(`
      UPDATE expediente 
      SET estado_presupuesto = 'en_cuantificacion' 
      WHERE id = $1 AND estado_presupuesto = 'pendiente_cuantificacion';
    `, [caseId]);

    const row = result.rows[0];
    return res.status(201).json({
      success: true,
      data: {
        ...row,
        subtotal: Number(row.subtotal),
        proceso_constructivo: row.proceso_nombre,
        unidad_medida: row.unidad_id,
        precio_unitario: Number(row.valor_unitario)
      },
      ...row
    });
  } catch (error) {
    console.error('[adjusterController.addBudgetItem] Error:', error);
    return res.status(500).json({ error: 'Error al agregar partida al presupuesto: ' + error.message });
  }
};

// 6. PUT /api/adjuster/items/:id - Modificar partida (cantidad o valor unitario)
exports.updateBudgetItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.user ? req.user.id : null;
    const { cantidad, valor_unitario, precio_unitario, justificacion_cantidad, proceso_nombre, unidad_id, unidad_medida } = req.body;

    const currentRes = await db.query('SELECT * FROM partida_presupuesto_ajuste WHERE id = $1', [itemId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partida no encontrada.' });
    }
    const current = currentRes.rows[0];

    const qty = cantidad !== undefined ? Number(cantidad) : Number(current.cantidad);
    const unitPrice = valor_unitario !== undefined ? Number(valor_unitario) : (precio_unitario !== undefined ? Number(precio_unitario) : Number(current.valor_unitario));
    const subtotal = Math.round(qty * unitPrice);

    let unit = unidad_id || unidad_medida;
    if (unit) {
      unit = unit.toLowerCase().replace('²', '2').trim();
      if (unit === 'm') unit = 'ml';
    }

    const updateSql = `
      UPDATE partida_presupuesto_ajuste
      SET cantidad = $1,
          valor_unitario = $2,
          subtotal = $3,
          justificacion_cantidad = COALESCE($4, justificacion_cantidad),
          proceso_nombre = COALESCE($5, proceso_nombre),
          unidad_id = COALESCE($6, unidad_id),
          usuario_id = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *;
    `;

    const result = await db.query(updateSql, [
      qty,
      unitPrice,
      subtotal,
      justificacion_cantidad || null,
      proceso_nombre || null,
      unit || null,
      userId,
      itemId
    ]);

    // Registrar en historial si cambió el precio unitario
    if (unitPrice !== Number(current.valor_unitario) && current.proceso_codigo) {
      const procRes = await db.query('SELECT id FROM catalogo_proceso_constructivo WHERE codigo = $1', [current.proceso_codigo]);
      if (procRes.rows.length > 0) {
        await db.query(`
          INSERT INTO historial_precio_proceso (proceso_id, valor_unitario, ajustador_id, expediente_id, observacion)
          VALUES ($1, $2, $3, $4, $5);
        `, [procRes.rows[0].id, unitPrice, userId, current.expediente_id, 'Actualización de precio por ajustador']);
      }
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      data: {
        ...row,
        subtotal: Number(row.subtotal),
        proceso_constructivo: row.proceso_nombre,
        unidad_medida: row.unidad_id,
        precio_unitario: Number(row.valor_unitario)
      },
      ...row
    });
  } catch (error) {
    console.error('[adjusterController.updateBudgetItem] Error:', error);
    return res.status(500).json({ error: 'Error al actualizar partida: ' + error.message });
  }
};

// 7. DELETE /api/adjuster/items/:id - Eliminar partida
exports.deleteBudgetItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    await db.query('DELETE FROM partida_presupuesto_ajuste WHERE id = $1', [itemId]);
    return res.json({ message: 'Partida eliminada correctamente.' });
  } catch (error) {
    console.error('[adjusterController.deleteBudgetItem] Error:', error);
    return res.status(500).json({ error: 'Error al eliminar partida: ' + error.message });
  }
};

// 8. POST /api/adjuster/cases/:id/save-draft - Guardar borrador del presupuesto
exports.saveDraft = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { observaciones_ajustador, porcentaje_gg, porcentaje_iva } = req.body;

    // Obtener partidas actuales
    const itemsRes = await db.query('SELECT * FROM partida_presupuesto_ajuste WHERE expediente_id = $1', [caseId]);
    const items = itemsRes.rows;

    const gg = porcentaje_gg !== undefined ? Number(porcentaje_gg) : 25.00;
    const iva = porcentaje_iva !== undefined ? Number(porcentaje_iva) : 19.00;

    const summary = calculateBudgetSummary(items, gg, iva);

    await db.query(`
      UPDATE presupuesto_ajuste
      SET costo_directo = $1, porcentaje_gg = $2, monto_gg = $3, neto = $4,
          porcentaje_iva = $5, monto_iva = $6, total = $7,
          observaciones_ajustador = COALESCE($8, observaciones_ajustador),
          estado = 'borrador', updated_at = NOW()
      WHERE expediente_id = $9;
    `, [
      summary.costo_directo, summary.porcentaje_gg, summary.monto_gg, summary.neto,
      summary.porcentaje_iva, summary.monto_iva, summary.total,
      observaciones_ajustador || null,
      caseId
    ]);

    await db.query(`
      UPDATE expediente 
      SET estado_presupuesto = 'borrador' 
      WHERE id = $1;
    `, [caseId]);

    return res.json({
      success: true,
      data: {
        estado: 'borrador',
        ...summary
      },
      message: 'Borrador del presupuesto guardado exitosamente.',
      summary
    });
  } catch (error) {
    console.error('[adjusterController.saveDraft] Error:', error);
    return res.status(500).json({ error: 'Error al guardar borrador del presupuesto: ' + error.message });
  }
};

// 9. POST /api/adjuster/cases/:id/submit-review - Enviar a revisión
exports.submitReview = async (req, res) => {
  try {
    const caseId = req.params.id;

    // Verificar que existan partidas valorizadas
    const itemsRes = await db.query('SELECT * FROM partida_presupuesto_ajuste WHERE expediente_id = $1', [caseId]);
    if (itemsRes.rows.length === 0) {
      return res.status(400).json({ error: 'No se puede enviar a revisión un presupuesto sin partidas constructivas.' });
    }

    const items = itemsRes.rows;
    const summary = calculateBudgetSummary(items);

    if (summary.total <= 0) {
      return res.status(400).json({ error: 'Debe ingresar precios unitarios antes de enviar el presupuesto a revisión.' });
    }

    await db.query(`
      UPDATE presupuesto_ajuste
      SET estado = 'enviado_revision', fecha_envio_revision = NOW(), updated_at = NOW()
      WHERE expediente_id = $1;
    `, [caseId]);

    await db.query(`
      UPDATE expediente 
      SET estado_presupuesto = 'enviado_revision' 
      WHERE id = $1;
    `, [caseId]);

    return res.json({
      success: true,
      data: {
        estado: 'enviado_revision',
        ...summary
      },
      message: 'El presupuesto ha sido enviado a revisión técnica con el Administrador.',
      summary
    });
  } catch (error) {
    console.error('[adjusterController.submitReview] Error:', error);
    return res.status(500).json({ error: 'Error al enviar a revisión: ' + error.message });
  }
};

// 10. POST /api/adjuster/cases/:id/approve - Administrador aprueba presupuesto
exports.approveBudget = async (req, res) => {
  try {
    const caseId = req.params.id;
    const userId = req.user ? req.user.id : null;

    if (!req.user || (req.user.rol !== 'admin' && req.user.rol !== 'supervisor' && req.user.rol !== 'webmaster')) {
      return res.status(403).json({ error: 'Solo perfiles Administrador o Supervisor pueden aprobar presupuestos.' });
    }

    await db.query(`
      UPDATE presupuesto_ajuste
      SET estado = 'aprobado', aprobado_por = $1, fecha_aprobacion = NOW(), updated_at = NOW()
      WHERE expediente_id = $2;
    `, [userId, caseId]);

    await db.query(`
      UPDATE expediente 
      SET estado_presupuesto = 'aprobado' 
      WHERE id = $1;
    `, [caseId]);

    return res.json({
      success: true,
      data: { estado: 'aprobado' },
      message: 'Presupuesto aprobado exitosamente por la Administración.'
    });
  } catch (error) {
    console.error('[adjusterController.approveBudget] Error:', error);
    return res.status(500).json({ error: 'Error al aprobar presupuesto: ' + error.message });
  }
};

// 11. POST /api/adjuster/cases/:id/observe - Administrador observa presupuesto
exports.observeBudget = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { observaciones, observacion } = req.body;
    const feedback = observaciones || observacion || 'Observado en revisión técnica.';

    if (!req.user || (req.user.rol !== 'admin' && req.user.rol !== 'supervisor' && req.user.rol !== 'webmaster')) {
      return res.status(403).json({ error: 'Solo perfiles Administrador o Supervisor pueden observar presupuestos.' });
    }

    await db.query(`
      UPDATE presupuesto_ajuste
      SET estado = 'observado', observaciones_revision = $1, updated_at = NOW()
      WHERE expediente_id = $2;
    `, [feedback, caseId]);

    await db.query(`
      UPDATE expediente 
      SET estado_presupuesto = 'observado' 
      WHERE id = $1;
    `, [caseId]);

    return res.json({
      success: true,
      data: { estado: 'observado', observacion: feedback },
      message: 'Presupuesto marcado como Observado. El Ajustador recibirá las indicaciones.'
    });
  } catch (error) {
    console.error('[adjusterController.observeBudget] Error:', error);
    return res.status(500).json({ error: 'Error al registrar observaciones: ' + error.message });
  }
};

// 12. GET /api/adjuster/cases/:id/export/excel - Exportación exacta a Excel (.xlsx) con fórmulas nativas
exports.exportExcel = async (req, res) => {
  try {
    const caseId = req.params.id;

    // Obtener datos del caso y del presupuesto
    const caseRes = await db.query(`
      SELECT c.*, l.nombre AS liquidador_nombre
      FROM expediente c
      JOIN liquidador l ON c.liquidador_id = l.id
      WHERE c.id = $1
    `, [caseId]);

    if (caseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }
    const expediente = caseRes.rows[0];

    const itemsRes = await db.query(`
      SELECT * FROM partida_presupuesto_ajuste
      WHERE expediente_id = $1
      ORDER BY es_gasto_general ASC, orden ASC, created_at ASC;
    `, [caseId]);
    const items = itemsRes.rows;

    // Crear libro de Excel con ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ASESORÍAS LORENS';
    workbook.lastModifiedBy = 'Ajustador de Siniestros Lorens';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Acta Preinspección', {
      views: [{ showGridLines: true }]
    });

    // Configuración de anchos de columna similares al Excel
    sheet.columns = [
      { width: 4 },  // A
      { width: 42 }, // B: PROCESO / DETALLE
      { width: 28 }, // C: Dimensiones
      { width: 10 }, // D: UNIDAD
      { width: 14 }, // E: CANTIDAD
      { width: 18 }, // F: VALOR UNIT. ($)
      { width: 18 }, // G: SUBTOTAL ($)
      { width: 4 }   // H
    ];

    // Estilos institucionales
    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10222F' } };
    const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const sectorFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    const whiteFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const boldFont = { name: 'Calibri', size: 10, bold: true };
    const regularFont = { name: 'Calibri', size: 10 };
    const currencyFormat = '$#,##0';
    const numberFormat = '#,##0.00';

    // Fila 1: Título
    sheet.mergeCells('B1:G1');
    const r1 = sheet.getCell('B1');
    r1.value = 'ACTA DE PREINSPECCIÓN / PRESUPUESTO DE REPARACIÓN';
    r1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    r1.fill = titleFill;
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    // Fila 2: Liquidador
    sheet.getCell('B2').value = `Liquidador: ${expediente.liquidador_nombre || 'SEGURED/COOPER'}`;
    sheet.getCell('B2').font = boldFont;

    // Fila 4 a 8: Metadatos del expediente
    sheet.getCell('B4').value = 'N.° Caso';
    sheet.getCell('C4').value = expediente.codigo;
    sheet.getCell('E4').value = 'RUT';
    sheet.getCell('F4').value = expediente.cliente_rut;

    sheet.getCell('B5').value = 'Cliente';
    sheet.getCell('C5').value = expediente.cliente_nombre;
    sheet.getCell('E5').value = 'Email';
    sheet.getCell('F5').value = expediente.cliente_email || '—';

    sheet.getCell('B6').value = 'Teléfono';
    sheet.getCell('C6').value = expediente.cliente_telefono || '—';
    sheet.getCell('E6').value = 'Inspector';
    sheet.getCell('F6').value = (expediente.inspector_nombre || 'PEDRO PEREZ').toUpperCase();

    sheet.getCell('B7').value = 'Dirección';
    sheet.getCell('C7').value = expediente.direccion;
    sheet.getCell('E7').value = 'Ciudad';
    sheet.getCell('F7').value = expediente.ciudad || expediente.comuna;

    sheet.getCell('B8').value = 'Comuna';
    sheet.getCell('C8').value = expediente.comuna;
    sheet.getCell('E8').value = 'Fecha Siniestro';
    sheet.getCell('F8').value = expediente.fecha_evento ? new Date(expediente.fecha_evento).toLocaleDateString('es-CL') : '—';

    for (let r = 4; r <= 8; r++) {
      sheet.getCell(`B${r}`).font = boldFont;
      sheet.getCell(`C${r}`).font = regularFont;
      sheet.getCell(`E${r}`).font = boldFont;
      sheet.getCell(`F${r}`).font = regularFont;
    }

    // Fila 10: Descripción del siniestro
    sheet.getCell('B10').value = 'DESCRIPCIÓN DEL SINIESTRO';
    sheet.getCell('B10').font = boldFont;
    sheet.getCell('B11').value = 'Tipo de evento:';
    sheet.getCell('B11').font = boldFont;
    sheet.getCell('C11').value = expediente.tipo_evento || 'Sismo';

    sheet.getCell('B12').value = 'Descripción:';
    sheet.getCell('B12').font = boldFont;
    sheet.getCell('C12').value = expediente.observaciones_tecnicas || expediente.observaciones_generales || 'Inspección técnica de daños sísmicos y cálculo de presupuesto de reparación.';

    // Fila 14: Encabezado de tabla
    sheet.getRow(14).values = [null, 'PROCESO / DETALLE', '', 'UNIDAD', 'CANTIDAD', 'VALOR UNIT. ($)', 'SUBTOTAL ($)'];
    sheet.getRow(14).font = whiteFont;
    sheet.getRow(14).fill = titleFill;
    sheet.getRow(14).height = 24;

    let currentRow = 15;
    const damageSubtotalRows = [];

    // Agrupar partidas por sector y por daño
    const sectorGroups = {};
    for (const it of items) {
      const secName = (it.sector_nombre || 'GENERAL').toUpperCase();
      if (!sectorGroups[secName]) sectorGroups[secName] = [];
      sectorGroups[secName].push(it);
    }

    for (const [secName, secItems] of Object.entries(sectorGroups)) {
      // Fila de encabezado de sector
      sheet.getCell(`B${currentRow}`).value = secName;
      sheet.getCell(`B${currentRow}`).font = boldFont;
      sheet.getCell(`B${currentRow}`).fill = sectorFill;
      currentRow++;

      // Agrupar por daño dentro del sector
      const damageGroups = {};
      for (const it of secItems) {
        const dDesc = it.dano_descripcion || (it.es_gasto_general ? 'Gastos Generales' : 'Daño General');
        if (!damageGroups[dDesc]) damageGroups[dDesc] = [];
        damageGroups[dDesc].push(it);
      }

      for (const [dDesc, dItems] of Object.entries(damageGroups)) {
        const startDamageRow = currentRow + 1;

        // Fila del daño
        sheet.getCell(`B${currentRow}`).value = dDesc;
        sheet.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

        currentRow++;

        for (const item of dItems) {
          const row = sheet.getRow(currentRow);
          row.getCell(2).value = `    ${item.proceso_nombre}`;
          row.getCell(2).font = regularFont;
          row.getCell(4).value = item.unidad_id;
          row.getCell(4).alignment = { horizontal: 'center' };
          row.getCell(5).value = Number(item.cantidad);
          row.getCell(5).numFmt = numberFormat;
          row.getCell(6).value = Number(item.valor_unitario);
          row.getCell(6).numFmt = currencyFormat;

          // Fórmula nativa Excel de subtotal: =E{row}*F{row}
          row.getCell(7).value = { formula: `E${currentRow}*F${currentRow}`, result: Math.round(Number(item.cantidad) * Number(item.valor_unitario)) };
          row.getCell(7).numFmt = currencyFormat;
          row.getCell(7).font = boldFont;

          currentRow++;
        }

        const endDamageRow = currentRow - 1;
        // Subtotal del daño con fórmula =SUM(G{start}:G{end})
        sheet.getCell(`G${startDamageRow - 1}`).value = { formula: `SUM(G${startDamageRow}:G${endDamageRow})` };
        sheet.getCell(`G${startDamageRow - 1}`).numFmt = currencyFormat;
        sheet.getCell(`G${startDamageRow - 1}`).font = boldFont;

        damageSubtotalRows.push(startDamageRow - 1);
      }
    }

    // Fila de separación
    currentRow++;

    // RESUMEN FINANCIERO (Líneas 110-116 del Excel)
    const formulaSumDamages = damageSubtotalRows.map(r => `G${r}`).join(',');
    const rowCostoDirecto = currentRow;

    // Total Costo Directo
    sheet.getCell(`B${currentRow}`).value = 'Total Costo Directo';
    sheet.getCell(`B${currentRow}`).font = boldFont;
    sheet.getCell(`G${currentRow}`).value = { formula: `SUM(${formulaSumDamages})` };
    sheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
    sheet.getCell(`G${currentRow}`).font = boldFont;
    currentRow++;

    // Gastos Generales y Utilidades (25%)
    const rowGG = currentRow;
    sheet.getCell(`B${currentRow}`).value = 'Gastos Generales y Utilidades (25%)';
    sheet.getCell(`B${currentRow}`).font = boldFont;
    sheet.getCell(`G${currentRow}`).value = { formula: `G${rowCostoDirecto}*0.25` };
    sheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
    sheet.getCell(`G${currentRow}`).font = boldFont;
    currentRow++;

    // NETO
    const rowNeto = currentRow;
    sheet.getCell(`B${currentRow}`).value = 'NETO';
    sheet.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 11, bold: true };
    sheet.getCell(`G${currentRow}`).value = { formula: `G${rowCostoDirecto}+G${rowGG}` };
    sheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
    sheet.getCell(`G${currentRow}`).font = { name: 'Calibri', size: 11, bold: true };
    sheet.getRow(currentRow).fill = sectionFill;
    currentRow++;

    // IVA (19%)
    const rowIva = currentRow;
    sheet.getCell(`B${currentRow}`).value = 'IVA (19%)';
    sheet.getCell(`B${currentRow}`).font = boldFont;
    sheet.getCell(`G${currentRow}`).value = { formula: `G${rowNeto}*0.19` };
    sheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
    sheet.getCell(`G${currentRow}`).font = boldFont;
    currentRow++;

    // TOTAL
    const rowTotal = currentRow;
    sheet.getCell(`B${currentRow}`).value = 'TOTAL';
    sheet.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell(`G${currentRow}`).value = { formula: `G${rowNeto}+G${rowIva}` };
    sheet.getCell(`G${currentRow}`).numFmt = currencyFormat;
    sheet.getCell(`G${currentRow}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(currentRow).fill = titleFill;
    sheet.getRow(currentRow).height = 24;

    // Encabezados HTTP para descarga
    const filename = `Presupuesto_${expediente.codigo || 'Caso'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[adjusterController.exportExcel] Error:', error);
    return res.status(500).json({ error: 'Error al exportar presupuesto a Excel: ' + error.message });
  }
};

// 13. GET /api/adjuster/cases/:id/export/pdf - Exportación profesional a PDF
exports.exportPdf = async (req, res) => {
  try {
    const caseId = req.params.id;

    const caseRes = await db.query(`
      SELECT c.*, l.nombre AS liquidador_nombre
      FROM expediente c
      JOIN liquidador l ON c.liquidador_id = l.id
      WHERE c.id = $1
    `, [caseId]);

    if (caseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }
    const expediente = caseRes.rows[0];

    const itemsRes = await db.query(`
      SELECT * FROM partida_presupuesto_ajuste
      WHERE expediente_id = $1
      ORDER BY es_gasto_general ASC, orden ASC, created_at ASC;
    `, [caseId]);
    const items = itemsRes.rows;

    const summary = calculateBudgetSummary(items);

    // Crear PDF con PDFKit
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    const filename = `Presupuesto_${expediente.codigo || 'Caso'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Encabezado
    doc.rect(40, 40, 532, 32).fill('#10222F');
    doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
       .text('ACTA DE PREINSPECCIÓN / PRESUPUESTO DE REPARACIÓN', 45, 50, { width: 522, align: 'center' });

    doc.fillColor('#334155').fontSize(9).font('Helvetica')
       .text(`Liquidador: ${expediente.liquidador_nombre || 'SEGURED/COOPER'}`, 40, 80);

    // Metadatos
    let metaY = 96;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A');
    doc.text(`N.° Caso: `, 40, metaY, { continued: true }).font('Helvetica').text(expediente.codigo);
    doc.font('Helvetica-Bold').text(`Cliente: `, 40, metaY + 12, { continued: true }).font('Helvetica').text(expediente.cliente_nombre);
    doc.font('Helvetica-Bold').text(`Dirección: `, 40, metaY + 24, { continued: true }).font('Helvetica').text(`${expediente.direccion}, ${expediente.comuna}`);

    doc.font('Helvetica-Bold').text(`Inspector: `, 320, metaY, { continued: true }).font('Helvetica').text(expediente.inspector_nombre || 'PEDRO PEREZ');
    doc.font('Helvetica-Bold').text(`RUT: `, 320, metaY + 12, { continued: true }).font('Helvetica').text(expediente.cliente_rut);
    doc.font('Helvetica-Bold').text(`Fecha Siniestro: `, 320, metaY + 24, { continued: true }).font('Helvetica').text(expediente.fecha_evento ? new Date(expediente.fecha_evento).toLocaleDateString('es-CL') : '—');

    // Tabla de partidas
    let tableY = 145;
    doc.rect(40, tableY, 532, 18).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    doc.text('PROCESO / DETALLE', 45, tableY + 5, { width: 260 });
    doc.text('UNIDAD', 310, tableY + 5, { width: 45, align: 'center' });
    doc.text('CANTIDAD', 360, tableY + 5, { width: 55, align: 'right' });
    doc.text('V. UNIT. ($)', 420, tableY + 5, { width: 65, align: 'right' });
    doc.text('SUBTOTAL ($)', 490, tableY + 5, { width: 75, align: 'right' });

    let itemY = tableY + 22;
    let currentSector = '';

    for (const it of items) {
      if (itemY > 700) {
        doc.addPage();
        itemY = 50;
      }

      if (it.sector_nombre !== currentSector) {
        currentSector = it.sector_nombre;
        doc.rect(40, itemY, 532, 14).fill('#F1F5F9');
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8)
           .text(currentSector.toUpperCase(), 45, itemY + 3);
        itemY += 16;
      }

      doc.fillColor('#334155').font('Helvetica').fontSize(8);
      doc.text(it.proceso_nombre, 50, itemY, { width: 255 });
      doc.text(it.unidad_id, 310, itemY, { width: 45, align: 'center' });
      doc.text(Number(it.cantidad).toFixed(2), 360, itemY, { width: 55, align: 'right' });
      doc.text(formatCLP(it.valor_unitario), 420, itemY, { width: 65, align: 'right' });
      doc.font('Helvetica-Bold').text(formatCLP(it.subtotal), 490, itemY, { width: 75, align: 'right' });

      itemY += 13;
    }

    // Resumen financiero al final
    itemY += 15;
    if (itemY > 660) {
      doc.addPage();
      itemY = 50;
    }

    doc.rect(340, itemY, 232, 90).fill('#F8FAFC');
    doc.rect(340, itemY, 232, 90).stroke('#CBD5E1');

    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8);
    doc.text('Total Costo Directo:', 350, itemY + 8);
    doc.text(formatCLP(summary.costo_directo), 480, itemY + 8, { width: 85, align: 'right' });

    doc.text('GG y Utilidades (25%):', 350, itemY + 22);
    doc.text(formatCLP(summary.monto_gg), 480, itemY + 22, { width: 85, align: 'right' });

    doc.text('NETO:', 350, itemY + 38);
    doc.text(formatCLP(summary.neto), 480, itemY + 38, { width: 85, align: 'right' });

    doc.text('IVA (19%):', 350, itemY + 52);
    doc.text(formatCLP(summary.monto_iva), 480, itemY + 52, { width: 85, align: 'right' });

    doc.rect(340, itemY + 68, 232, 22).fill('#10222F');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL:', 350, itemY + 74);
    doc.text(formatCLP(summary.total), 480, itemY + 74, { width: 85, align: 'right' });

    doc.end();
  } catch (error) {
    console.error('[adjusterController.exportPdf] Error:', error);
    return res.status(500).json({ error: 'Error al exportar presupuesto a PDF: ' + error.message });
  }
};
