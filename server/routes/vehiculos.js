const { Router } = require('express');
const { sql, getPool, T } = require('../db/conexion');
const { requerirAuth, authOpcional } = require('../middlewares/auth');
const { validarVehiculo, parsearFoto, MIN_FOTOS, MAX_FOTOS } = require('../utils/validacion');
const { catalogosValidos } = require('./catalogos');
const {
  ErrorPuja, estadoSubasta, estaCerrada, siguienteMinimo, miEstado,
  registrarPuja, emitirSubasta, emitirCambioPublicacion,
} = require('../services/subastas');

const router = Router();

const urlFoto = (id, url) => url || `/api/fotos/${id}`;

const COLUMNAS = `
  v.VehiculoID, v.PublicadorID, v.Anio, v.TipoArticulo, v.Marca, v.Modelo, v.Motor, v.Transmision,
  v.Combustible, v.Tren, v.Cilindros, v.Dano, v.Descripcion, v.MontoBase, v.MontoActual, v.GanadorID,
  v.TotalPujas, v.FechaInicio, v.FechaFin, v.EstadoCierre, v.FechaCreacion`;

/** Datos de un vehículo para el cliente. Nunca incluye PublicadorID ni GanadorID. */
function aJson(v, usuarioId) {
  const estado = estadoSubasta(v);
  return {
    id: v.VehiculoID,
    anio: v.Anio,
    tipoArticulo: v.TipoArticulo,
    marca: v.Marca,
    modelo: v.Modelo,
    motor: v.Motor,
    transmision: v.Transmision,
    combustible: v.Combustible,
    tren: v.Tren,
    cilindros: v.Cilindros,
    dano: v.Dano,
    descripcion: v.Descripcion,
    montoBase: Number(v.MontoBase),
    montoActual: v.MontoActual == null ? null : Number(v.MontoActual),
    totalPujas: v.TotalPujas,
    fechaInicio: v.FechaInicio,
    fechaFin: v.FechaFin,
    estado,
    siguienteMinimo: siguienteMinimo(v),
    portada: v.PortadaID || v.PortadaUrl ? urlFoto(v.PortadaID, v.PortadaUrl) : null,
    esMio: usuarioId != null && usuarioId === v.PublicadorID,
  };
}

// ---------- Inventario con filtros ----------

const FILTROS_EXACTOS = {
  tipo: ['TipoArticulo', sql.NVarChar(40)],
  marca: ['Marca', sql.NVarChar(60)],
  transmision: ['Transmision', sql.NVarChar(30)],
  combustible: ['Combustible', sql.NVarChar(30)],
  tren: ['Tren', sql.VarChar(3)],
  dano: ['Dano', sql.VarChar(8)],
  anio: ['Anio', sql.Int],
  cilindros: ['Cilindros', sql.Int],
};

const ORDENES = {
  cierre: `CASE WHEN v.EstadoCierre IS NULL AND v.FechaFin > SYSUTCDATETIME() THEN 0 ELSE 1 END, v.FechaFin`,
  recientes: 'v.FechaCreacion DESC',
  precio_asc: 'COALESCE(v.MontoActual, v.MontoBase) ASC',
  precio_desc: 'COALESCE(v.MontoActual, v.MontoBase) DESC',
  anio_desc: 'v.Anio DESC',
};

const ESTADOS_SQL = {
  ACTIVA: 'v.EstadoCierre IS NULL AND v.FechaInicio <= SYSUTCDATETIME() AND v.FechaFin > SYSUTCDATETIME()',
  PROXIMA: 'v.EstadoCierre IS NULL AND v.FechaInicio > SYSUTCDATETIME()',
  CERRADA: '(v.EstadoCierre IS NOT NULL OR v.FechaFin <= SYSUTCDATETIME())',
};

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

