const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const FALLBACK_SECRET = 'lorens_super_secure_jwt_secret_key_2026!';

if (!process.env.JWT_SECRET) {
  console.warn('[AUTH] Advertencia: JWT_SECRET no está definido en las variables de entorno. Usando clave segura predeterminada.');
}

const JWT_SECRET = process.env.JWT_SECRET || FALLBACK_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_ALGORITHM = 'HS256';

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

