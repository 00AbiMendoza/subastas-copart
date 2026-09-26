import { sincronizarHora } from './tiempo';

export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.mensaje || 'Ocurrió un error. Intenta de nuevo.');
    this.status = status;
    this.cuerpo = cuerpo;
  }
}

export const obtenerToken = () => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

/** fetch contra la API con el token de sesión; lanza ErrorApi si la respuesta no es 2xx. */
export async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = obtenerToken();
  const res = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (datos?.serverTime) sincronizarHora(datos.serverTime);
  if (!res.ok) throw new ErrorApi(res.status, datos);
  return datos;
}
