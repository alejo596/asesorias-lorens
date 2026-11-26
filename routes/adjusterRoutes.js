const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const adjusterController = require('../controllers/adjusterController');

// Middleware para verificar que el usuario sea Ajustador o Administrador (Inspector NO tiene acceso financiero)
function requireAdjusterOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Acceso no autorizado: Sesión requerida.' });
  }

  const allowedRoles = ['ajustador', 'admin', 'supervisor', 'webmaster'];
  const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.rol];
  const hasAccess = allowedRoles.includes(req.user.rol) || userRoles.some(r => allowedRoles.includes(r));

  if (!hasAccess) {
    return res.status(403).json({ 
      error: 'Acceso denegado: El perfil Inspector no tiene autorización para acceder a módulos o endpoints financieros de cuantificación y presupuesto.' 
    });
  }

  next();
}

// Aplicar autenticación y RBAC a todas las rutas del Ajustador
router.use(authenticate);
router.use(requireAdjusterOrAdmin);

// Dashboard y listado de casos
router.get('/dashboard', adjusterController.getDashboard);
router.get('/cases', adjusterController.getCases);
router.get('/cases/:id', adjusterController.getCaseDetails);

// Catálogo de procesos constructivos
router.get('/catalog/processes', adjusterController.getCatalogProcesses);

// Gestión de partidas del presupuesto
router.post('/cases/:id/items', adjusterController.addBudgetItem);
router.put('/items/:id', adjusterController.updateBudgetItem);
router.delete('/items/:id', adjusterController.deleteBudgetItem);

// Flujo de estados del presupuesto
router.post('/cases/:id/save-draft', adjusterController.saveDraft);
router.post('/cases/:id/submit-review', adjusterController.submitReview);
router.post('/cases/:id/approve', adjusterController.approveBudget);
router.post('/cases/:id/observe', adjusterController.observeBudget);

// Exportación a Excel (.xlsx) y PDF
router.get('/cases/:id/export/excel', adjusterController.exportExcel);
router.get('/cases/:id/export/pdf', adjusterController.exportPdf);

module.exports = router;
