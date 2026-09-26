import { useEffect, useState } from 'react';

// Diferencia entre el reloj del servidor y el del navegador, para que todos
// los usuarios vean el mismo temporizador aunque su computadora esté desfasada.
let desfase = 0;
export const sincronizarHora = (serverTime) => {
  desfase = Number(serverTime) - Date.now();
};
export const ahoraServidor = () => Date.now() + desfase;

// Un solo intervalo compartido por todos los temporizadores de la página.
const suscriptores = new Set();
setInterval(() => suscriptores.forEach((fn) => fn(ahoraServidor())), 1000);

export function useAhora() {
  const [ahora, setAhora] = useState(ahoraServidor);
  useEffect(() => {
    suscriptores.add(setAhora);
    return () => suscriptores.delete(setAhora);
  }, []);
  return ahora;
}

const dos = (n) => String(n).padStart(2, '0');

export function formatoRestante(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return d > 0 ? `${d}d ${dos(h)}h ${dos(m)}m ${dos(seg)}s` : `${dos(h)}:${dos(m)}:${dos(seg)}`;
}

/** Estado de la subasta visto en el navegador (el servidor confirma el cierre). */
export function estadoEnVivo(v, ahora) {
  if (v.estado === 'VENDIDA' || v.estado === 'DESIERTA') return v.estado;
  const inicio = new Date(v.fechaInicio).getTime();
  const fin = new Date(v.fechaFin).getTime();
  if (ahora < inicio) return 'PROXIMA';
  if (ahora < fin) return 'ACTIVA';
  return v.totalPujas > 0 ? 'VENDIDA' : 'DESIERTA';
}
