import { Link } from 'react-router-dom';
import { formatoQ } from '../util';
import { estadoEnVivo, useAhora } from '../tiempo';
import { DanoBadge, EstadoChip, Temporizador } from './Etiquetas';

// Estado personal de la puja, visible desde el inventario (se actualiza en vivo).
const INDICADOR = {
  GANANDO: { texto: '● Vas ganando', clase: 'card__indicador--ganando' },
  SUPERADO: { texto: '▲ Te superaron', clase: 'card__indicador--superado' },
  GANASTE: { texto: '🏆 Ganaste', clase: 'card__indicador--ganando' },
};

export default function VehiculoCard({ v, destello }) {
  const ahora = useAhora();
  const estado = estadoEnVivo(v, ahora);
  const conOfertas = v.montoActual != null;

  return (
    <Link to={`/vehiculo/${v.id}`} className={`card ${destello ? 'card--destello' : ''}`}>
      <div className="card__imagen">
        {v.portada ? <img src={v.portada} alt={`${v.marca} ${v.modelo}`} loading="lazy" /> : <div className="card__sin-foto">Sin foto</div>}
        <div className="card__chips">
          <EstadoChip estado={estado} />
          <DanoBadge dano={v.dano} />
        </div>
        {v.esMio && <span className="card__mio">Tu publicación</span>}
        {INDICADOR[v.miEstado] && (
          <span className={`card__indicador ${INDICADOR[v.miEstado].clase}`}>{INDICADOR[v.miEstado].texto}</span>
        )}
      </div>
      <div className="card__cuerpo">
        <div className="card__lote">Lote #{v.id} · {v.tipoArticulo}</div>
        <h3 className="card__titulo">{v.anio} {v.marca} {v.modelo}</h3>
        <p className="card__specs">
          {v.motor} · {v.transmision} · {v.combustible} · {v.tren} · {v.cilindros} cil.
        </p>
        <div className="card__precio">
          <div>
            <span>{conOfertas ? 'Oferta actual' : 'Precio base'}</span>
            <strong>{formatoQ(conOfertas ? v.montoActual : v.montoBase)}</strong>
          </div>
          <div className="card__pujas">{v.totalPujas} {v.totalPujas === 1 ? 'oferta' : 'ofertas'}</div>
        </div>
        <Temporizador vehiculo={v} />
      </div>
    </Link>
  );
}
