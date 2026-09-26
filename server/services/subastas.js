const { sql, getPool, T } = require('../db/conexion');
const { verificarToken } = require('../middlewares/auth');

let io = null;
const sala = (vehiculoId) => `vehiculo:${vehiculoId}`;

class ErrorPuja extends Error {
  constructor(status, codigo, mensaje, extra = {}) {
    super(mensaje);
    Object.assign(this, { status, codigo, extra });
  }
}

/** PROXIMA | ACTIVA | VENDIDA | DESIERTA, calculado con la hora del servidor. */
function estadoSubasta(v, ahora = new Date()) {
  if (v.EstadoCierre) return v.EstadoCierre;
  if (ahora < v.FechaInicio) return 'PROXIMA';
  if (ahora < v.FechaFin) return 'ACTIVA';
  return v.TotalPujas > 0 ? 'VENDIDA' : 'DESIERTA';
}

const estaCerrada = (estado) => estado === 'VENDIDA' || estado === 'DESIERTA';

/**
 * Oferta mínima aceptada, en centavos para evitar errores de punto flotante:
 * sin pujas = monto base; con pujas = oferta actual + 10 %.
 */
function minimoCentavos(v) {
  if (v.MontoActual == null) return Math.round(Number(v.MontoBase) * 100);
  return Math.ceil((Math.round(Number(v.MontoActual) * 100) * 11) / 10);
}

const siguienteMinimo = (v) => minimoCentavos(v) / 100;

/** Estado de la puja visto por un usuario concreto. Nunca revela quién es el postor. */
function miEstado(usuarioId, v, postores, estado) {
  if (!usuarioId) return null;
  if (usuarioId === v.PublicadorID) return 'PROPIETARIO';
  const cerrada = estaCerrada(estado);
  if (v.GanadorID === usuarioId) return cerrada ? 'GANASTE' : 'GANANDO';
  if (postores.has(usuarioId)) return cerrada ? 'PERDISTE' : 'SUPERADO';
  return null;
}

function resumenPublico(v) {
  const estado = estadoSubasta(v);
  return {
    vehiculoId: v.VehiculoID,
    montoBase: Number(v.MontoBase),
    montoActual: v.MontoActual == null ? null : Number(v.MontoActual),
    totalPujas: v.TotalPujas,
    fechaInicio: v.FechaInicio,
    fechaFin: v.FechaFin,
    estado,
    siguienteMinimo: siguienteMinimo(v),
    serverTime: Date.now(),
  };
}

async function leerSubasta(conexion, vehiculoId) {
  const r = await new sql.Request(conexion).input('id', sql.Int, vehiculoId).query(`
    SELECT VehiculoID, PublicadorID, MontoBase, MontoActual, GanadorID, TotalPujas, FechaInicio, FechaFin, EstadoCierre
    FROM ${T.vehiculos} WHERE VehiculoID = @id;
    SELECT DISTINCT UsuarioID FROM ${T.pujas} WHERE VehiculoID = @id;`);
  const v = r.recordsets[0][0];
  if (!v) return null;
  v.postores = new Set(r.recordsets[1].map((x) => x.UsuarioID));
  return v;
}

/**
 * Envía el nuevo estado de una subasta:
 *  - a todos (inventario) solo datos públicos;
 *  - a cada navegador en la sala del vehículo, además su indicador personal.
 */
async function emitirSubasta(vehiculoId) {
  if (!io) return;
  const pool = await getPool();
  const v = await leerSubasta(pool, vehiculoId);
  if (!v) return;
  const pub = resumenPublico(v);
  io.emit('inventario:actualizado', pub);
  const sockets = await io.in(sala(vehiculoId)).fetchSockets();
  for (const s of sockets) {
    s.emit('subasta:actualizada', { ...pub, miEstado: miEstado(s.data.usuarioId, v, v.postores, pub.estado) });
  }
}

/** Avisa que cambió la publicación (edición) para que los clientes recarguen el detalle. */
function emitirCambioPublicacion(vehiculoId) {
  if (!io) return;
  io.emit('inventario:cambio', { vehiculoId });
  io.to(sala(vehiculoId)).emit('vehiculo:editado', { vehiculoId });
}

