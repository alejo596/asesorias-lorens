const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const db = require('../config/database');

const uuidv4 = () => crypto.randomUUID();

// Directorio raíz de almacenamiento persistente
const STORAGE_ROOT = path.join(__dirname, '..', 'storage');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB máximo
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Asegurar que existan los directorios base de almacenamiento
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Configuración de Multer para almacenamiento en disco con estructura por expediente
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { caseId } = req.params;
    if (!caseId) {
      return cb(new Error('Identificador de expediente obligatorio para el almacenamiento.'));
    }
    const caseDir = path.join(STORAGE_ROOT, 'expedientes', caseId, 'originales');
    fs.mkdirSync(caseDir, { recursive: true });

    // También preparar directorio para miniaturas
    const thumbDir = path.join(STORAGE_ROOT, 'expedientes', caseId, 'miniaturas');
    fs.mkdirSync(thumbDir, { recursive: true });

    cb(null, caseDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
    const uniqueName = `${uuidv4()}${cleanExt}`;
    cb(null, uniqueName);
  }
});

// Filtro de validación de tipo MIME y extensión
const fileFilter = (req, file, cb) => {
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('image/');
  const ext = path.extname(file.originalname).toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeOk && (extOk || !ext)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagen no permitido. Solo se aceptan archivos JPG, PNG y WebP.'));
  }
};

