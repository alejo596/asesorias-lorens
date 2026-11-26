const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const { generateToken, comparePassword } = require('../config/auth');

const STORAGE_ROOT = path.resolve(__dirname, '..', 'storage');

// Helper para validar pertenencia de expediente a usuario cliente
async function verifyClientCaseAccess(userId, caseId) {
  const query = `
    SELECT c.id, c.codigo, c.estado, c.etapa_actual,
           e.orden AS etapa_orden, e.nombre AS etapa_nombre
    FROM expediente c
    JOIN expediente_cliente ec ON c.id = ec.expediente_id
    LEFT JOIN etapa_expediente e ON c.etapa_actual = e.id
    WHERE ec.usuario_id = $1 AND c.id = $2 AND ec.activo = TRUE
  `;
  const res = await db.query(query, [userId, caseId]);
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

// 1. POST /api/client/auth/login
exports.clientLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Debe ingresar su correo electrónico y contraseña.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Consulta en PostgreSQL
    const userRes = await db.query(
      `SELECT id, nombre, email, password_hash, rol, roles, activo 
       FROM usuario 
       WHERE LOWER(email) = LOWER($1) AND activo = TRUE`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifique su correo y contraseña.' });
    }

    const user = userRes.rows[0];
    const isPasswordValid = await comparePassword(String(password).trim(), user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifique su correo y contraseña.' });
    }

    // Comprobar rol cliente o roles permitidos
    const rolesList = Array.isArray(user.roles) ? user.roles : [user.rol];
    if (user.rol !== 'cliente' && !rolesList.includes('cliente')) {
      return res.status(403).json({
        error: 'Esta cuenta no tiene perfil de Cliente o Asegurado. Utilice el acceso para personal operativo.'
      });
    }

    const token = generateToken({
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: 'cliente',
      roles: ['cliente']
    });

    return res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: 'cliente',
        doble_perfil: false,
        roles: ['cliente']
      }
    });
  } catch (error) {
    console.error('[CLIENT AUTH ERROR]', error);
    res.status(500).json({ error: 'Error interno en autenticación de cliente.' });
  }
};

