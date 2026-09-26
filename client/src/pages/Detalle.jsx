import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import { useAuth } from '../auth';
import { estadoEnVivo, useAhora } from '../tiempo';
import { DANOS, formatoFecha, formatoQ } from '../util';
import Carrusel from '../components/Carrusel';
import { DanoBadge, EstadoChip, Temporizador } from '../components/Etiquetas';

const INDICADORES = {
  GANANDO: { clase: 'indicador--ganando', texto: '¡Vas ganando esta subasta!' },
  SUPERADO: { clase: 'indicador--superado', texto: 'Tu oferta ha sido superada. ¡Haz tu oferta ahora antes de que termine el tiempo!' },
  GANASTE: { clase: 'indicador--ganando', texto: '¡Ganaste esta subasta! 🎉' },
  PERDISTE: { clase: 'indicador--neutro', texto: 'La subasta terminó y otra oferta fue la ganadora.' },
  PROPIETARIO: { clase: 'indicador--neutro', texto: 'Esta es tu publicación: no puedes ofertar en ella.' },
};

function PanelSubasta({ v, onOferta }) {
  const { usuario } = useAuth();
  const location = useLocation();
  const ahora = useAhora();
  const estado = estadoEnVivo(v, ahora);
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const montoPrevio = useRef(v.montoActual);
  const [destello, setDestello] = useState(false);

  // Cuando llega una oferta nueva (de cualquier usuario), sugiere el nuevo mínimo y destaca el monto.
  useEffect(() => {
    setMonto(String(v.siguienteMinimo));
    if (montoPrevio.current !== v.montoActual) {
      montoPrevio.current = v.montoActual;
      setDestello(true);
      const t = setTimeout(() => setDestello(false), 1200);
      return () => clearTimeout(t);
    }
  }, [v.montoActual, v.siguienteMinimo]);

  async function ofertar(e) {
    e.preventDefault();
    setMensaje(null);
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor < v.siguienteMinimo) {
      setMensaje({ tipo: 'error', texto: `La oferta mínima es ${formatoQ(v.siguienteMinimo)}.` });
      return;
    }
    setEnviando(true);
    try {
      const r = await api(`/vehiculos/${v.id}/pujas`, { metodo: 'POST', cuerpo: { monto: valor } });
      setMensaje({ tipo: 'ok', texto: `Oferta de ${formatoQ(r.montoActual)} registrada.` });
      onOferta(r);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setEnviando(false);
    }
  }

  const indicador = INDICADORES[v.miEstado];
  const abierta = estado === 'ACTIVA';
  const sugerencias = [v.siguienteMinimo, Math.ceil(v.siguienteMinimo * 1.05), Math.ceil(v.siguienteMinimo * 1.1)];

  return (
    <div className="panel-subasta">
      <div className="panel-subasta__estado">
        <EstadoChip estado={estado} />
        <span>{v.totalPujas} {v.totalPujas === 1 ? 'oferta' : 'ofertas'}</span>
      </div>

      <Temporizador vehiculo={v} grande />

      <div className={`monto-actual ${destello ? 'monto-actual--destello' : ''}`}>
        <span>{v.montoActual != null ? 'Oferta actual más alta' : 'Sin ofertas · Precio base'}</span>
        <strong>{formatoQ(v.montoActual ?? v.montoBase)}</strong>
        {v.montoActual != null && <small>Precio base: {formatoQ(v.montoBase)}</small>}
      </div>

      {indicador && <div className={`indicador ${indicador.clase}`} role="status">{indicador.texto}</div>}

      {estado === 'VENDIDA' && !indicador && <div className="indicador indicador--neutro">Subasta cerrada: vehículo vendido por {formatoQ(v.montoActual)}.</div>}
      {estado === 'DESIERTA' && <div className="indicador indicador--desierta">Subasta desierta: no se alcanzó el monto base. Vehículo no vendido.</div>}
      {estado === 'PROXIMA' && <div className="indicador indicador--neutro">La subasta inicia el {formatoFecha(v.fechaInicio)}.</div>}

      {abierta && !usuario && (
        <div className="login-requerido">
          <p>Inicia sesión para ofertar por este vehículo.</p>
          <Link className="boton boton--primario" to={`/login?next=${encodeURIComponent(location.pathname)}`}>Iniciar sesión</Link>
          <Link className="boton boton--suave" to="/registro">Crear cuenta</Link>
        </div>
      )}

      {abierta && usuario && v.miEstado !== 'PROPIETARIO' && (
        <form className="form-puja" onSubmit={ofertar}>
          <label htmlFor="monto">
            Tu oferta (mínimo <b>{formatoQ(v.siguienteMinimo)}</b>)
          </label>
          <div className="form-puja__fila">
            <span className="prefijo">Q</span>
            <input id="monto" type="number" min={v.siguienteMinimo} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="sugerencias">
            {sugerencias.map((s) => (
              <button type="button" key={s} onClick={() => setMonto(String(s))}>{formatoQ(s)}</button>
            ))}
          </div>
          <button className="boton boton--acento boton--ancho" disabled={enviando || v.miEstado === 'GANANDO'}>
            {enviando ? 'Enviando…' : v.miEstado === 'GANANDO' ? 'Ya tienes la oferta más alta' : 'Ofertar ahora'}
          </button>
          <p className="nota">Cada oferta debe superar la actual en al menos 10 %. Los postores son anónimos.</p>
        </form>
      )}

      {v.esMio && estado !== 'VENDIDA' && estado !== 'DESIERTA' && (
        <Link to={`/editar/${v.id}`} className="boton boton--suave boton--ancho">Editar publicación</Link>
      )}

      {mensaje && <div className={`alerta alerta--${mensaje.tipo}`}>{mensaje.texto}</div>}
    </div>
  );
}

