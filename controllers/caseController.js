const db = require('../config/database');
const queries = require('../models/dbQueries');

// Motor de cálculo de geometría y totales financieros (Páginas 17-18 de la especificación)
function computeLineMeasurement(line) {
  let gross = 0;
  const l = parseFloat(line.largo) || 0;
  const w = parseFloat(line.ancho) || 0;
  const h = parseFloat(line.alto) || 0;
  const direct = parseFloat(line.cantidad_directa) || 0;
  const deduction = parseFloat(line.descuento) || 0;
  const affected = parseFloat(line.porcentaje_afectado) !== undefined && !isNaN(parseFloat(line.porcentaje_afectado))
    ? parseFloat(line.porcentaje_afectado)
    : 100.0;

  switch (line.metodo_calculo) {
    case 'LH':
      gross = l * h;
      break;
    case 'LW':
      gross = l * w;
      break;
    case 'perimeter':
      gross = 2 * (l + w) * h;
      break;
    case 'LWH':
      gross = l * w * h;
      break;
    case 'L':
      gross = l;
      break;
    case 'direct':
      gross = direct;
      break;
    default:
      gross = direct;
  }

  const measured = Math.max(0, (gross - deduction) * (affected / 100.0));
  const hasCustomReparacion = line.cantidad_reparacion !== null && line.cantidad_reparacion !== undefined && line.cantidad_reparacion !== '';
  const finalQty = hasCustomReparacion ? parseFloat(line.cantidad_reparacion) : measured;

  // Regla Crítica: Precios Vacíos = null (Pendiente), no se fuerzan a $0
  const pu = (line.precio_unitario_neto !== null && line.precio_unitario_neto !== undefined && line.precio_unitario_neto !== '')
    ? parseFloat(line.precio_unitario_neto)
    : null;

  const subtotal = pu !== null ? Math.round(finalQty * pu) : 0;

  return {
    gross: Number(gross.toFixed(3)),
    measured: Number(measured.toFixed(3)),
    finalQty: Number(finalQty.toFixed(3)),
    subtotal,
    pu
  };
}

// Calcular resumen presupuestario en cascada (para módulos autorizados de Admin y Resumen)
function calculateBudgetSummary(expediente, lines = [], expenses = []) {
  let directLinesCost = 0;
  const processedLines = lines.map(line => {
    const calc = computeLineMeasurement(line);
    directLinesCost += calc.subtotal;
    return { ...line, ...calc };
  });

  let expensesCost = 0;
  const processedExpenses = expenses.map(exp => {
    const qty = parseFloat(exp.cantidad) || 0;
    const pu = parseFloat(exp.precio_unitario_neto) || 0;
    const subtotal = Math.round(qty * pu);
    expensesCost += subtotal;
    return { ...exp, subtotal };
  });

  const totalDirect = directLinesCost + expensesCost;
  const pctGG = parseFloat(expediente.porcentaje_gg) || 0;
  const pctUtilidad = parseFloat(expediente.porcentaje_utilidad) || 0;
  const pctIva = parseFloat(expediente.tasa_iva) || 19.0;

  const gg = Math.round(totalDirect * (pctGG / 100.0));
  const profit = Math.round((totalDirect + gg) * (pctUtilidad / 100.0));
  const netSubtotal = totalDirect + gg + profit;
  const tax = Math.round(netSubtotal * (pctIva / 100.0));
  const grandTotal = netSubtotal + tax;

  return {
    processedLines,
    processedExpenses,
    summary: {
      totalDirect,
      directCost: directLinesCost,
      expensesCost,
      porcentaje_gg: pctGG,
      gg,
      porcentaje_utilidad: pctUtilidad,
      profit,
      netSubtotal,
      tasa_iva: pctIva,
      tax,
      grandTotal,
    }
  };
}

// Criterio verificable de cálculo de avance porcentual de un expediente
function calculateCaseProgress(row) {
  if (row.estado === 'procesado') return 100;
  let progress = 10; // Asignación inicial
  const totalSectores = parseInt(row.total_sectores || 0, 10);
  const totalPartidas = parseInt(row.total_partidas || 0, 10);
  const totalFotos = parseInt(row.total_fotos || 0, 10);

  if (totalSectores > 0) progress += 20; // Al menos un sector registrado
  if (totalPartidas > 0) progress += 40; // Al menos un daño cubicado
  if (totalFotos > 0) progress += 20;    // Al menos una evidencia capturada

  const dbProgress = parseInt(row.avance_porcentaje || 0, 10);
  return Math.min(95, Math.max(progress, dbProgress));
}