async function listar(req, { soloMios = false } = {}) {
  const pool = await getPool();
  const request = pool.request();
  const where = [];
  const q = req.query;

  for (const [param, [columna, tipo]] of Object.entries(FILTROS_EXACTOS)) {
    const valor = texto(q[param]);
    if (!valor) continue;
    if (tipo === sql.Int && !Number.isInteger(Number(valor))) continue;
    request.input(param, tipo, tipo === sql.Int ? Number(valor) : valor);
    where.push(`v.${columna} = @${param}`);
  }
  if (texto(q.modelo)) {
    request.input('modelo', sql.NVarChar(82), `%${texto(q.modelo)}%`);
    where.push('v.Modelo LIKE @modelo');
  }
  if (texto(q.q)) {
    request.input('q', sql.NVarChar(102), `%${texto(q.q)}%`);
    where.push(`(v.Marca LIKE @q OR v.Modelo LIKE @q OR v.Motor LIKE @q OR v.TipoArticulo LIKE @q
                 OR CAST(v.Anio AS NVARCHAR(10)) LIKE @q OR CAST(v.VehiculoID AS NVARCHAR(10)) = @qExacto)`);
    request.input('qExacto', sql.NVarChar(100), texto(q.q).replace(/^#/, ''));
  }
  for (const [param, op] of [['anioMin', '>='], ['anioMax', '<=']]) {
    if (Number.isInteger(Number(q[param])) && texto(q[param])) {
      request.input(param, sql.Int, Number(q[param]));
      where.push(`v.Anio ${op} @${param}`);
    }
  }
  if (Number(q.precioMax) > 0) {
    request.input('precioMax', sql.Decimal(12, 2), Number(q.precioMax));
    where.push('COALESCE(v.MontoActual, v.MontoBase) <= @precioMax');
  }
  if (ESTADOS_SQL[q.estado]) where.push(ESTADOS_SQL[q.estado]);
  if (soloMios) {
    request.input('uid', sql.Int, req.usuarioId);
    where.push('v.PublicadorID = @uid');
  }

  const { recordset } = await request.query(`
    SELECT ${COLUMNAS}, f.FotoID AS PortadaID, f.Url AS PortadaUrl
    FROM ${T.vehiculos} v
    OUTER APPLY (SELECT TOP 1 FotoID, Url FROM ${T.fotos} WHERE VehiculoID = v.VehiculoID ORDER BY Orden) f
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${ORDENES[q.orden] || ORDENES.cierre}`);
  return recordset.map((v) => aJson(v, req.usuarioId));
}

// GET /api/vehiculos — público (modo lectura para anónimos).
router.get('/', authOpcional, async (req, res) => {
  const vehiculos = await listar(req);
  res.json({ total: vehiculos.length, vehiculos, serverTime: Date.now() });
});

// GET /api/vehiculos/mios — publicaciones del usuario, con búsqueda (?q=).
router.get('/mios', requerirAuth, async (req, res) => {
  const vehiculos = await listar(req, { soloMios: true });
  res.json({ total: vehiculos.length, vehiculos, serverTime: Date.now() });
});

// ---------- Detalle ----------

// GET /api/vehiculos/:id — ficha técnica, fotos, estado de la subasta e historial anónimo.
router.get('/:id', authOpcional, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, mensaje: 'Id inválido.' });

  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT ${COLUMNAS} FROM ${T.vehiculos} v WHERE v.VehiculoID = @id;
    SELECT FotoID, Url FROM ${T.fotos} WHERE VehiculoID = @id ORDER BY Orden;
    SELECT TOP 30 Monto, Fecha, UsuarioID FROM ${T.pujas} WHERE VehiculoID = @id ORDER BY Monto DESC;
    SELECT DISTINCT UsuarioID FROM ${T.pujas} WHERE VehiculoID = @id;`);

  const v = r.recordsets[0][0];
  if (!v) return res.status(404).json({ ok: false, error: 'NO_ENCONTRADO', mensaje: 'El vehículo no existe.' });

  const datos = aJson(v, req.usuarioId);
  const postores = new Set(r.recordsets[3].map((x) => x.UsuarioID));
  res.json({
    ...datos,
    fotos: r.recordsets[1].map((f) => ({ id: f.FotoID, url: urlFoto(f.FotoID, f.Url) })),
    historial: r.recordsets[2].map((p) => ({
      monto: Number(p.Monto),
      fecha: p.Fecha,
      esMia: req.usuarioId != null && p.UsuarioID === req.usuarioId,
    })),
    miEstado: miEstado(req.usuarioId, v, postores, datos.estado),
    serverTime: Date.now(),
  });
});

// ---------- Publicar / editar ----------

async function insertarFotos(tx, vehiculoId, fotos, ordenInicial) {
  for (let i = 0; i < fotos.length; i++) {
    await new sql.Request(tx)
      .input('v', sql.Int, vehiculoId)
      .input('o', sql.Int, ordenInicial + i)
      .input('ct', sql.VarChar(40), fotos[i].contentType)
      .input('d', sql.VarBinary(sql.MAX), fotos[i].buffer)
      .query(`INSERT INTO ${T.fotos} (VehiculoID, Orden, ContentType, Datos) VALUES (@v, @o, @ct, @d)`);
  }
}

function parametrosVehiculo(request, d) {
  return request
    .input('anio', sql.Int, d.anio)
    .input('tipo', sql.NVarChar(40), d.tipoArticulo)
    .input('marca', sql.NVarChar(60), d.marca)
    .input('modelo', sql.NVarChar(80), d.modelo)
    .input('motor', sql.NVarChar(60), d.motor)
    .input('transmision', sql.NVarChar(30), d.transmision)
    .input('combustible', sql.NVarChar(30), d.combustible)
    .input('tren', sql.VarChar(3), d.tren)
    .input('cilindros', sql.Int, d.cilindros)
    .input('dano', sql.VarChar(8), d.dano)
    .input('descripcion', sql.NVarChar(1000), d.descripcion)
    .input('base', sql.Decimal(12, 2), d.montoBase)
    .input('inicio', sql.DateTime2, d.fechaInicio)
    .input('fin', sql.DateTime2, d.fechaFin);
}

const errorValidacion = (res, errores) =>
  res.status(400).json({ ok: false, error: 'ERROR_VALIDACION', mensaje: errores[0], errores });

// POST /api/vehiculos — publicar (requiere sesión).
router.post('/', requerirAuth, async (req, res) => {
  const { errores, datos } = validarVehiculo(req.body, await catalogosValidos());
  if (!errores.length && datos.fechaFin <= new Date()) errores.push('La fecha de cierre debe ser futura.');

  const entrada = Array.isArray(req.body.fotos) ? req.body.fotos : [];
  const fotos = entrada.map(parsearFoto);
  if (fotos.length < MIN_FOTOS) errores.push(`Debes subir al menos ${MIN_FOTOS} fotografías.`);
  if (fotos.length > MAX_FOTOS) errores.push(`Puedes subir como máximo ${MAX_FOTOS} fotografías.`);
  if (fotos.some((f) => !f)) errores.push('Alguna fotografía no es válida (JPG, PNG o WEBP de hasta 4 MB).');
  if (errores.length) return errorValidacion(res, errores);

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let id;
  try {
    const r = await parametrosVehiculo(new sql.Request(tx), datos)
      .input('uid', sql.Int, req.usuarioId)
      .query(`INSERT INTO ${T.vehiculos}
                (PublicadorID, Anio, TipoArticulo, Marca, Modelo, Motor, Transmision, Combustible, Tren, Cilindros,
                 Dano, Descripcion, MontoBase, FechaInicio, FechaFin)
              OUTPUT inserted.VehiculoID
              VALUES (@uid, @anio, @tipo, @marca, @modelo, @motor, @transmision, @combustible, @tren, @cilindros,
                      @dano, @descripcion, @base, @inicio, @fin)`);
    id = r.recordset[0].VehiculoID;
    await insertarFotos(tx, id, fotos, 1);
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }

  emitirCambioPublicacion(id);
  res.status(201).json({ ok: true, id, mensaje: 'Vehículo publicado correctamente.' });
});

const minuto = (fecha) => Math.floor(new Date(fecha).getTime() / 60000);

// PUT /api/vehiculos/:id — editar (solo el publicador).
router.put('/:id', requerirAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, mensaje: 'Id inválido.' });

  const { errores, datos } = validarVehiculo(req.body, await catalogosValidos());
  if (errores.length) return errorValidacion(res, errores);

  const conservar = (Array.isArray(req.body.fotosConservar) ? req.body.fotosConservar : []).map(Number).filter(Number.isInteger);
  const nuevas = (Array.isArray(req.body.fotosNuevas) ? req.body.fotosNuevas : []).map(parsearFoto);
  if (nuevas.some((f) => !f)) return errorValidacion(res, ['Alguna fotografía nueva no es válida (JPG, PNG o WEBP de hasta 4 MB).']);

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r = await new sql.Request(tx).input('id', sql.Int, id).query(`
      SELECT VehiculoID, PublicadorID, MontoBase, TotalPujas, FechaInicio, FechaFin, EstadoCierre
      FROM ${T.vehiculos} WITH (UPDLOCK, HOLDLOCK) WHERE VehiculoID = @id;
      SELECT FotoID FROM ${T.fotos} WHERE VehiculoID = @id;`);
    const v = r.recordsets[0][0];

    const rechazar = async (status, error, mensaje) => {
      await tx.rollback().catch(() => {});
      return res.status(status).json({ ok: false, error, mensaje });
    };

    if (!v) return rechazar(404, 'NO_ENCONTRADO', 'El vehículo no existe.');
    if (v.PublicadorID !== req.usuarioId) return rechazar(403, 'NO_PERMITIDO', 'Solo el publicador puede editar este vehículo.');
    if (estaCerrada(estadoSubasta(v))) return rechazar(409, 'SUBASTA_CERRADA', 'La subasta ya cerró; no se puede editar.');
    if (datos.fechaFin <= new Date()) return rechazar(400, 'ERROR_VALIDACION', 'La fecha de cierre debe ser futura.');
    if (v.TotalPujas > 0) {
      if (Number(v.MontoBase) !== datos.montoBase || minuto(v.FechaInicio) !== minuto(datos.fechaInicio)) {
        return rechazar(409, 'TIENE_OFERTAS', 'La subasta ya tiene ofertas: no se puede cambiar el monto base ni la fecha de inicio.');
      }
      if (minuto(datos.fechaFin) < minuto(v.FechaFin)) {
        return rechazar(409, 'TIENE_OFERTAS', 'La subasta ya tiene ofertas: solo puedes extender la fecha de cierre.');
      }
    }

    const actuales = new Set(r.recordsets[1].map((f) => f.FotoID));
    const conservadas = conservar.filter((fid) => actuales.has(fid));
    const total = conservadas.length + nuevas.length;
    if (total < MIN_FOTOS) return rechazar(400, 'ERROR_VALIDACION', `El vehículo debe tener al menos ${MIN_FOTOS} fotografías.`);
    if (total > MAX_FOTOS) return rechazar(400, 'ERROR_VALIDACION', `El vehículo puede tener como máximo ${MAX_FOTOS} fotografías.`);

    await parametrosVehiculo(new sql.Request(tx), datos).input('id', sql.Int, id).query(`
      UPDATE ${T.vehiculos} SET Anio = @anio, TipoArticulo = @tipo, Marca = @marca, Modelo = @modelo, Motor = @motor,
        Transmision = @transmision, Combustible = @combustible, Tren = @tren, Cilindros = @cilindros, Dano = @dano,
        Descripcion = @descripcion, MontoBase = @base, FechaInicio = @inicio, FechaFin = @fin,
        FechaModificacion = SYSUTCDATETIME()
      WHERE VehiculoID = @id`);

    for (const fid of actuales) {
      if (!conservadas.includes(fid)) {
        await new sql.Request(tx).input('f', sql.Int, fid).query(`DELETE FROM ${T.fotos} WHERE FotoID = @f`);
      }
    }
    for (let i = 0; i < conservadas.length; i++) {
      await new sql.Request(tx).input('f', sql.Int, conservadas[i]).input('o', sql.Int, i + 1)
        .query(`UPDATE ${T.fotos} SET Orden = @o WHERE FotoID = @f`);
    }
    await insertarFotos(tx, id, nuevas, conservadas.length + 1);
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }

  if (res.headersSent) return;
  emitirCambioPublicacion(id);
  await emitirSubasta(id);
  res.json({ ok: true, id, mensaje: 'Publicación actualizada correctamente.' });
});

// ---------- Pujas ----------

// POST /api/vehiculos/:id/pujas — ofertar (requiere sesión). Todas las reglas se validan aquí.
router.post('/:id/pujas', requerirAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, mensaje: 'Id inválido.' });
  try {
    const resultado = await registrarPuja(id, req.usuarioId, req.body?.monto);
    res.status(201).json({ ok: true, mensaje: '¡Oferta registrada! Vas ganando esta subasta.', ...resultado });
  } catch (err) {
    if (err instanceof ErrorPuja) {
      return res.status(err.status).json({ ok: false, error: err.codigo, mensaje: err.message, ...err.extra });
    }
    throw err;
  }
});

module.exports = router;
