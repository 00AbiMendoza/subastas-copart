const { Router } = require('express');
const { sql, getPool, T } = require('../db/conexion');

const router = Router();

// GET /api/fotos/:id — imagen guardada en la base de datos.
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).end();

  const pool = await getPool();
  const { recordset } = await pool.request().input('id', sql.Int, id)
    .query(`SELECT ContentType, Datos, Url FROM ${T.fotos} WHERE FotoID = @id`);
  const foto = recordset[0];
  if (!foto) return res.status(404).end();
  if (foto.Url) return res.redirect(foto.Url);

  // Una foto nunca cambia (al editar se crea una nueva con otro id), así que se puede cachear.
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type(foto.ContentType || 'image/jpeg').send(foto.Datos);
});

module.exports = router;