// 2. GET /api/client/me
exports.getProfile = async (req, res) => {
  try {
    return res.json({
      user: {
        id: req.user.id,
        nombre: req.user.nombre,
        email: req.user.email,
        rol: req.user.rol,
        doble_perfil: false,
        roles: ['cliente']
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar perfil del cliente.' });
  }
};

// 3. GET /api/client/cases - Lista de expedientes del cliente autenticado con KPIs
exports.getClientCases = async (req, res) => {
  try {
    const userId = req.user.id;

    // Consulta de expedientes vinculados
    const casesQuery = `
      SELECT c.id, c.codigo, c.numero_siniestro, c.tipo_evento, c.direccion, c.comuna, c.ciudad,
             c.fecha_evento, c.fecha_visita, c.created_at, c.estado, c.etapa_actual,
             c.avance_porcentaje, c.tipo_inmueble, c.aseguradora,
             COALESCE(e.nombre, 'Evidencia') AS etapa_nombre,
             COALESCE(e.orden, 5) AS etapa_orden,
             COALESCE(e.descripcion_publica, 'Revisión técnica de antecedentes.') AS etapa_descripcion,
             (COALESCE(e.orden, 5) >= 5) AS timeline_habilitado
      FROM expediente c
      JOIN expediente_cliente ec ON c.id = ec.expediente_id
      LEFT JOIN etapa_expediente e ON c.etapa_actual = e.id
      WHERE ec.usuario_id = $1 AND ec.activo = TRUE
      ORDER BY c.created_at DESC
    `;

    const result = await db.query(casesQuery, [userId]);
    const cases = result.rows;

    // Cálculo dinámico de KPIs
    const total = cases.length;
    const en_proceso = cases.filter(c => c.estado === 'activo' && c.etapa_actual !== 'finalizado').length;
    const finalizados = cases.filter(c => c.estado === 'procesado' || c.etapa_actual === 'finalizado').length;
    const pendientes = cases.filter(c => c.estado === 'en_espera').length;

    return res.json({
      cases,
      kpis: {
        total,
        en_proceso,
        finalizados,
        pendientes
      }
    });
  } catch (error) {
    console.error('[GET CLIENT CASES ERROR]', error);
    res.status(500).json({ error: 'Error al consultar los expedientes del cliente.' });
  }
};

// 4. GET /api/client/cases/:caseId - Ficha de seguimiento de expediente específico
exports.getClientCaseDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { caseId } = req.params;

    const query = `
      SELECT c.id, c.codigo, c.cliente_nombre, c.numero_siniestro, c.numero_poliza,
             c.tipo_evento, c.tipo_inmueble, c.direccion, c.comuna, c.ciudad, c.region,
             c.fecha_evento, c.fecha_visita, c.created_at, c.estado, c.etapa_actual,
             c.avance_porcentaje, c.aseguradora, c.conclusion,
             COALESCE(e.nombre, 'Evidencia') AS etapa_nombre,
             COALESCE(e.orden, 5) AS etapa_orden,
             COALESCE(e.descripcion_publica, 'Revisión técnica de antecedentes del siniestro.') AS etapa_descripcion,
             (COALESCE(e.orden, 5) >= 5) AS timeline_habilitado
      FROM expediente c
      JOIN expediente_cliente ec ON c.id = ec.expediente_id
      LEFT JOIN etapa_expediente e ON c.etapa_actual = e.id
      WHERE ec.usuario_id = $1 AND c.id = $2 AND ec.activo = TRUE
    `;

    const result = await db.query(query, [userId, caseId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado o no autorizado para su cuenta.' });
    }

    const caseData = result.rows[0];

    // Contar evidencias autorizadas disponibles
    const photoCountRes = await db.query(
      'SELECT COUNT(*) FROM fotografia WHERE expediente_id = $1 AND visible_cliente = TRUE',
      [caseId]
    );
    caseData.total_fotos_autorizadas = parseInt(photoCountRes.rows[0].count, 10);

    return res.json(caseData);
  } catch (error) {
    console.error('[GET CLIENT CASE DETAIL ERROR]', error);
    res.status(500).json({ error: 'Error al obtener la información del expediente.' });
  }
};

// 5. GET /api/client/cases/:caseId/timeline - Línea de tiempo de procesos del siniestro
exports.getClientCaseTimeline = async (req, res) => {
  try {
    const userId = req.user.id;
    const { caseId } = req.params;

    const caseInfo = await verifyClientCaseAccess(userId, caseId);
    if (!caseInfo) {
      return res.status(403).json({ error: 'Acceso denegado a este expediente.' });
    }

    const etapaOrdenActual = parseInt(caseInfo.etapa_orden || 5, 10);

    // REGLA OBLIGATORIA: La línea de tiempo detallada se habilita a partir de la etapa 'evidencia' (orden >= 5)
    if (etapaOrdenActual < 5) {
      return res.status(403).json({
        habilitado: false,
        mensaje: 'El seguimiento detallado estará disponible cuando su expediente ingrese a la etapa de Evidencia.',
        etapa_actual: caseInfo.etapa_nombre || 'En proceso previo a Evidencia',
        etapa_id: caseInfo.etapa_actual
      });
    }

    // 1. Catálogo completo de las 9 etapas
    const etapasCatalogRes = await db.query(
      'SELECT id, nombre, descripcion_publica, orden FROM etapa_expediente ORDER BY orden ASC'
    );
    const etapasCatalog = etapasCatalogRes.rows;

    // 2. Historial de etapas registradas en PostgreSQL
    const historialRes = await db.query(`
      SELECT h.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM expediente_etapa_historial h
      LEFT JOIN usuario u ON h.usuario_id = u.id
      WHERE h.expediente_id = $1 AND h.visible_cliente = TRUE
      ORDER BY h.created_at ASC
    `, [caseId]);
    const historial = historialRes.rows;

    // Mapa de historial por etapa_id
    const historialMap = new Map();
    historial.forEach(h => historialMap.set(h.etapa_id, h));

    // 3. Ensamblar las 9 etapas con su estado visual exacto:
    //    'completada' (verde), 'en_curso' (azul destacado), 'pendiente' (gris), 'observada' (ámbar)
    const timeline = etapasCatalog.map(etapa => {
      const h = historialMap.get(etapa.id);

      let estadoVisual = 'pendiente';
      let fechaInicio = null;
      let fechaFin = null;
      let descripcion = etapa.descripcion_publica;
      let responsable = 'Equipo Técnico ASESORÍAS LORENS';

      if (h) {
        estadoVisual = h.estado_proceso;
        fechaInicio = h.fecha_inicio;
        fechaFin = h.fecha_fin;
        descripcion = h.descripcion_publica || etapa.descripcion_publica;
        if (h.usuario_nombre) {
          responsable = `${h.usuario_nombre} (${h.usuario_rol === 'inspector' ? 'Perito Inspector' : 'Revisor Pericial'})`;
        }
      } else {
        // Inferencia natural basada en la etapa_actual
        if (etapa.orden < etapaOrdenActual) {
          estadoVisual = 'completada';
        } else if (etapa.orden === etapaOrdenActual) {
          estadoVisual = (caseInfo.estado === 'en_espera') ? 'observada' : 'en_curso';
        } else {
          estadoVisual = 'pendiente';
        }
      }

      return {
        id: etapa.id,
        nombre: etapa.nombre,
        orden: etapa.orden,
        estado: estadoVisual,
        es_etapa_actual: (etapa.id === caseInfo.etapa_actual),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        descripcion_publica: descripcion,
        responsable
      };
    });

    return res.json({
      habilitado: true,
      expediente_id: caseId,
      codigo: caseInfo.codigo,
      etapa_actual: caseInfo.etapa_actual,
      etapa_actual_nombre: caseInfo.etapa_nombre,
      etapas: timeline
    });
  } catch (error) {
    console.error('[GET CLIENT TIMELINE ERROR]', error);
    res.status(500).json({ error: 'Error al consultar la línea de tiempo del expediente.' });
  }
};

// 6. GET /api/client/cases/:caseId/evidence - Fotografías autorizadas para el cliente
exports.getClientCaseEvidence = async (req, res) => {
  try {
    const userId = req.user.id;
    const { caseId } = req.params;

    const caseInfo = await verifyClientCaseAccess(userId, caseId);
    if (!caseInfo) {
      return res.status(403).json({ error: 'Acceso denegado a las evidencias de este expediente.' });
    }

    // Regla de habilitación de evidencias
    const etapaOrden = parseInt(caseInfo.etapa_orden || 5, 10);
    if (etapaOrden < 5) {
      return res.status(403).json({
        error: 'Las evidencias fotográficas estarán disponibles para consulta cuando el caso alcance la etapa de Evidencia.'
      });
    }

    const query = `
      SELECT f.id, f.expediente_id, f.nombre_original, f.sector, f.descripcion,
             f.mime_type, f.tamano_bytes, f.fecha_captura, f.created_at,
             s.nombre AS sector_nombre
      FROM fotografia f
      LEFT JOIN sector_expediente s ON f.sector_id = s.id
      WHERE f.expediente_id = $1 AND f.visible_cliente = TRUE
      ORDER BY f.created_at DESC
    `;

    const result = await db.query(query, [caseId]);
    const photos = result.rows.map(p => ({
      ...p,
      url: `/api/client/cases/${caseId}/photos/${p.id}/file`,
      thumbnail_url: `/api/client/cases/${caseId}/photos/${p.id}/file`
    }));

    return res.json(photos);
  } catch (error) {
    console.error('[GET CLIENT EVIDENCE ERROR]', error);
    res.status(500).json({ error: 'Error al consultar fotografías autorizadas.' });
  }
};

// 7. GET /api/client/cases/:caseId/photos/:photoId/file - Streaming autorizado para el cliente
exports.streamClientPhotoFile = async (req, res) => {
  try {
    const { caseId, photoId } = req.params;
    let userId = req.user ? req.user.id : null;

    if (!userId && req.query && req.query.token) {
      try {
        const { verifyToken } = require('../config/auth');
        const decoded = verifyToken(req.query.token);
        userId = decoded.id;
        req.user = decoded;
      } catch (err) {}
    }

    if (!userId) {
      return res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado.' });
    }

    const caseInfo = await verifyClientCaseAccess(userId, caseId);
    if (!caseInfo) {
      return res.status(403).json({ error: 'Acceso denegado a esta fotografía.' });
    }

    // Verificar que la foto exista y esté expresamente autorizada para el cliente
    const photoRes = await db.query(
      `SELECT id, ruta_almacenamiento, mime_type, visible_cliente 
       FROM fotografia 
       WHERE id = $1 AND expediente_id = $2`,
      [photoId, caseId]
    );

    if (photoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fotografía no encontrada.' });
    }

    const photo = photoRes.rows[0];
    if (photo.visible_cliente !== true) {
      return res.status(403).json({ error: 'Esta fotografía es de uso pericial interno y no está disponible para visualización pública.' });
    }

    const fullPath = path.resolve(STORAGE_ROOT, photo.ruta_almacenamiento);

    // Prevención de Path Traversal
    if (!fullPath.startsWith(path.resolve(STORAGE_ROOT))) {
      return res.status(403).json({ error: 'Acceso a ruta inválida.' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'El archivo físico no se encuentra disponible.' });
    }

    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[STREAM CLIENT PHOTO ERROR]', error);
    res.status(500).json({ error: 'No fue posible cargar la imagen solicitada.' });
  }
};

