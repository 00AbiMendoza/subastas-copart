require('dotenv').config({ quiet: true });

// Configuración centralizada. Los secretos solo llegan por variables de entorno
// (.env en local, panel del hosting en producción); nunca están en el código.
const produccion = process.env.NODE_ENV === 'production';

const requeridas = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_DATABASE', ...(produccion ? ['JWT_SECRET'] : [])];
const faltan = requeridas.filter((k) => !process.env[k]);
if (faltan.length) {
  console.error(`Faltan variables de entorno: ${faltan.join(', ')}`);
  process.exit(1);
}
if (produccion && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  process.exit(1);
}

module.exports = {
  produccion,
  puerto: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'solo-para-desarrollo-local-no-usar-en-produccion',
  jwtDuracion: '8h',
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 1433,
  },
};
