const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { sql, getPool, T } = require('../db/conexion');
const { firmarToken, requerirAuth } = require('../middlewares/auth');
const { validarRegistro } = require('../utils/validacion');

const router = Router();

// Hash de relleno: si el correo no existe igual se ejecuta bcrypt.compare, así el
// tiempo de respuesta no revela qué correos están registrados.
const HASH_RELLENO = bcrypt.hashSync('usuario-inexistente', 10);

const publico = (u) => ({ id: u.UsuarioID, nombre: u.Nombre, apellido: u.Apellido, correo: u.Correo, telefono: u.Telefono });

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  const { errores, datos } = validarRegistro(req.body);
  if (errores.length) return res.status(400).json({ ok: false, error: 'ERROR_VALIDACION', mensaje: errores[0], errores });

  const pool = await getPool();
  const existe = await pool.request().input('correo', sql.NVarChar(150), datos.correo)
    .query(`SELECT 1 FROM ${T.usuarios} WHERE Correo = @correo`);
  if (existe.recordset.length) {
    return res.status(409).json({ ok: false, error: 'CORREO_REGISTRADO', mensaje: 'Ya existe una cuenta con ese correo.' });
  }

  const hash = await bcrypt.hash(datos.password, 10);
  const { recordset } = await pool.request()
    .input('nombre', sql.NVarChar(80), datos.nombre)
    .input('apellido', sql.NVarChar(80), datos.apellido)
    .input('correo', sql.NVarChar(150), datos.correo)
    .input('telefono', sql.VarChar(20), datos.telefono)
    .input('hash', sql.VarChar(100), hash)
    .query(`INSERT INTO ${T.usuarios} (Nombre, Apellido, Correo, Telefono, PasswordHash)
            OUTPUT inserted.UsuarioID, inserted.Nombre, inserted.Apellido, inserted.Correo, inserted.Telefono
            VALUES (@nombre, @apellido, @correo, @telefono, @hash)`);

  const usuario = recordset[0];
  res.status(201).json({ ok: true, token: firmarToken(usuario), usuario: publico(usuario) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!correo || !password) {
    return res.status(400).json({ ok: false, error: 'ERROR_VALIDACION', mensaje: 'Ingresa tu correo y contraseña.' });
  }

  const pool = await getPool();
  const { recordset } = await pool.request().input('correo', sql.NVarChar(150), correo)
    .query(`SELECT UsuarioID, Nombre, Apellido, Correo, Telefono, PasswordHash FROM ${T.usuarios} WHERE Correo = @correo`);
  const usuario = recordset[0];

  const valida = await bcrypt.compare(password.slice(0, 72), usuario ? usuario.PasswordHash : HASH_RELLENO);
  if (!usuario || !valida) {
    return res.status(401).json({ ok: false, error: 'CREDENCIALES', mensaje: 'Correo o contraseña incorrectos.' });
  }
  res.json({ ok: true, token: firmarToken(usuario), usuario: publico(usuario) });
});

// GET /api/auth/yo — valida el token guardado en el navegador.
router.get('/yo', requerirAuth, async (req, res) => {
  const pool = await getPool();
  const { recordset } = await pool.request().input('id', sql.Int, req.usuarioId)
    .query(`SELECT UsuarioID, Nombre, Apellido, Correo, Telefono FROM ${T.usuarios} WHERE UsuarioID = @id`);
  if (!recordset.length) return res.status(401).json({ ok: false, error: 'NO_AUTENTICADO', mensaje: 'La sesión ya no es válida.' });
  res.json({ ok: true, usuario: publico(recordset[0]) });
});

module.exports = router;
