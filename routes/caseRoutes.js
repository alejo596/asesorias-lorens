const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const lineController = require('../controllers/lineController');
const photoController = require('../controllers/photoController');
const sectorController = require('../controllers/sectorController');
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Todo el recurso de expedientes exige sesión JWT válida (RBAC de servidor).
// REGLA ESTRICTA: Exclusivo para personal operativo (inspector, admin, supervisor)
router.use(authenticate);
router.use(authorize(['admin', 'supervisor', 'inspector', 'liquidador_viewer']));

// 1. Rutas de Expedientes
router.get('/assigned/kpis', caseController.getInspectorKpis);
router.get('/assigned', caseController.getAssignedCases);
router.get('/meta/estados', caseController.getEstadosExpediente);
router.get('/', caseController.getAllCases);
router.post('/', caseController.createCase);
router.get('/:id', caseController.getCaseDetails);

// Modificaciones de expediente
router.put('/:id/observations', caseController.updateObservations);
router.put('/:id/finalize', caseController.finalizeInspection);
router.put('/:id/liquidador', authorize(['admin', 'supervisor']), caseController.updateLiquidador);
router.put('/:id/estado', authorize(['admin', 'supervisor']), caseController.updateEstado);

// 2. Sectores del Expediente
router.get('/:caseId/sectors', sectorController.getSectorsByCase);
router.post('/:caseId/sectors', sectorController.createSector);
router.delete('/:caseId/sectors/:sectorId', sectorController.deleteSector);

// 3. Partidas de Daño (Cubicación Geométrica)
router.post('/:caseId/lines', lineController.createLine);
router.delete('/lines/:id', lineController.deleteLine);

// 4. Evidencias Fotográficas Reales (Almacenamiento Físico + Metadatos PostgreSQL)
router.post('/:caseId/photos/upload', photoController.uploadPhoto);
router.post('/:caseId/photos', photoController.uploadPhoto);
router.get('/:caseId/photos', photoController.getPhotos);
router.get('/:caseId/photos/:photoId/file', photoController.streamPhotoFile);
router.get('/:caseId/photos/:photoId/timeline', photoController.getPhotoTimeline);
router.post('/:caseId/photos/:photoId/timeline', photoController.addPhotoTimelineEvent);
router.delete('/:caseId/photos/:photoId', photoController.deletePhoto);

// 5. Snapshots inmutables de informe
router.post('/:caseId/snapshots', reportController.createSnapshot);
router.get('/:caseId/snapshots', reportController.getSnapshots);

module.exports = router;
