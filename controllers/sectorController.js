const db = require('../config/database');

// Verificar acceso del usuario al expediente
async function checkCaseAccess(userId, userRole, caseId) {
  if (userRole === 'admin' || userRole === 'supervisor') return true;
  const res = await db.query(
    'SELECT id FROM expediente WHERE id = $1 AND (inspector_id = $2 OR inspector_nombre ILIKE $3)',
    [caseId, userId, `%${userId}%`]
  );
  return res.rows.length > 0;
}

// GET /api/cases/:caseId/sectors - Listado de sectores reales del expediente
exports.getSectorsByCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';

    const hasAccess = await checkCaseAccess(userId, userRole, caseId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acceso denegado a este expediente.' });
    }

    const query = `
      SELECT s.*,
             u.nombre AS usuario_nombre,
             (SELECT COUNT(*) FROM partida_dano p WHERE p.sector_id = s.id OR (p.expediente_id = s.expediente_id AND UPPER(p.sector) = UPPER(s.nombre))) AS total_danos,
             (SELECT COUNT(*) FROM fotografia f WHERE f.sector_id = s.id OR (f.expediente_id = s.expediente_id AND UPPER(f.sector) = UPPER(s.nombre))) AS total_fotos
      FROM sector_expediente s
      LEFT JOIN usuario u ON s.usuario_id = u.id
      WHERE s.expediente_id = $1
      ORDER BY s.created_at ASC
    `;

    const result = await db.query(query, [caseId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener sectores:', error);
    res.status(500).json({ error: 'No fue posible obtener los sectores desde la base de datos.' });
  }
};

// POST /api/cases/:caseId/sectors - Crear nuevo sector para el expediente
exports.createSector = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';

    const hasAccess = await checkCaseAccess(userId, userRole, caseId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No está autorizado para agregar sectores en este expediente.' });
    }

    const { nombre, descripcion } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del sector es obligatorio.' });
    }

    const cleanNombre = nombre.trim().toUpperCase();

    // Comprobar si ya existe en este expediente
    const existCheck = await db.query(
      'SELECT id FROM sector_expediente WHERE expediente_id = $1 AND UPPER(nombre) = $2',
      [caseId, cleanNombre]
    );

    if (existCheck.rows.length > 0) {
      return res.status(400).json({ error: `El sector "${cleanNombre}" ya existe en este expediente.` });
    }

    const insertQuery = `
      INSERT INTO sector_expediente (expediente_id, nombre, descripcion, usuario_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      caseId,
      cleanNombre,
      descripcion ? descripcion.trim() : '',
      userId
    ]);

    return res.status(201).json({
      ...result.rows[0],
      total_danos: 0,
      total_fotos: 0
    });
  } catch (error) {
    console.error('Error al registrar sector:', error);
    res.status(500).json({ error: 'Error al persistir el sector en la base de datos.' });
  }
};

// DELETE /api/cases/:caseId/sectors/:sectorId - Eliminar sector
exports.deleteSector = async (req, res) => {
  try {
    const { caseId, sectorId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';

    const hasAccess = await checkCaseAccess(userId, userRole, caseId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No autorizado para eliminar sectores en este expediente.' });
    }

    // Verificar si existen daños asociados al sector
    const damageCheck = await db.query(
      'SELECT id FROM partida_dano WHERE sector_id = $1 OR (expediente_id = $2 AND sector = (SELECT nombre FROM sector_expediente WHERE id = $1))',
      [sectorId, caseId]
    );

    if (damageCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar el sector porque contiene ${damageCheck.rows.length} partidas de daño registradas. Elimine primero los daños.` 
      });
    }

    const deleteRes = await db.query(
      'DELETE FROM sector_expediente WHERE id = $1 AND expediente_id = $2 RETURNING *',
      [sectorId, caseId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sector no encontrado.' });
    }

    return res.json({ message: 'Sector eliminado exitosamente.', deleted: deleteRes.rows[0] });
  } catch (error) {
    console.error('Error al eliminar sector:', error);
    res.status(500).json({ error: 'Error al eliminar el sector en la base de datos.' });
  }
};