// GET /api/cases/:id - Detalle completo de expediente desde PostgreSQL
exports.getCaseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const isInspector = req.user && req.user.rol === 'inspector';
    const userId = req.user ? req.user.id : null;
    const userName = req.user ? req.user.nombre : '';

    // Consultar expediente
    const caseRes = await db.query(queries.GET_CASE_BY_ID, [id]);
    if (caseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado en la base de datos.' });
    }

    const expediente = caseRes.rows[0];

    // Restricción RBAC de servidor: el inspector solo puede ver sus casos asignados
    if (isInspector) {
      const matchId = userId && expediente.inspector_id === userId;
      const matchName = userName && expediente.inspector_nombre && 
                        expediente.inspector_nombre.toLowerCase().includes(userName.toLowerCase());
      if (!matchId && !matchName) {
        return res.status(403).json({ error: 'Acceso denegado: Este expediente no está asignado a su cargo.' });
      }
    }

    // Consultas concurrentes a PostgreSQL para sub-recursos
    const [linesRes, expensesRes, photosRes, sectorsRes] = await Promise.all([
      db.query(queries.GET_LINES_BY_CASE, [id]),
      db.query(queries.GET_EXPENSES_BY_CASE, [id]),
      db.query(`
        SELECT f.*, 
               s.nombre AS sector_nombre,
               p.descripcion_dano AS dano_descripcion,
               u.nombre AS inspector_nombre
        FROM fotografia f
        LEFT JOIN sector_expediente s ON f.sector_id = s.id
        LEFT JOIN partida_dano p ON f.dano_id = p.id
        LEFT JOIN usuario u ON f.usuario_id = u.id
        WHERE f.expediente_id = $1
        ORDER BY f.created_at DESC
      `, [id]),
      db.query(`
        SELECT s.*,
               (SELECT COUNT(*) FROM partida_dano p WHERE p.sector_id = s.id OR (p.expediente_id = s.expediente_id AND UPPER(p.sector) = UPPER(s.nombre))) AS total_danos,
               (SELECT COUNT(*) FROM fotografia f WHERE f.sector_id = s.id OR (f.expediente_id = s.expediente_id AND UPPER(f.sector) = UPPER(s.nombre))) AS total_fotos
        FROM sector_expediente s
        WHERE s.expediente_id = $1
        ORDER BY s.created_at ASC
      `, [id])
    ]);

    const { processedLines, processedExpenses, summary } = calculateBudgetSummary(
      expediente,
      linesRes.rows,
      expensesRes.rows
    );

    // Mapear fotografías con URLs relativas de descarga protegida
    const photosWithUrls = photosRes.rows.map(p => ({
      ...p,
      url: `/api/cases/${id}/photos/${p.id}/file`,
      thumbnail_url: `/api/cases/${id}/photos/${p.id}/file`
    }));

    // Calcular avance dinámico
    const avanceCalculado = calculateCaseProgress({
      ...expediente,
      total_sectores: sectorsRes.rows.length,
      total_partidas: linesRes.rows.length,
      total_fotos: photosRes.rows.length
    });

    return res.json({
      expediente: {
        ...expediente,
        avance_porcentaje: avanceCalculado
      },
      sectors: sectorsRes.rows,
      lines: processedLines,
      expenses: processedExpenses,
      photos: photosWithUrls,
      summary
    });
  } catch (error) {
    console.error('Error al obtener expediente en PostgreSQL:', error);
    res.status(500).json({ error: 'Error al consultar el expediente: ' + error.message, stack: error.stack });
  }
};

// GET /api/cases - Listado general de expedientes (Administrador / Webmaster)
exports.getAllCases = async (req, res) => {
  try {
    const isInspector = req.user && req.user.rol === 'inspector';
    if (isInspector) {
      return exports.getAssignedCases(req, res);
    }

    const query = `
      SELECT c.*, l.nombre AS liquidador_nombre,
        COALESCE(ee.nombre, 'Activo') AS estado_nombre,
        COALESCE(ee.color, '#10b981') AS estado_color,
        COALESCE(ee.badge_clase, 'green lighten-5 green-text text-darken-3') AS estado_badge,
        (SELECT COUNT(*) FROM partida_dano WHERE expediente_id = c.id) AS total_partidas,
        (SELECT COUNT(*) FROM fotografia WHERE expediente_id = c.id) AS total_fotos,
        (SELECT COUNT(*) FROM sector_expediente WHERE expediente_id = c.id) AS total_sectores
      FROM expediente c
      JOIN liquidador l ON c.liquidador_id = l.id
      LEFT JOIN estado_expediente ee ON c.estado = ee.id
      ORDER BY c.created_at DESC
    `;

    const result = await db.query(query);
    const enriched = result.rows.map(row => ({
      ...row,
      avance_porcentaje: calculateCaseProgress(row)
    }));

    return res.json(enriched);
  } catch (error) {
    console.error('Error al listar expedientes:', error);
    res.status(500).json({ error: 'Error al obtener expedientes: ' + error.message });
  }
};

