// Carga vehículos de demostración (fotos de Wikimedia Commons, licencia libre).
// Es idempotente: si un vehículo demo ya existe, no lo duplica.
//
//   npm run seed

const { sql, getPool, T } = require('../server/db/conexion');
const { inicializarBD } = require('../server/db/esquema');
const demo = require('./vehiculos-demo.json');

const HORA = 3600 * 1000;

(async () => {
  await inicializarBD();
  const pool = await getPool();
  const usuarios = Object.fromEntries(
    (await pool.request().query(`SELECT UsuarioID, Correo FROM ${T.usuarios} WHERE Correo LIKE '%@subastas.test'`))
      .recordset.map((u) => [u.Correo.split('@')[0], u.UsuarioID])
  );

  for (const v of demo) {
    const existe = await pool.request().input('m', sql.NVarChar(80), v.modelo)
      .query(`SELECT 1 FROM ${T.vehiculos} WHERE Modelo = @m`);
    if (existe.recordset.length) {
      console.log(`= ${v.marca} ${v.modelo} ya existe`);
      continue;
    }

    const inicio = new Date(Date.now() + (v.inicioHoras || -1) * HORA);
    const fin = new Date(v.minutos ? Date.now() + v.minutos * 60000 : Date.now() + v.dias * 24 * HORA);

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx)
        .input('uid', sql.Int, usuarios[v.publicador])
        .input('anio', sql.Int, v.anio)
        .input('tipo', sql.NVarChar(40), v.tipoArticulo)
        .input('marca', sql.NVarChar(60), v.marca)
        .input('modelo', sql.NVarChar(80), v.modelo)
        .input('motor', sql.NVarChar(60), v.motor)
        .input('transmision', sql.NVarChar(30), v.transmision)
        .input('combustible', sql.NVarChar(30), v.combustible)
        .input('tren', sql.VarChar(3), v.tren)
        .input('cilindros', sql.Int, v.cilindros)
        .input('dano', sql.VarChar(8), v.dano)
        .input('descripcion', sql.NVarChar(1000), v.descripcion)
        .input('base', sql.Decimal(12, 2), v.montoBase)
        .input('inicio', sql.DateTime2, inicio)
        .input('fin', sql.DateTime2, fin)
        .query(`INSERT INTO ${T.vehiculos} (PublicadorID, Anio, TipoArticulo, Marca, Modelo, Motor, Transmision, Combustible,
                  Tren, Cilindros, Dano, Descripcion, MontoBase, FechaInicio, FechaFin)
                OUTPUT inserted.VehiculoID
                VALUES (@uid, @anio, @tipo, @marca, @modelo, @motor, @transmision, @combustible, @tren, @cilindros, @dano,
                        @descripcion, @base, @inicio, @fin)`);
      const id = r.recordset[0].VehiculoID;

      for (let i = 0; i < v.fotos.length; i++) {
        await new sql.Request(tx).input('v', sql.Int, id).input('o', sql.Int, i + 1).input('u', sql.NVarChar(1000), v.fotos[i])
          .query(`INSERT INTO ${T.fotos} (VehiculoID, Orden, Url) VALUES (@v, @o, @u)`);
      }

      if (v.oferta) {
        const [postor, monto] = v.oferta;
        await new sql.Request(tx).input('v', sql.Int, id).input('u', sql.Int, usuarios[postor]).input('m', sql.Decimal(12, 2), monto)
          .query(`INSERT INTO ${T.pujas} (VehiculoID, UsuarioID, Monto) VALUES (@v, @u, @m);
                  UPDATE ${T.vehiculos} SET MontoActual = @m, GanadorID = @u, TotalPujas = 1 WHERE VehiculoID = @v;`);
      }
      await tx.commit();
      console.log(`+ ${v.marca} ${v.modelo} (lote #${id})`);
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }
  await pool.close();
})().catch((err) => {
  console.error('Error al cargar datos demo:', err.message);
  process.exit(1);
});
