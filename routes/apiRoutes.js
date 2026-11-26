const express = require('express');
const router = express.Router();
const db = require('../config/database');
const queries = require('../models/dbQueries');
const authenticate = require('../middleware/authenticate');

// Mock data de catálogos y unidades
const mockLiquidadores = [
  { id: 'b0000000-0000-0000-0000-000000000001', nombre: 'SEGURED / COOPER', rut: '76.123.456-7', email_contacto: 'siniestros@segured.cl' },
  { id: 'b0000000-0000-0000-0000-000000000002', nombre: 'JUAN PABLO VALDIVIESO', rut: '76.987.654-3', email_contacto: 'contacto@jpv.cl' },
  { id: 'b0000000-0000-0000-0000-000000000003', nombre: 'CHARLES TAYLOR', rut: '76.333.222-1', email_contacto: 'contacto@charlestaylor.cl' },
  { id: 'b0000000-0000-0000-0000-000000000004', nombre: 'MAC LARENS', rut: '76.444.555-8', email_contacto: 'siniestros@maclarens.cl' },
  { id: 'b0000000-0000-0000-0000-000000000005', nombre: 'VIOLLIER', rut: '76.888.999-0', email_contacto: 'contacto@viollier.cl' },
  { id: 'b0000000-0000-0000-0000-000000000006', nombre: 'MARCHARD', rut: '76.777.666-4', email_contacto: 'operaciones@marchard.cl' }
];

const mockProcesos = [
  { id: 'p1', codigo: 'PRO-PREP', nombre: 'Preparación de superficie', categoria: 'Pintura', unidad: 'm²', precio_unitario: 1000.00 },
  { id: 'p2', codigo: 'PRO-EMP', nombre: 'Provi. y aplicación de empaste', categoria: 'Pintura', unidad: 'ml', precio_unitario: 1000.00 },
  { id: 'p3', codigo: 'PRO-FIS', nombre: 'Reparación de Fisura', categoria: 'Estructuras', unidad: 'ml', precio_unitario: 1000.00 },
  { id: 'p4', codigo: 'PRO-PINT', nombre: 'Provi. y aplicación de pintura dos manos', categoria: 'Pintura', unidad: 'm²', precio_unitario: 1000.00 },
  { id: 'p5', codigo: 'PRO-MART', nombre: 'Provi. y aplicación de martelina', categoria: 'Terminaciones', unidad: 'ml', precio_unitario: 1000.00 }
];

// GET /api/liquidadores
router.get('/liquidadores', authenticate, async (req, res) => {
  try {
    const result = await db.query(queries.LIST_LIQUIDADORES);
    if (result.rows.length > 0) return res.json(result.rows);
  } catch (err) {
    // fallback
  }
  res.json(mockLiquidadores);
});

// GET /api/procesos
router.get('/procesos', authenticate, (req, res) => {
  res.json(mockProcesos);
});

// GET /api/health
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ASESORÍAS LORENS',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// GET /api/users - Administración de usuarios para Webmaster / Admin
router.get('/users', authenticate, async (req, res) => {
  try {
    try {
      const result = await db.query(queries.LIST_USERS);
      if (result.rows.length > 0) return res.json(result.rows);
    } catch (err) {
      // fallback
    }
    const mockUsers = [
      {
        id: 'a0000000-0000-0000-0000-000000000000',
        nombre: 'Webmaster Lorens (Admin General)',
        email: 'webmaster@lorens.cl',
        rol: 'admin',
        doble_perfil: true,
        roles: ['admin', 'inspector'],
        activo: true,
        created_at: '2026-01-01T08:00:00Z'
      },
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        nombre: 'Pedro Pérez (Inspector)',
        email: 'inspector@lorens.cl',
        rol: 'inspector',
        doble_perfil: false,
        roles: ['inspector'],
        activo: true,
        created_at: '2026-02-15T09:30:00Z'
      },
      {
        id: 'a0000000-0000-0000-0000-000000000002',
        nombre: 'Alejandro Vargas (Admin)',
        email: 'admin@lorens.cl',
        rol: 'admin',
        doble_perfil: false,
        roles: ['admin'],
        activo: true,
        created_at: '2026-01-10T11:15:00Z'
      }
    ];
    res.json(mockUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/system/status - Diagnóstico y salud de servicios para Webmaster
router.get('/system/status', authenticate, async (req, res) => {
  let dbConnected = false;
  let dbLatency = null;
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    dbConnected = true;
    dbLatency = Date.now() - start;
  } catch {
    dbConnected = false;
  }

  res.json({
    status: 'online',
    app: 'ASESORÍAS LORENS',
    environment: process.env.NODE_ENV || 'production',
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      engine: 'PostgreSQL',
      connected: dbConnected,
      latencyMs: dbLatency,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      databaseName: process.env.DB_NAME || 'lorens_db',
      mode: dbConnected ? 'Producción PostgreSQL' : 'Contingencia Local Activa'
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  });
});

// GET /api/system/audit - Registro de auditoría y trazabilidad
router.get('/system/audit', authenticate, async (req, res) => {
  try {
    try {
      const result = await db.query(queries.LIST_AUDIT_LOGS);
      if (result.rows.length > 0) return res.json(result.rows);
    } catch {
      // fallback
    }
    const mockAudit = [
      { id: '1', accion: 'AUTH_LOGIN', detalles: { user: 'webmaster@lorens.cl', ip: '127.0.0.1' }, fecha: new Date(Date.now() - 3600000).toISOString(), usuario_nombre: 'Webmaster Lorens' },
      { id: '2', accion: 'CASE_STATUS_CHANGE', detalles: { case: 'SIS-2026-084', new_status: 'activo' }, fecha: new Date(Date.now() - 7200000).toISOString(), usuario_nombre: 'Alejandro Vargas' },
      { id: '3', accion: 'SNAPSHOT_ISSUED', detalles: { case: 'SIS-2026-084', sha256: '7f83b165...069' }, fecha: new Date(Date.now() - 86400000).toISOString(), usuario_nombre: 'Alejandro Vargas' },
      { id: '4', accion: 'PHOTO_UPLOAD', detalles: { case: 'SIS-2026-084', sector: 'BAÑO 1' }, fecha: new Date(Date.now() - 172800000).toISOString(), usuario_nombre: 'Pedro Pérez' }
    ];
    res.json(mockAudit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