export default function Detalle() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [v, setV] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api(`/vehiculos/${id}`).then(setV).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar, usuario]);

  // Tiempo real: se une a la sala del vehículo y recibe cada oferta al instante.
  useEffect(() => {
    const unirse = () => socket.emit('subasta:unirse', Number(id));
    const actualizar = (s) => {
      if (s.vehiculoId !== Number(id)) return;
      setV((prev) => {
        if (!prev) return prev;
        if (s.totalPujas !== prev.totalPujas) cargarHistorial();
        return { ...prev, ...s, id: prev.id };
      });
    };
    const cargarHistorial = () =>
      api(`/vehiculos/${id}`).then((d) => setV((prev) => (prev ? { ...prev, historial: d.historial } : d))).catch(() => {});

    unirse();
    socket.on('connect', unirse);
    socket.on('subasta:actualizada', actualizar);
    socket.on('vehiculo:editado', cargar);
    return () => {
      socket.emit('subasta:salir', Number(id));
      socket.off('connect', unirse);
      socket.off('subasta:actualizada', actualizar);
      socket.off('vehiculo:editado', cargar);
    };
  }, [id, cargar]);

  if (error) return <div className="contenedor vacio-pagina"><h2>{error}</h2><Link to="/">Volver al inventario</Link></div>;
  if (!v) return <div className="contenedor cargando-pagina">Cargando subasta…</div>;

  const titulo = `${v.anio} ${v.marca} ${v.modelo}`;
  const ficha = [
    ['Año', v.anio], ['Tipo de artículo', v.tipoArticulo], ['Marca', v.marca], ['Modelo', v.modelo],
    ['Motor', v.motor], ['Transmisión', v.transmision], ['Combustible', v.combustible],
    ['Tren de manejo', v.tren], ['Cilindros', v.cilindros],
  ];

  return (
    <div className="contenedor detalle">
      <nav className="migas"><Link to="/">Inventario</Link> / <span>Lote #{v.id}</span></nav>
      <div className="detalle__titulo">
        <div>
          <h1>{titulo}</h1>
          <p>Lote #{v.id} · {v.tipoArticulo} · Cierre: {formatoFecha(v.fechaFin)}</p>
        </div>
        <DanoBadge dano={v.dano} detalle />
      </div>

      <div className="detalle__grid">
        <div className="detalle__izq">
          <Carrusel fotos={v.fotos} titulo={titulo} />

          <section className="tarjeta">
            <h2>Ficha técnica</h2>
            <dl className="ficha">
              {ficha.map(([k, val]) => (
                <div key={k}><dt>{k}</dt><dd>{val}</dd></div>
              ))}
              <div>
                <dt>Estado de daño</dt>
                <dd><DanoBadge dano={v.dano} /> <small>{DANOS[v.dano]?.detalle}</small></dd>
              </div>
            </dl>
            {v.descripcion && <p className="descripcion">{v.descripcion}</p>}
          </section>
        </div>

        <div className="detalle__der">
          <PanelSubasta v={v} onOferta={(r) => setV((prev) => ({ ...prev, ...r }))} />

          <section className="tarjeta historial">
            <h2>Historial de ofertas</h2>
            {v.historial?.length ? (
              <ol>
                {v.historial.map((h, i) => (
                  <li key={`${h.monto}-${i}`} className={i === 0 ? 'mayor' : ''}>
                    <span className="postor">{h.esMia ? 'Tú' : 'Postor anónimo'}</span>
                    <b>{formatoQ(h.monto)}</b>
                    <small>{formatoFecha(h.fecha)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="nota">Aún no hay ofertas. ¡Sé el primero!</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
