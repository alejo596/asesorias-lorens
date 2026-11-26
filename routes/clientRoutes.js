const express = require('express');
const router = express.Router();
const clientPortalController = require('../controllers/clientPortalController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// 1. Autenticación exclusiva del portal cliente (pública)
router.post('/auth/login', clientPortalController.clientLogin);

// 2. Rutas protegidas para rol cliente
router.use(authenticate);
router.use(authorize(['cliente']));

router.get('/me', clientPortalController.getProfile);
router.get('/cases', clientPortalController.getClientCases);
router.get('/cases/:caseId', clientPortalController.getClientCaseDetail);
router.get('/cases/:caseId/timeline', clientPortalController.getClientCaseTimeline);
router.get('/cases/:caseId/evidence', clientPortalController.getClientCaseEvidence);
router.get('/cases/:caseId/photos', clientPortalController.getClientCaseEvidence);
router.get('/cases/:caseId/photos/:photoId/file', clientPortalController.streamClientPhotoFile);

module.exports = router;

