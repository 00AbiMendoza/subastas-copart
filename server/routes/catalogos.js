const { Router } = require('express');
const { getPool, T } = require('../db/conexion');

const router = Router();

let cache = null;

/** Catálogos agrupados por tipo. Se cachean porque casi no cambian. */
async function leerCatalogos() {
  if (cache) return cache;
  const pool = await getPool();
  const { recordset } = await pool.request()
    .query(`SELECT Tipo, Codigo, Nombre, Descripcion FROM ${T.catalogos} ORDER BY Tipo, Orden, Nombre`);
  const agrupado = {};
  for (const f of recordset) {
    (agrupado[f.Tipo] ||= []).push({ codigo: f.Codigo, nombre: f.Nombre, descripcion: f.Descripcion });
  }
  cache = agrupado;
  return cache;
}

/** Sets de nombres válidos para validar lo que llega al publicar. */
async function catalogosValidos() {
  const c = await leerCatalogos();
  const set = (tipo) => new Set((c[tipo] || []).map((x) => x.nombre));
  return { TIPO_ARTICULO: set('TIPO_ARTICULO'), COMBUSTIBLE: set('COMBUSTIBLE'), TRANSMISION: set('TRANSMISION') };
}

// GET /api/catalogos — catálogos + valores presentes en el inventario (para los filtros).
router.get('/', async (req, res) => {
  const c = await leerCatalogos();
  const pool = await getPool();
  const inv = await pool.request().query(`
    SELECT DISTINCT 'MARCA' AS Campo, Marca AS Valor FROM ${T.vehiculos}
    UNION SELECT DISTINCT 'ANIO', CAST(Anio AS NVARCHAR(10)) FROM ${T.vehiculos}
    UNION SELECT DISTINCT 'CILINDROS', CAST(Cilindros AS NVARCHAR(10)) FROM ${T.vehiculos}`);
  const valores = (campo) => inv.recordset.filter((r) => r.Campo === campo).map((r) => r.Valor);

  res.json({
    tiposArticulo: c.TIPO_ARTICULO || [],
    combustibles: c.COMBUSTIBLE || [],
    transmisiones: c.TRANSMISION || [],
    trenes: c.TREN || [],
    danos: c.DANO || [],
    marcas: c.MARCA || [],
    inventario: {
      marcas: valores('MARCA').sort((a, b) => a.localeCompare(b)),
      anios: valores('ANIO').map(Number).sort((a, b) => b - a),
      cilindros: valores('CILINDROS').map(Number).sort((a, b) => a - b),
    },
  });
});

module.exports = { router, catalogosValidos };
