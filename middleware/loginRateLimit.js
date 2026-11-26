/**
 * Limitador de intentos de autenticación (en memoria, sin dependencias externas).
 *
 * Mitiga ataques de fuerza bruta y "password spraying" sobre POST /api/auth/login
 * combinando la dirección de origen con el identificador solicitado.
 *
 * Variables de entorno opcionales:
 *   LOGIN_MAX_ATTEMPTS  (por defecto 10)
 *   LOGIN_WINDOW_MS     (por defecto 15 minutos)
 *   LOGIN_BLOCK_MS      (por defecto 15 minutos)
 */
const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS, 10) || 10;
const WINDOW_MS = parseInt(process.env.LOGIN_WINDOW_MS, 10) || 15 * 60 * 1000;
const BLOCK_MS = parseInt(process.env.LOGIN_BLOCK_MS, 10) || 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;

const attempts = new Map();

function buildKey(req) {
  const identifier =
    req.body && typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase().slice(0, 150)
      : '';
  return `${req.ip || 'unknown'}::${identifier}`;
}

function pruneExpired(now) {
  if (attempts.size < MAX_TRACKED_KEYS) return;
  for (const [key, record] of attempts) {
    const windowExpired = record.resetAt <= now;
    const blockExpired = !record.blockedUntil || record.blockedUntil <= now;
    if (windowExpired && blockExpired) attempts.delete(key);
  }
}

function loginRateLimit(req, res, next) {
  const now = Date.now();
  const key = buildKey(req);
  const stored = attempts.get(key);

  if (stored && stored.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((stored.blockedUntil - now) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Reintente en ${Math.max(
        1,
        Math.ceil(retryAfterSeconds / 60)
      )} minuto(s).`,
    });
  }

  const record =
    !stored || stored.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS, blockedUntil: 0 }
      : stored;

  record.count += 1;
  attempts.set(key, record);
  pruneExpired(now);

  res.on('finish', () => {
    if (res.statusCode === 200) {
      attempts.delete(key);
      return;
    }
    if (res.statusCode === 400 || res.statusCode === 401) {
      if (record.count >= MAX_ATTEMPTS) {
        record.blockedUntil = Date.now() + BLOCK_MS;
        console.warn(
          `[AUTH] Bloqueo temporal aplicado tras ${record.count} intentos fallidos | clave=${key}`
        );
      }
    }
  });

  return next();
}

module.exports = loginRateLimit;
