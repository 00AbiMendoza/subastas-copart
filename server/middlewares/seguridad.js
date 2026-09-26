const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { produccion } = require('../config');

// Cabeceras HTTP de seguridad + Content-Security-Policy: el navegador solo
// ejecuta scripts servidos por este mismo sitio (mitiga XSS).
const cabeceras = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: produccion ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
});

const respuesta = (mensaje) => ({ ok: false, error: 'DEMASIADAS_SOLICITUDES', mensaje });
const base = { standardHeaders: 'draft-7', legacyHeaders: false };

// Freno a ataques de fuerza bruta: solo cuentan los intentos fallidos.
const limiteAuth = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: respuesta('Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.'),
});

const limitePujas = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 40,
  message: respuesta('Estás ofertando demasiado rápido. Espera un momento.'),
});

const limiteGeneral = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 600,
  message: respuesta('Demasiadas solicitudes. Intenta de nuevo en un minuto.'),
});

module.exports = { cabeceras, limiteAuth, limitePujas, limiteGeneral };