// Permite 'foto', 'photo' o 'file' como nombre de campo multipart
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).fields([
  { name: 'foto', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

// Helper para verificar acceso del inspector al expediente
async function checkCaseAccess(userId, userRole, caseId, userNombre = '') {
  if (!userRole || userRole === 'admin' || userRole === 'supervisor' || userRole === 'webmaster') return true;
  if (!userId) return false;

  const res = await db.query(
    'SELECT id, inspector_id, inspector_nombre FROM expediente WHERE id = $1',
    [caseId]
  );
  if (res.rows.length === 0) return false;
  const row = res.rows[0];

  if (!row.inspector_id || row.inspector_id === userId) return true;
  if (userNombre && row.inspector_nombre && row.inspector_nombre.toLowerCase().includes(userNombre.toLowerCase())) return true;
  
  return true;
}

// POST /api/cases/:caseId/photos/upload - Carga física con registro en PostgreSQL y eventos de timeline
exports.uploadPhoto = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('[UPLOAD ERROR]', err.message);
      return res.status(400).json({ error: err.message || 'Error al procesar el archivo.' });
    }

    const uploadedFile = (req.files && (req.files.foto?.[0] || req.files.photo?.[0] || req.files.file?.[0])) || req.file;

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No se adjuntó ningún archivo de imagen.' });
    }

    const { caseId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';
    const userNombre = req.user ? req.user.nombre : '';

    // 1. Validar autorización de acceso al expediente
    try {
      const hasAccess = await checkCaseAccess(userId, userRole, caseId, userNombre);
      if (!hasAccess) {
        if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
        return res.status(403).json({ error: 'Acceso denegado: Este expediente no está asignado a su cargo.' });
      }
    } catch (authErr) {
      if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      return res.status(500).json({ error: 'Error al verificar asignación del expediente.' });
    }

    const { sector_id, sectorId, sector, dano_id, damageId, partida_id, descripcion, description, fecha_captura } = req.body;
    const finalSectorId = sector_id || sectorId || null;
    const finalDanoId = dano_id || damageId || partida_id || null;
    const finalDesc = descripcion || description || '';

    const relativePath = `expedientes/${caseId}/originales/${uploadedFile.filename}`;

    // 2. Persistir metadatos en PostgreSQL dentro de una transacción
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      let finalSectorName = (sector || '').trim().toUpperCase() || 'GENERAL';

      // Sincronizar nombre de sector si se pasó sector_id
      if (finalSectorId) {
        const secRes = await client.query('SELECT nombre FROM sector_expediente WHERE id = $1', [finalSectorId]);
        if (secRes.rows.length > 0) {
          finalSectorName = secRes.rows[0].nombre.toUpperCase();
        }
      }

      const insertQuery = `
        INSERT INTO fotografia (
          expediente_id,
          sector_id,
          partida_id,
          dano_id,
          nombre_original,
          nombre_archivo,
          ruta_almacenamiento,
          ruta_thumbnail,
          sector,
          descripcion,
          mime_type,
          tamano_bytes,
          usuario_id,
          fecha_captura
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        caseId,
        finalSectorId,
        finalDanoId,
        finalDanoId,
        uploadedFile.originalname || 'evidencia.jpg',
        uploadedFile.filename,
        relativePath,
        relativePath,
        finalSectorName,
        finalDesc,
        uploadedFile.mimetype || 'image/jpeg',
        uploadedFile.size,
        userId,
        fecha_captura || new Date()
      ]);

      const savedPhoto = result.rows[0];

      // 3. Registrar eventos iniciales en la tabla evidencia_eventos (Timeline)
      const eventTimestamp = new Date();

      // Evento 1: Fotografía registrada
      await client.query(`
        INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
        VALUES ($1, $2, 'FOTO_REGISTRADA', $3, $4, $5)
      `, [
        savedPhoto.id,
        userId,
        `Fotografía pericial capturada en terreno (${savedPhoto.nombre_original})`,
        JSON.stringify({ nombre_original: savedPhoto.nombre_original, mime_type: savedPhoto.mime_type }),
        eventTimestamp
      ]);

      // Evento 2: Archivo físico persistido
      await client.query(`
        INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
        VALUES ($1, $2, 'ARCHIVO_ALMACENADO', $3, $4, $5)
      `, [
        savedPhoto.id,
        userId,
        `Archivo almacenado en almacenamiento persistente (${(savedPhoto.tamano_bytes / 1024).toFixed(1)} KB)`,
        JSON.stringify({ ruta: savedPhoto.ruta_almacenamiento, tamano_bytes: savedPhoto.tamano_bytes }),
        eventTimestamp
      ]);

      // Evento 3: Sector asociado
      if (finalSectorName) {
        await client.query(`
          INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
          VALUES ($1, $2, 'SECTOR_ASOCIADO', $3, $4, $5)
        `, [
          savedPhoto.id,
          userId,
          `Evidencia asociada al sector "${finalSectorName}"`,
          JSON.stringify({ sector: finalSectorName, sector_id: finalSectorId }),
          eventTimestamp
        ]);
      }

      // Evento 4: Daño vinculado si corresponde
      if (finalDanoId) {
        await client.query(`
          INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
          VALUES ($1, $2, 'DANO_VINCULADO', 'Evidencia vinculada a partida de daño pericial', $3, $4)
        `, [
          savedPhoto.id,
          userId,
          JSON.stringify({ dano_id: finalDanoId }),
          eventTimestamp
        ]);
      }

      await client.query('COMMIT');

      // Formatear respuesta JSON completa para el cliente
      const responseData = {
        ...savedPhoto,
        url: `/api/cases/${caseId}/photos/${savedPhoto.id}/file`,
        thumbnail_url: `/api/cases/${caseId}/photos/${savedPhoto.id}/file`
      };

      return res.status(201).json(responseData);
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error('[DB INSERT PHOTO ERROR]', dbErr.message);

      // Limpieza atómica: eliminar archivo huérfano si la BD falla
      if (fs.existsSync(uploadedFile.path)) {
        try {
          fs.unlinkSync(uploadedFile.path);
        } catch (unlinkErr) {
          console.error('[CLEANUP ERROR] No se pudo eliminar archivo huérfano:', unlinkErr.message);
        }
      }
      return res.status(500).json({ error: 'No fue posible registrar la evidencia fotográfica en la base de datos.' });
    } finally {
      client.release();
    }
  });
};

// GET /api/cases/:caseId/photos - Listado real de fotografías del expediente desde PostgreSQL
exports.getPhotos = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';
    const userNombre = req.user ? req.user.nombre : '';

    const hasAccess = await checkCaseAccess(userId, userRole, caseId, userNombre);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acceso denegado a las evidencias de este expediente.' });
    }

    const query = `
      SELECT f.*, 
             s.nombre AS sector_nombre,
             p.descripcion_dano AS dano_descripcion,
             u.nombre AS inspector_nombre,
             (SELECT COUNT(*) FROM evidencia_eventos WHERE fotografia_id = f.id) AS total_eventos
      FROM fotografia f
      LEFT JOIN sector_expediente s ON f.sector_id = s.id
      LEFT JOIN partida_dano p ON f.dano_id = p.id
      LEFT JOIN usuario u ON f.usuario_id = u.id
      WHERE f.expediente_id = $1
      ORDER BY f.created_at DESC
    `;

    const result = await db.query(query, [caseId]);

    const photosWithUrls = result.rows.map(p => ({
      ...p,
      url: `/api/cases/${caseId}/photos/${p.id}/file`,
      thumbnail_url: `/api/cases/${caseId}/photos/${p.id}/file`
    }));

    return res.json(photosWithUrls);
  } catch (error) {
    console.error('Error al listar fotografías:', error);
    res.status(500).json({ error: 'Error al consultar fotografías desde la base de datos.' });
  }
};

// GET /api/cases/:caseId/photos/:photoId/file - Transmisión física de la imagen
exports.streamPhotoFile = async (req, res) => {
  try {
    const { caseId, photoId } = req.params;
    let userId = req.user ? req.user.id : null;
    let userRole = req.user ? req.user.rol : null;
    let userNombre = req.user ? req.user.nombre : '';

    if (!userId && req.query && req.query.token) {
      try {
        const { verifyToken } = require('../config/auth');
        const decoded = verifyToken(req.query.token);
        userId = decoded.id;
        userRole = decoded.rol;
        userNombre = decoded.nombre || '';
        req.user = decoded;
      } catch (tokenErr) {}
    }

    const hasAccess = await checkCaseAccess(userId, userRole, caseId, userNombre);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acceso denegado al archivo.' });
    }

    const photoRes = await db.query(
      'SELECT id, nombre_archivo, ruta_almacenamiento, mime_type, tamano_bytes FROM fotografia WHERE id = $1 AND expediente_id = $2',
      [photoId, caseId]
    );

    if (photoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fotografía no encontrada.' });
    }

    const photo = photoRes.rows[0];
    const fullPath = path.resolve(STORAGE_ROOT, photo.ruta_almacenamiento);

    // Prevención de Path Traversal
    if (!fullPath.startsWith(path.resolve(STORAGE_ROOT))) {
      return res.status(403).json({ error: 'Acceso a ruta de archivo inválida.' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'El archivo físico no existe en el servidor.' });
    }

    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error al servir fotografía:', error);
    res.status(500).json({ error: 'No fue posible cargar el archivo de imagen.' });
  }
};

// GET /api/cases/:caseId/photos/:photoId/timeline - Historial cronológico de la evidencia
exports.getPhotoTimeline = async (req, res) => {
  try {
    const { caseId, photoId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';
    const userNombre = req.user ? req.user.nombre : '';

    const hasAccess = await checkCaseAccess(userId, userRole, caseId, userNombre);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acceso denegado al historial de este expediente.' });
    }

    // Consultar información básica de la fotografía
    const photoRes = await db.query(
      'SELECT id, expediente_id, nombre_original, sector, descripcion, created_at FROM fotografia WHERE id = $1 AND expediente_id = $2',
      [photoId, caseId]
    );

    if (photoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fotografía no encontrada.' });
    }

    // Consultar eventos ordenados cronológicamente
    const eventsQuery = `
      SELECT e.id,
             e.fotografia_id,
             e.usuario_id,
             e.tipo_evento,
             e.descripcion,
             e.metadata,
             e.created_at,
             COALESCE(u.nombre, 'Sistema pericial') AS usuario_nombre,
             COALESCE(u.rol::text, 'sistema') AS usuario_rol
      FROM evidencia_eventos e
      LEFT JOIN usuario u ON e.usuario_id = u.id
      WHERE e.fotografia_id = $1
      ORDER BY e.created_at ASC
    `;

    const eventsRes = await db.query(eventsQuery, [photoId]);

    return res.json({
      fotografia: photoRes.rows[0],
      eventos: eventsRes.rows,
      timeline: eventsRes.rows
    });
  } catch (error) {
    console.error('Error al obtener timeline de fotografía:', error);
    res.status(500).json({ error: 'Error al consultar el historial de la evidencia.' });
  }
};

// POST /api/cases/:caseId/photos/:photoId/timeline - Registrar un nuevo evento de auditoría
exports.addPhotoTimelineEvent = async (req, res) => {
  try {
    const { caseId, photoId } = req.params;
    const { tipo_evento, descripcion, metadata } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!tipo_evento || !descripcion) {
      return res.status(400).json({ error: 'tipo_evento y descripcion son obligatorios.' });
    }

    const insertSql = `
      INSERT INTO evidencia_eventos (fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await db.query(insertSql, [
      photoId,
      userId,
      tipo_evento.toUpperCase(),
      descripcion,
      metadata ? JSON.stringify(metadata) : '{}'
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar evento de timeline:', error);
    res.status(500).json({ error: 'No fue posible registrar el evento de auditoría.' });
  }
};

// DELETE /api/cases/:caseId/photos/:photoId - Eliminación atómica en PostgreSQL y disco
exports.deletePhoto = async (req, res) => {
  try {
    const { caseId, photoId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.rol : 'inspector';
    const userNombre = req.user ? req.user.nombre : '';

    const hasAccess = await checkCaseAccess(userId, userRole, caseId, userNombre);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acceso denegado: No puede eliminar evidencias de este expediente.' });
    }

    const photoRes = await db.query(
      'SELECT id, ruta_almacenamiento FROM fotografia WHERE id = $1 AND expediente_id = $2',
      [photoId, caseId]
    );

    if (photoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fotografía no encontrada.' });
    }

    const photo = photoRes.rows[0];
    const fullPath = path.resolve(STORAGE_ROOT, photo.ruta_almacenamiento);

    // Eliminar registro (elimina en cascada evidencia_eventos)
    await db.query('DELETE FROM fotografia WHERE id = $1 AND expediente_id = $2', [photoId, caseId]);

    // Eliminar archivo físico en disco
    if (fullPath.startsWith(path.resolve(STORAGE_ROOT)) && fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (unlinkErr) {
        console.warn('[STORAGE WARN] No se pudo borrar archivo físico:', unlinkErr.message);
      }
    }

    return res.json({ message: 'Evidencia fotográfica eliminada con éxito.' });
  } catch (error) {
    console.error('Error al eliminar fotografía:', error);
    res.status(500).json({ error: 'Error al eliminar la fotografía del servidor.' });
  }
};
