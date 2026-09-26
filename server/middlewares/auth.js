const jwt = require('jsonwebtoken');
const { jwtSecret, jwtDuracion } = require('../config');

function firmarToken(usuario) {
  return jwt.sign({ id: usuario.UsuarioID }, jwtSecret, { expiresIn: jwtDuracion, algorithm: 'HS256' });
}

/** Devuelve el id del usuario si el token es válido; null en cualquier otro caso. */
function verificarToken(token) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const { id } = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function leerToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// Rutas que exigen sesión: publicar, editar y ofertar.
function requerirAuth(req, res, next) {
  const id = verificarToken(leerToken(req));
  if (!id) {
    return res.status(401).json({ ok: false, error: 'NO_AUTENTICADO', mensaje: 'Debes iniciar sesión para realizar esta acción.' });
  }
  req.usuarioId = id;
  next();
}

// Rutas públicas que muestran información extra si hay sesión (p. ej. "vas ganando").
function authOpcional(req, res, next) {
  req.usuarioId = verificarToken(leerToken(req));
  next();
}

module.exports = { firmarToken, verificarToken, requerirAuth, authOpcional };
