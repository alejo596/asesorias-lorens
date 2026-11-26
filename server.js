const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const apiRoutes = require('./routes/apiRoutes');
const clientRoutes = require('./routes/clientRoutes');
const adjusterRoutes = require('./routes/adjusterRoutes');

const app = express();

// Detrás de proxy inverso se requiere la IP real para el limitador de login.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Cabeceras de seguridad base (sin dependencias externas)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()');
  next();
});

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Servir únicamente el frontend estático de /public.
// No se expone la raíz del proyecto para evitar la descarga de .env, schema.sql, etc.
app.use(
  express.static(path.join(__dirname, 'public'), {
    dotfiles: 'ignore',
    index: 'index.html',
  })
);

// Endpoints API
app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/adjuster', adjusterRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api', apiRoutes);

// Cualquier endpoint API desconocido responde JSON (nunca la SPA).
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Recurso no encontrado: ${req.method} ${req.originalUrl}` });
});

// Ruta principal SPA: la navegación del cliente siempre recibe la aplicación,
// salvo que se trate de un archivo inexistente con extensión propia.
const PUBLIC_INDEX = path.join(__dirname, 'public', 'index.html');

app.get('*', (req, res, next) => {
  const requested = req.path;
  // Archivos inexistentes (con extensión o nombres ocultos como .env) nunca
  // reciben la SPA: se deja que Express responda 404.
  if (path.extname(requested) || path.basename(requested).startsWith('.')) {
    return next();
  }
  return res.sendFile(PUBLIC_INDEX, (error) => {
    if (error) next(error);
  });
});

// Manejo centralizado de errores (mensajes genéricos, sin filtrar stack)
app.use((err, req, res, next) => {
  console.error('[SERVER] Error no controlado:', err.message);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status >= 500 ? 'Error interno del servidor.' : err.message,
  });
});

// Control de excepciones no capturadas para estabilidad del servicio
process.on('uncaughtException', (err) => {
  console.error('[SERVER CRITICAL] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER CRITICAL] Unhandled rejection:', reason);
});

// Inicialización de servidor
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  SISTEMA ASESORÍAS LORENS OPERATIVO`);
    console.log(`  Inspección, Cuantificación y Liquidación de Siniestros`);
    console.log(`  Servidor escuchando en: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });

  // Mantener vivo el event loop
  setInterval(() => {}, 1000 * 60 * 60);
}

module.exports = app;

