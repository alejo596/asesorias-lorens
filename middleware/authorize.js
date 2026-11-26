/**
 * Middleware para autorización RBAC según especificación:
 * Roles: 'admin', 'supervisor', 'inspector', 'liquidador_viewer'
 */
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso denegado: El rol '${req.user.rol}' no tiene permisos para esta operación.`,
      });
    }

    next();
  };
}

module.exports = authorize;

