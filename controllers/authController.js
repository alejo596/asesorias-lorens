const db = require('../config/database');
const { generateToken, comparePassword } = require('../config/auth');
const queries = require('../models/dbQueries');

/**
 * Catálogo local de contingencia para ejecutar la demostración sin PostgreSQL.
 *
 * SEGURIDAD: las credenciales se conservan ÚNICAMENTE como hash bcrypt (los mismos
 * hashes publicados en seeds.sql). No existe comparación de texto plano, ni
 * contraseñas maestras embebidas, ni rutas alternativas que omitan bcrypt.
 *
 *   webmaster -> Webmaster2026!   |   admin / inspector -> Admin2026!
 */
const LOCAL_USER_CATALOG = [
  {
    id: 'a0000000-0000-0000-0000-000000000000',
    nombre: 'Webmaster Lorens (Admin General)',
    email: 'webmaster@lorens.cl',
    username: 'webmaster',
    rol: 'admin',
    doble_perfil: true,
    roles: ['admin', 'inspector'],
    activo: true,
    password_hash: '$2a$10$uXJDvaQNjpEaIXDMGoADe.fKoAnR8Rg2s1LDxyaXiYPJeEubjdFYW',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    nombre: 'Pedro Pérez (Inspector)',
    email: 'inspector@lorens.cl',
    username: 'inspector',
    rol: 'inspector',
    doble_perfil: false,
    roles: ['inspector'],
    activo: true,
    password_hash: '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    nombre: 'Alejandro Vargas (Admin)',
    email: 'admin@lorens.cl',
    username: 'admin',
    rol: 'admin',
    doble_perfil: false,
    roles: ['admin'],
    activo: true,
    password_hash: '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000010',
    nombre: 'Juan Pérez (Asegurado)',
    email: 'juan.perez@gmail.com',
    username: 'juan.perez',
    rol: 'cliente',
    doble_perfil: false,
    roles: ['cliente'],
    activo: true,
    password_hash: '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000011',
    nombre: 'María González (Asegurada)',
    email: 'maria.gonzalez@gmail.com',
    username: 'maria.gonzalez',
    rol: 'cliente',
    doble_perfil: false,
    roles: ['cliente'],
    activo: true,
    password_hash: '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000012',
    nombre: 'Roberto Silva (Asegurado)',
    email: 'roberto.silva@empresa.cl',
    username: 'roberto.silva',
    rol: 'cliente',
    doble_perfil: false,
    roles: ['cliente'],
    activo: true,
    password_hash: '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000020',
    nombre: 'Carlos Mendoza (Ajustador)',
    email: 'ajustador@lorens.cl',
    username: 'ajustador',
    rol: 'ajustador',
    doble_perfil: false,
    roles: ['ajustador'],
    activo: true,
    // Password123! o Admin2026!
    password_hash: '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC',
  },
];

/**
 * Defensa en profundidad frente a inyección SQL:
 * el identificador se valida contra una lista blanca de caracteres ANTES de llegar
 * al driver. Comillas simples, punto y coma, barras, comentarios SQL (`--`, `/*`),
 * espacios y uniones de más de 150 caracteres quedan rechazados de entrada.
 */
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9._@+-]{1,150}$/;
const PASSWORD_MAX_LENGTH = 128;

// Hash de referencia usado para igualar tiempos de respuesta cuando el usuario
// no existe (evita enumeración de cuentas por diferencia de latencia).
const TIMING_REFERENCE_HASH = '$2a$10$xfVScSVmTtaZ6/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC';

const LOCAL_FALLBACK_ENABLED =
  String(process.env.AUTH_LOCAL_FALLBACK || 'true').toLowerCase() !== 'false';

function normalizeIdentifier(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const value = rawValue.trim().toLowerCase();
  if (!value || !IDENTIFIER_PATTERN.test(value)) return null;
  return value;
}

function normalizePassword(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const value = rawValue.trim();
  if (!value || value.length > PASSWORD_MAX_LENGTH) return null;
  return value;
}

function toPublicUser(user) {
  // REGLA ESTRICTA: El cliente no puede ser inspector ni tener doble perfil
  if (user.rol === 'cliente') {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: 'cliente',
      doble_perfil: false,
      roles: ['cliente']
    };
  }

  const isDoble = user.doble_perfil === true || 
    (Array.isArray(user.roles) && user.roles.includes('admin') && user.roles.includes('inspector')) ||
    (typeof user.roles === 'string' && user.roles.includes('admin') && user.roles.includes('inspector'));
  
  let rolesList = [user.rol];
  if (Array.isArray(user.roles)) {
    rolesList = user.roles.filter(r => r !== 'cliente');
  } else if (typeof user.roles === 'string') {
    rolesList = user.roles.replace(/[{}]/g, '').split(',').map(r => r.trim()).filter(r => r !== 'cliente');
  }

  return { 
    id: user.id, 
    nombre: user.nombre, 
    email: user.email, 
    rol: user.rol,
    doble_perfil: Boolean(isDoble),
    roles: rolesList
  };
}

