const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const FALLBACK_SECRET = 'lorens_super_secure_jwt_secret_key_2026!';

// En producción el secreto es obligatorio: un valor por defecto permitiría
// falsificar tokens de sesión conociendo el repositorio.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    '[AUTH] JWT_SECRET no está definido. Configure la variable de entorno antes de iniciar en producción.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET || FALLBACK_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_ALGORITHM = 'HS256';

if (JWT_SECRET === FALLBACK_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('[AUTH] Usando JWT_SECRET de desarrollo. Defina uno propio para producción.');
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: JWT_ALGORITHM,
  });
}

function verifyToken(token) {
  // Algoritmo fijado explícitamente: evita el ataque de confusión de algoritmos.
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  JWT_SECRET,
};

