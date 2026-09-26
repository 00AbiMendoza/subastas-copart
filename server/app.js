const path = require('path');
const fs = require('fs');
const express = require('express');
const { getPool } = require('./db/conexion');
const { cabeceras, limiteAuth, limitePujas, limiteGeneral } = require('./middlewares/seguridad');

const app = express();

app.set('trust proxy', 1); // detrás del proxy del hosting: IP real para los límites de solicitudes
app.disable('x-powered-by');
app.use(cabeceras);
app.use(express.json({ limit: '15mb' }));

// ---------- API ----------
app.use('/api', limiteGeneral);
app.use(['/api/auth/login', '/api/auth/registro'], limiteAuth);
app.post('/api/vehiculos/:id/pujas', limitePujas);

app.get('/api/health', async (req, res) => {
  try {
    await (await getPool()).request().query('SELECT 1');
    res.json({ ok: true, api: 'en línea', baseDeDatos: 'conectada', serverTime: Date.now() });
  } catch {
    res.status(503).json({ ok: false, api: 'en línea', baseDeDatos: 'sin conexión' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/catalogos', require('./routes/catalogos').router);
app.use('/api/vehiculos', require('./routes/vehiculos'));
app.use('/api/fotos', require('./routes/fotos'));

app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'NO_ENCONTRADO', mensaje: `No existe ${req.method} ${req.originalUrl}` });
});

// ---------- Frontend React (SPA) ----------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

// ---------- Errores ----------
// Nunca se envían detalles internos (stack, SQL) al cliente; solo se registran en el servidor.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es un JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'DEMASIADO_GRANDE', mensaje: 'Las fotografías son demasiado pesadas.' });
  }
  console.error(err);
  res.status(500).json({ ok: false, error: 'ERROR_SERVIDOR', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.' });
});

module.exports = app;
