const sql = require('mssql');
const config = require('../config');

const opciones = {
  ...config.db,
  options: { encrypt: true, trustServerCertificate: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 30000,
};

// Un solo pool de conexiones por proceso.
let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(opciones).connect().catch((err) => {
      poolPromise = null; // permite reintentar en la siguiente petición
      throw err;
    });
  }
  return poolPromise;
}

// Todas las tablas del proyecto llevan este prefijo porque la base es compartida por el curso.
const T = {
  usuarios: 'dbo.edelacruz_Usuarios',
  catalogos: 'dbo.edelacruz_Catalogos',
  vehiculos: 'dbo.edelacruz_Vehiculos',
  fotos: 'dbo.edelacruz_VehiculoFotos',
  pujas: 'dbo.edelacruz_Pujas',
};

module.exports = { sql, getPool, T };
