import { DANOS, ESTADOS, formatoFecha } from '../util';
import { formatoRestante, useAhora, estadoEnVivo } from '../tiempo';

export function DanoBadge({ dano, detalle = false }) {
  const d = DANOS[dano];
  if (!d) return null;
  return (
    <span className={`dano dano--${dano.toLowerCase()}`} title={d.detalle}>
      <i aria-hidden="true" />
      {detalle ? `${d.nombre} · ${d.detalle}` : d.nombre}
    </span>
  );
}

export function EstadoChip({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.ACTIVA;
  return <span className={`estado ${e.clase}`}>{e.texto}</span>;
}

/** Temporizador en vivo: cuenta regresiva al cierre (o al inicio si aún no empieza). */
export function Temporizador({ vehiculo, grande = false }) {
  const ahora = useAhora();
  const estado = estadoEnVivo(vehiculo, ahora);
  const clase = `reloj ${grande ? 'reloj--grande' : ''}`;

  if (estado === 'PROXIMA') {
    return (
      <div className={clase}>
        <span className="reloj__etiqueta">Inicia en</span>
        <strong>{formatoRestante(new Date(vehiculo.fechaInicio).getTime() - ahora)}</strong>
      </div>
    );
  }
  if (estado === 'ACTIVA') {
    const restante = new Date(vehiculo.fechaFin).getTime() - ahora;
    return (
      <div className={`${clase} ${restante < 5 * 60 * 1000 ? 'reloj--urgente' : ''}`}>
        <span className="reloj__etiqueta">Cierra en</span>
        <strong>{formatoRestante(restante)}</strong>
      </div>
    );
  }
  return (
    <div className={`${clase} reloj--cerrado`}>
      <span className="reloj__etiqueta">Oferta cerrada</span>
      <strong>{formatoFecha(vehiculo.fechaFin)}</strong>
    </div>
  );
}
