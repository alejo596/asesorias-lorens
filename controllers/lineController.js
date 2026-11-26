const db = require('../config/database');
const queries = require('../models/dbQueries');
const { computeLineMeasurement } = require('./caseController');

// Fórmulas geométricas admitidas por la especificación (páginas 17-18 del manual).
const ALLOWED_METHODS = ['LH', 'LW', 'perimeter', 'LWH', 'L', 'direct'];
const MAX_TEXT_LENGTH = 500;
const MAX_FIELD_LENGTH = 120;

function toText(value, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Validaciones obligatorias de la especificación antes de persistir una partida:
 *  - El descuento de vanos no puede superar la medida bruta.
 *  - El porcentaje afectado debe ser mayor que 0 y hasta 100.
 *  - Una cantidad de reparación distinta de la medida requiere justificación escrita.
 *  - Un precio vacío es "pendiente" (NULL), nunca cero.
 */
function validateLinePayload(body = {}) {
  const errors = [];
  const calc = computeLineMeasurement(body);

  if (!toText(body.sector)) errors.push('El sector/recinto es obligatorio.');
  if (!toText(body.elemento)) errors.push('El elemento afectado es obligatorio.');
  if (!toText(body.dano_tipo)) errors.push('El tipo de daño es obligatorio.');
  if (!toText(body.reparacion_propuesta)) errors.push('La reparación propuesta es obligatoria.');

  const metodo = toText(body.metodo_calculo) || 'direct';
  if (!ALLOWED_METHODS.includes(metodo)) {
    errors.push(`Fórmula geométrica no admitida: ${metodo}.`);
  }

  const porcentaje = toNumberOrNull(body.porcentaje_afectado);
  const porcentajeFinal = porcentaje === null ? 100 : porcentaje;
  if (Number.isNaN(porcentajeFinal) || porcentajeFinal <= 0 || porcentajeFinal > 100) {
    errors.push('El porcentaje afectado debe ser mayor que 0 y hasta 100.');
  }

  const descuento = toNumberOrNull(body.descuento);
  const descuentoFinal = descuento === null ? 0 : descuento;
  if (Number.isNaN(descuentoFinal) || descuentoFinal < 0) {
    errors.push('La deducción o descuento de vanos debe ser un número positivo.');
  } else if (descuentoFinal > calc.gross) {
    errors.push(
      `La deducción (${descuentoFinal}) no puede superar la medida bruta (${calc.gross}).`
    );
  }

  const cantidadReparacion = toNumberOrNull(body.cantidad_reparacion);
  if (cantidadReparacion !== null) {
    if (Number.isNaN(cantidadReparacion) || cantidadReparacion < 0) {
      errors.push('La cantidad de reparación justificada debe ser un número mayor o igual a 0.');
    }
    if (!toText(body.justificacion_reparacion, MAX_TEXT_LENGTH)) {
      errors.push(
        'Debe justificar técnicamente la cantidad de reparación cuando difiere de la medida afectada.'
      );
    }
  }

  const precioUnitario = toNumberOrNull(body.precio_unitario_neto);
  if (precioUnitario !== null && (Number.isNaN(precioUnitario) || precioUnitario < 0)) {
    errors.push('El precio unitario debe ser un número mayor o igual a 0, o quedar pendiente.');
  }

  ['largo', 'ancho', 'alto', 'cantidad_directa'].forEach((campo) => {
    const valor = toNumberOrNull(body[campo]);
    if (valor !== null && (Number.isNaN(valor) || valor < 0)) {
      errors.push(`El campo "${campo}" debe ser un número mayor o igual a 0.`);
    }
  });

  return { ok: errors.length === 0, errors, calc };
}

// Verificar acceso del usuario al caso
async function checkCaseAccess(userId, userRole, caseId) {
  if (userRole === 'admin' || userRole === 'supervisor') return true;
  const res = await db.query(
    'SELECT id FROM expediente WHERE id = $1 AND (inspector_id = $2 OR inspector_nombre ILIKE $3)',
    [caseId, userId, `%${userId}%`]
  );
  return res.rows.length > 0;
}

// POST /api/cases/:caseId/lines - Agregar nueva partida con cálculo geométrico
exports.createLine = async (req, res) => {
  try {
    const { caseId } = req.params;
    const body = req.body;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';

    const hasAccess = await checkCaseAccess(userId, userRole, caseId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No está autorizado para agregar partidas a este expediente.' });
    }

    const validation = validateLinePayload(body);
    if (!validation.ok) {
      return res.status(400).json({
        error: validation.errors[0],
        details: validation.errors,
      });
    }

    const calc = validation.calc;
    const sectorNombre = toText(body.sector);

    // Buscar o enlazar sector_id
    let sectorId = body.sector_id || null;
    if (!sectorId && sectorNombre) {
      const secRes = await db.query(
        'SELECT id FROM sector_expediente WHERE expediente_id = $1 AND UPPER(nombre) = UPPER($2)',
        [caseId, sectorNombre]
      );
      if (secRes.rows.length > 0) {
        sectorId = secRes.rows[0].id;
      } else {
        // Auto-crear el sector en la BD si el inspector escribió uno nuevo
        try {
          const newSec = await db.query(
            'INSERT INTO sector_expediente (expediente_id, nombre, usuario_id) VALUES ($1, $2, $3) RETURNING id',
            [caseId, sectorNombre.toUpperCase(), userId]
          );
          sectorId = newSec.rows[0].id;
        } catch (e) {
          // Si colisionó en concurrencia
        }
      }
    }

    const lineData = {
      expediente_id: caseId,
      sector_id: sectorId,
      sector: sectorNombre,
      elemento: toText(body.elemento),
      dano_tipo: toText(body.dano_tipo),
      materialidad: toText(body.materialidad || body.material_existente),
      material_existente: toText(body.material_existente || body.materialidad, MAX_TEXT_LENGTH),
      descripcion_dano: toText(body.descripcion_dano, MAX_TEXT_LENGTH),
      reparacion_propuesta: toText(body.reparacion_propuesta),
      proceso_id: body.proceso_id || null,
      es_estructural: Boolean(body.es_estructural),
      referencia_estructural: toText(body.referencia_estructural, MAX_TEXT_LENGTH),
      unidad_id: toText(body.unidad_id) || 'm²',
      metodo_calculo: toText(body.metodo_calculo) || 'direct',
      largo: parseFloat(body.largo) || 0,
      ancho: parseFloat(body.ancho) || 0,
      alto: parseFloat(body.alto) || 0,
      cantidad_directa: parseFloat(body.cantidad_directa) || 0,
      descuento: parseFloat(body.descuento) || 0,
      porcentaje_afectado: parseFloat(body.porcentaje_afectado) || 100,
      cantidad_afectada: parseFloat(body.cantidad_afectada) || calc.measured,
      porcentaje_intervencion: parseFloat(body.porcentaje_intervencion) || 100,
      cantidad_medida: calc.measured,
      cantidad_reparacion: body.cantidad_reparacion !== '' && body.cantidad_reparacion !== null && body.cantidad_reparacion !== undefined
        ? parseFloat(body.cantidad_reparacion)
        : null,
      justificacion_reparacion: toText(body.justificacion_reparacion, MAX_TEXT_LENGTH),
      modo_precio: body.modo_precio || 'complete',
      precio_unitario_neto: calc.pu,
      incluye_iva: false,
      subtotal_neto: calc.subtotal,
      precio_verificado: Boolean(body.precio_verificado),
    };

    const insertSql = `
      INSERT INTO partida_dano (
        expediente_id, sector_id, sector, elemento, dano_tipo, materialidad,
        material_existente, descripcion_dano, reparacion_propuesta, proceso_id,
        es_estructural, referencia_estructural, unidad_id, metodo_calculo,
        largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado,
        cantidad_afectada, porcentaje_intervencion, cantidad_medida, cantidad_reparacion,
        justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva,
        subtotal_neto, precio_verificado
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30
      ) RETURNING *
    `;

    const result = await db.query(insertSql, [
      lineData.expediente_id, lineData.sector_id, lineData.sector, lineData.elemento,
      lineData.dano_tipo, lineData.materialidad, lineData.material_existente,
      lineData.descripcion_dano, lineData.reparacion_propuesta, lineData.proceso_id,
      lineData.es_estructural, lineData.referencia_estructural, lineData.unidad_id,
      lineData.metodo_calculo, lineData.largo, lineData.ancho, lineData.alto,
      lineData.cantidad_directa, lineData.descuento, lineData.porcentaje_afectado,
      lineData.cantidad_afectada, lineData.porcentaje_intervencion, lineData.cantidad_medida,
      lineData.cantidad_reparacion, lineData.justificacion_reparacion, lineData.modo_precio,
      lineData.precio_unitario_neto, lineData.incluye_iva, lineData.subtotal_neto,
      lineData.precio_verificado
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar partida en PostgreSQL:', error);
    res.status(500).json({ error: 'No fue posible registrar la partida en la base de datos: ' + error.message });
  }
};

// DELETE /api/cases/lines/:id - Eliminar partida
exports.deleteLine = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';

    // Comprobar pertenencia
    const lineCheck = await db.query('SELECT expediente_id FROM partida_dano WHERE id = $1', [id]);
    if (lineCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Partida no encontrada.' });
    }

    const hasAccess = await checkCaseAccess(userId, userRole, lineCheck.rows[0].expediente_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No autorizado para eliminar partidas en este expediente.' });
    }

    const result = await db.query('DELETE FROM partida_dano WHERE id = $1 RETURNING *', [id]);
    return res.json({ message: 'Partida eliminada exitosamente de la base de datos.', deleted: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar partida en PostgreSQL:', error);
    res.status(500).json({ error: 'No fue posible eliminar la partida: ' + error.message });
  }
};

exports.validateLinePayload = validateLinePayload;
