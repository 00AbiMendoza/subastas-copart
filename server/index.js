const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const app = require('./app');
const { inicializarBD } = require('./db/esquema');
const { configurarTiempoReal } = require('./services/subastas');

const server = http.createServer(app);

// Socket.IO comparte el mismo origen que la SPA, por eso no se habilita CORS.
const io = new Server(server, { maxHttpBufferSize: 1e5 });

inicializarBD()
  .then(() => {
    configurarTiempoReal(io);
    server.listen(config.puerto, () => console.log(`AutoSubasta GT escuchando en http://localhost:${config.puerto}`));
  })
  .catch((err) => {
    console.error('No se pudo inicializar la base de datos:', err.message);
    process.exit(1);
  });