// GET /api/cases/assigned - DataTable con paginación, búsqueda reactiva y filtros desde PostgreSQL
exports.getAssignedCases = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userName = req.user ? req.user.nombre : '';
    const isInspector = req.user ? req.user.rol === 'inspector' : false;

    // Parámetros de paginación, búsqueda, filtros de fecha y ordenamiento
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim().toLowerCase();
    const status = (req.query.status || 'all').trim().toLowerCase();
    const dateFrom = (req.query.dateFrom || '').trim();
    const dateTo = (req.query.dateTo || '').trim();
    const sortBy = (req.query.sortBy || 'created_at').trim();
    const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Construcción de condiciones WHERE parametrizadas
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    // Filtro por inspector si el rol es inspector
    if (isInspector) {
      whereConditions.push(`(c.inspector_id = $${paramIndex} OR c.inspector_nombre ILIKE $${paramIndex + 1})`);
      queryParams.push(userId, `%${userName}%`);
      paramIndex += 2;
    }

    // Filtro por estado
    if (status && status !== 'all') {
      whereConditions.push(`c.estado = $${paramIndex}`);
      queryParams.push(status);
      paramIndex += 1;
    }

    // Filtro por rango de fechas (fecha_visita o created_at)
    if (dateFrom) {
      whereConditions.push(`c.fecha_visita >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex += 1;
    }
    if (dateTo) {
      whereConditions.push(`c.fecha_visita <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex += 1;
    }

    // Filtro reactivo de búsqueda en texto
    if (search) {
      whereConditions.push(`(
        LOWER(c.codigo) LIKE $${paramIndex} OR
        LOWER(c.cliente_nombre) LIKE $${paramIndex} OR
        LOWER(c.direccion) LIKE $${paramIndex} OR
        LOWER(c.comuna) LIKE $${paramIndex} OR
        LOWER(COALESCE(c.numero_siniestro, '')) LIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex += 1;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Consulta de conteo total para paginación
    const countSql = `SELECT COUNT(*) FROM expediente c ${whereClause}`;
    const countRes = await db.query(countSql, queryParams);
    const total = parseInt(countRes.rows[0].count, 10);

    // Mapeo seguro de columnas ordenables para prevenir SQL Injection
    const allowedSortColumns = {
      codigo: 'c.codigo',
      numero_siniestro: 'c.numero_siniestro',
      cliente_nombre: 'c.cliente_nombre',
      direccion: 'c.direccion',
      tipo_evento: 'c.tipo_evento',
      fecha_visita: 'c.fecha_visita',
      estado: 'c.estado',
      created_at: 'c.created_at'
    };
    const orderColumn = allowedSortColumns[sortBy] || 'c.created_at';

    // Consulta de datos con paginación
    const dataSql = `
      SELECT c.*, l.nombre AS liquidador_nombre,
        COALESCE(ee.nombre, 'Activo') AS estado_nombre,
        COALESCE(ee.color, '#10b981') AS estado_color,
        COALESCE(ee.badge_clase, 'green lighten-5 green-text text-darken-3') AS estado_badge,
        (SELECT COUNT(*) FROM partida_dano WHERE expediente_id = c.id) AS total_partidas,
        (SELECT COUNT(*) FROM fotografia WHERE expediente_id = c.id) AS total_fotos,
        (SELECT COUNT(*) FROM sector_expediente WHERE expediente_id = c.id) AS total_sectores
      FROM expediente c
      JOIN liquidador l ON c.liquidador_id = l.id
      LEFT JOIN estado_expediente ee ON c.estado = ee.id
      ${whereClause}
      ORDER BY ${orderColumn} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const dataRes = await db.query(dataSql, queryParams);

    const enriched = dataRes.rows.map(row => ({
      ...row,
      avance_porcentaje: calculateCaseProgress(row)
    }));

    return res.json({
      data: enriched,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Error al listar expedientes asignados:', error);
    res.status(500).json({ error: 'Error al consultar expedientes asignados en PostgreSQL: ' + error.message });
  }
};

// GET /api/cases/assigned/kpis - 6 Indicadores operacionales reales desde PostgreSQL
exports.getInspectorKpis = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userName = req.user ? req.user.nombre : '';

    const query = `
      SELECT
        COUNT(*) AS total_asignados,
        COUNT(*) FILTER (WHERE c.estado = 'en_espera') AS pendientes,
        COUNT(*) FILTER (WHERE c.estado = 'activo') AS en_proceso,
        COUNT(*) FILTER (WHERE c.estado = 'procesado') AS completados,
        COALESCE(SUM((SELECT COUNT(*) FROM partida_dano WHERE expediente_id = c.id)), 0) AS total_danos,
        COALESCE(SUM((SELECT COUNT(*) FROM fotografia WHERE expediente_id = c.id)), 0) AS total_fotos
      FROM expediente c
      WHERE c.inspector_id = $1 OR c.inspector_nombre ILIKE $2
    `;

    const result = await db.query(query, [userId, `%${userName}%`]);
    const row = result.rows[0] || {};

    return res.json({
      asignados: parseInt(row.total_asignados || 0, 10),
      pendientes: parseInt(row.pendientes || 0, 10),
      en_proceso: parseInt(row.en_proceso || 0, 10),
      completados: parseInt(row.completados || 0, 10),
      danos: parseInt(row.total_danos || 0, 10),
      fotos: parseInt(row.total_fotos || 0, 10)
    });
  } catch (error) {
    console.error('Error al calcular KPIs del inspector:', error);
    res.status(500).json({ error: 'Error al obtener indicadores operativos desde PostgreSQL.' });
  }
};

// PUT /api/cases/:id/observations - Guardar observaciones técnicas de terreno
exports.updateObservations = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones_generales, observaciones_tecnicas, observaciones_seguridad, conclusion } = req.body;

    const query = `
      UPDATE expediente
      SET observaciones_generales = COALESCE($2, observaciones_generales),
          observaciones_tecnicas = COALESCE($3, observaciones_tecnicas),
          observaciones_seguridad = COALESCE($4, observaciones_seguridad),
          conclusion = COALESCE($5, conclusion),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [
      id,
      observaciones_generales,
      observaciones_tecnicas,
      observaciones_seguridad,
      conclusion
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    return res.json({ message: 'Observaciones técnicas guardadas correctamente.', expediente: result.rows[0] });
  } catch (error) {
    console.error('Error al guardar observaciones:', error);
    res.status(500).json({ error: 'No fue posible guardar las observaciones en PostgreSQL.' });
  }
};

// PUT /api/cases/:id/finalize - Completar la inspección técnica en terreno
exports.finalizeInspection = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE expediente
      SET estado = 'procesado',
          avance_porcentaje = 100,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    return res.json({ 
      message: 'Inspección técnica completada exitosamente y enviada a liquidación.', 
      expediente: result.rows[0] 
    });
  } catch (error) {
    console.error('Error al finalizar inspección:', error);
    res.status(500).json({ error: 'Error al actualizar estado del expediente en PostgreSQL.' });
  }
};

// POST /api/cases - Crear expediente
exports.createCase = async (req, res) => {
  try {
    const data = req.body;
    const result = await db.query(queries.CREATE_CASE, [
      data.codigo, data.cliente_nombre, data.cliente_rut, data.cliente_telefono || null,
      data.cliente_email || null, data.direccion, data.comuna, data.ciudad || null,
      data.region || null, data.liquidador_id, data.numero_poliza || null, data.numero_siniestro || null,
      data.tipo_evento || 'Sismo', data.tipo_inmueble || 'Casa', data.sistema_constructivo || 'Albañilería confinada',
      data.fecha_evento || null, data.fecha_visita || new Date(), data.inspector_id || null,
      data.inspector_nombre || 'Inspector', data.supervisor_nombre || null,
      data.observaciones_generales || '', data.porcentaje_gg || 0, data.porcentaje_utilidad || 0,
      data.tasa_iva || 19.0
    ]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear expediente:', error);
    res.status(500).json({ error: 'Error al registrar expediente en la base de datos: ' + error.message });
  }
};

// PUT /api/cases/:id/liquidador
exports.updateLiquidador = async (req, res) => {
  try {
    const { id } = req.params;
    const { liquidador_id } = req.body;

    const result = await db.query(queries.UPDATE_CASE_LIQUIDADOR, [id, liquidador_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    // Al cambiar de liquidador se invalidan los precios de partidas
    await db.query(queries.RESET_CASE_LINE_PRICES, [id]);
    return res.json({ message: 'Liquidador actualizado y tarifas reiniciadas.', expediente: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar liquidador:', error);
    res.status(500).json({ error: 'Error al actualizar liquidador en la base de datos.' });
  }
};

// PUT /api/cases/:id/estado
exports.updateEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const result = await db.query(queries.UPDATE_CASE_STATUS, [id, estado]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    return res.json({ message: 'Estado actualizado correctamente.', expediente: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado en la base de datos.' });
  }
};

// GET /api/cases/meta/estados
exports.getEstadosExpediente = async (req, res) => {
  try {
    const result = await db.query(queries.LIST_EXPEDIENTE_ESTADOS);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error al listar estados:', error);
    res.status(500).json({ error: 'Error al obtener estados de expedientes.' });
  }
};

exports.computeLineMeasurement = computeLineMeasurement;
exports.calculateBudgetSummary = calculateBudgetSummary;
exports.calculateCaseProgress = calculateCaseProgress;
