import { io } from 'socket.io-client';
import { obtenerToken } from './api';
import { sincronizarHora } from './tiempo';

// Conexión única de Socket.IO. El token se envía en cada (re)conexión para que
// el servidor calcule el indicador personal ("vas ganando" / "te superaron").
export const socket = io({
  auth: (cb) => cb({ token: obtenerToken() }),
  transports: ['websocket', 'polling'],
});

socket.on('hora', sincronizarHora);

/** Tras iniciar o cerrar sesión: reconecta con el nuevo token. */
export function reconectarSocket() {
  socket.disconnect();
  socket.connect();
}
