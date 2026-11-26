const { verifyToken } = require('../config/auth');

function authenticate(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    // No se expone el detalle técnico del fallo de firma al cliente.
    return res.status(403).json({ error: 'Token inválido o expirado. Inicie sesión nuevamente.' });
  }
}

module.exports = authenticate;