async function registrarPuja(vehiculoId, usuarioId, montoEntrada) {
  const monto = Number(montoEntrada);
  if (!Number.isFinite(monto) || monto <= 0 || monto > 99999999) {
    throw new ErrorPuja(400, 'MONTO_INVALIDO', 'Ingresa un monto válido.');
  }
  const centavos = Math.round(monto * 100);

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // UPDLOCK + HOLDLOCK: dos pujas simultáneas al mismo vehículo se procesan en orden,
    // así nunca se aceptan dos ofertas calculadas contra el mismo "monto actual".
    const { recordset } = await new sql.Request(tx).input('id', sql.Int, vehiculoId).query(`
      SELECT VehiculoID, PublicadorID, MontoBase, MontoActual, GanadorID, TotalPujas,
             FechaInicio, FechaFin, EstadoCierre, SYSUTCDATETIME() AS Ahora
      FROM ${T.vehiculos} WITH (UPDLOCK, HOLDLOCK) WHERE VehiculoID = @id`);
    const v = recordset[0];

    if (!v) throw new ErrorPuja(404, 'NO_ENCONTRADO', 'El vehículo no existe.');
    if (v.PublicadorID === usuarioId) throw new ErrorPuja(403, 'PROPIETARIO', 'No puedes ofertar en tu propia publicación.');
    if (v.EstadoCierre || v.Ahora >= v.FechaFin) throw new ErrorPuja(409, 'SUBASTA_CERRADA', 'Oferta cerrada: el tiempo de esta subasta terminó.');
    if (v.Ahora < v.FechaInicio) throw new ErrorPuja(409, 'SUBASTA_NO_INICIADA', 'La subasta aún no ha iniciado.');
    if (v.GanadorID === usuarioId) throw new ErrorPuja(409, 'YA_GANANDO', 'Ya tienes la oferta más alta en esta subasta.');

    const minimo = minimoCentavos(v);
    if (centavos < minimo) {
      const q = (c) => `Q ${(c / 100).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const mensaje = v.MontoActual == null
        ? `La oferta no puede ser menor al monto base de ${q(minimo)}.`
        : `Tu oferta debe superar en al menos 10 % la oferta actual (${q(Math.round(Number(v.MontoActual) * 100))}). Mínimo: ${q(minimo)}.`;
      throw new ErrorPuja(422, 'MONTO_INSUFICIENTE', mensaje, { siguienteMinimo: minimo / 100 });
    }

    await new sql.Request(tx)
      .input('id', sql.Int, vehiculoId)
      .input('uid', sql.Int, usuarioId)
      .input('monto', sql.Decimal(12, 2), centavos / 100)
      .query(`INSERT INTO ${T.pujas} (VehiculoID, UsuarioID, Monto) VALUES (@id, @uid, @monto);
              UPDATE ${T.vehiculos} SET MontoActual = @monto, GanadorID = @uid, TotalPujas = TotalPujas + 1
              WHERE VehiculoID = @id;`);
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }

  await emitirSubasta(vehiculoId);
  return {
    montoActual: centavos / 100,
    siguienteMinimo: Math.ceil((centavos * 11) / 10) / 100,
    miEstado: 'GANANDO',
  };
}

/** Marca como VENDIDA o DESIERTA las subastas cuya hora de cierre ya pasó. */
async function cerrarVencidas() {
  const pool = await getPool();
  const { recordset } = await pool.request().query(`
    UPDATE ${T.vehiculos}
    SET EstadoCierre = CASE WHEN TotalPujas > 0 AND MontoActual >= MontoBase THEN 'VENDIDA' ELSE 'DESIERTA' END
    OUTPUT inserted.VehiculoID
    WHERE EstadoCierre IS NULL AND FechaFin <= SYSUTCDATETIME()`);
  for (const { VehiculoID } of recordset) await emitirSubasta(VehiculoID);
}

function configurarTiempoReal(servidorIO) {
  io = servidorIO;

  io.use((socket, next) => {
    socket.data.usuarioId = verificarToken(socket.handshake.auth?.token);
    next();
  });

  io.on('connection', (socket) => {
    socket.emit('hora', Date.now());

    socket.on('subasta:unirse', async (id) => {
      const vehiculoId = Number(id);
      if (!Number.isInteger(vehiculoId)) return;
      socket.join(sala(vehiculoId));
      try {
        const pool = await getPool();
        const v = await leerSubasta(pool, vehiculoId);
        if (!v) return;
        const pub = resumenPublico(v);
        socket.emit('subasta:actualizada', { ...pub, miEstado: miEstado(socket.data.usuarioId, v, v.postores, pub.estado) });
      } catch (err) {
        console.error('subasta:unirse', err.message);
      }
    });

    socket.on('subasta:salir', (id) => socket.leave(sala(Number(id))));
  });

  setInterval(() => cerrarVencidas().catch((e) => console.error('cierre automático:', e.message)), 3000);
}

module.exports = {
  ErrorPuja,
  estadoSubasta,
  estaCerrada,
  siguienteMinimo,
  miEstado,
  registrarPuja,
  emitirSubasta,
  emitirCambioPublicacion,
  configurarTiempoReal,
};