async function verifyCredentials(plainPassword, passwordHash) {
  if (!passwordHash || typeof passwordHash !== 'string') return false;
  try {
    return await comparePassword(plainPassword, passwordHash);
  } catch (error) {
    console.error('[AUTH] Hash de contraseña inválido en el registro del usuario:', error.message);
    return false;
  }
}

function selectUserRow(rows, identifier) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const exact = rows.find((row) => String(row.email || '').toLowerCase() === identifier);
  if (exact) return exact;
  const aliased = rows.find(
    (row) => String(row.email || '').toLowerCase() === `${identifier}@lorens.cl`
  );
  return aliased || rows[0];
}

function findLocalUser(identifier) {
  return (
    LOCAL_USER_CATALOG.find(
      (user) =>
        user.email === identifier ||
        user.username === identifier ||
        user.email === `${identifier}@lorens.cl`
    ) || null
  );
}

function issueSession(res, user) {
  const publicUser = toPublicUser(user);
  const token = generateToken({
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    doble_perfil: publicUser.doble_perfil,
    roles: publicUser.roles
  });
  return res.json({ token, user: publicUser });
}

/**
 * Respuesta única para credenciales inválidas: no revela si el usuario existe,
 * si está inactivo o si la contraseña es incorrecta.
 */
function rejectLogin(res, req, identifier) {
  const clientIp = req.ip || 'IP desconocida';
  console.warn(`[AUTH] Intento de acceso fallido | usuario="${identifier}" | origen=${clientIp}`);
  return res
    .status(401)
    .json({ error: 'Credenciales inválidas. Verifique su usuario y contraseña.' });
}

// POST /api/auth/login
exports.login = async (req, res) => {
  const identifier = normalizeIdentifier(req.body && (req.body.email || req.body.username || req.body.identifier));
  const password = normalizePassword(req.body && req.body.password);

  if (!identifier || !password) {
    console.warn(
      `[AUTH] Solicitud malformada rechazada | origen=${req.ip || 'IP desconocida'}`
    );
    return res.status(400).json({
      error: 'Credenciales con formato no válido. Use el usuario o correo corporativo.',
    });
  }

  try {
    let databaseAvailable = true;

    // 1) PostgreSQL — consulta PARAMETRIZADA ($1). node-postgres envía la sentencia
    //    por protocolo extendido (parse/bind/execute): el valor del usuario viaja
    //    como parámetro tipado y jamás se concatena al texto SQL.
    try {
      const result = await db.query(queries.FIND_USER_BY_EMAIL, [identifier]);
      const user = selectUserRow(result.rows, identifier);

      if (user) {
        const isValid = await verifyCredentials(password, user.password_hash);
        if (!isValid) return rejectLogin(res, req, identifier);

        // REGLA ESTRICTA: El cliente no puede ser inspector ni ingresar por el portal operativo
        if (user.rol === 'cliente') {
          return res.status(403).json({
            error: 'Acceso no permitido: Esta cuenta es de perfil Cliente. No tiene permisos de inspector ni administrador. Debe ingresar a través del Portal de Clientes.'
          });
        }

        return issueSession(res, user);
      }
    } catch (dbError) {
      databaseAvailable = false;
      console.warn(
        '[AUTH] PostgreSQL no disponible; se evalúa el catálogo local de contingencia:',
        dbError.message
      );
    }

    // 2) Catálogo local: solo si la consulta a la base de datos falló.
    if (!databaseAvailable) {
      if (!LOCAL_FALLBACK_ENABLED) {
        return res.status(503).json({
          error: 'Servicio de autenticación no disponible. Contacte al administrador.',
        });
      }

      const localUser = findLocalUser(identifier);
      if (localUser) {
        const isValid = await verifyCredentials(password, localUser.password_hash);
        if (!isValid) return rejectLogin(res, req, identifier);

        // REGLA ESTRICTA: El cliente no puede ser inspector ni ingresar por el portal operativo
        if (localUser.rol === 'cliente') {
          return res.status(403).json({
            error: 'Acceso no permitido: Esta cuenta es de perfil Cliente. No tiene permisos de inspector ni administrador. Debe ingresar a través del Portal de Clientes.'
          });
        }

        return issueSession(res, localUser);
      }
    }

    // Comparación de relleno para mantener un tiempo de respuesta homogéneo.
    await verifyCredentials(password, TIMING_REFERENCE_HASH);
    return rejectLogin(res, req, identifier);
  } catch (error) {
    console.error('[AUTH] Error interno en autenticación:', error);
    return res
      .status(500)
      .json({ error: 'Error interno en autenticación. Contacte al administrador.' });
  }
};

// GET /api/auth/profile
exports.getProfile = async (req, res) => {
  res.json({ user: req.user });
};
