import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import { estadoEnVivo, useAhora } from '../tiempo';
import { formatoFecha, formatoQ } from '../util';
import { DanoBadge, EstadoChip } from '../components/Etiquetas';

export default function MisPublicaciones() {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const ahora = useAhora();

  const cargar = useCallback(() => {
    api(`/vehiculos/mios?q=${encodeURIComponent(q)}&orden=recientes`)
      .then((r) => setLista(r.vehiculos))
      .catch((e) => setError(e.message));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  useEffect(() => {
    const actualizar = (s) => setLista((l) => l && l.map((v) => (v.id === s.vehiculoId ? { ...v, ...s, id: v.id } : v)));
    socket.on('inventario:actualizado', actualizar);
    return () => socket.off('inventario:actualizado', actualizar);
  }, []);

  return (
    <div className="contenedor pagina-form">
      <div className="mis__cabecera">
        <div>
          <h1>Mis publicaciones</h1>
          <p className="sub">Busca tus vehículos publicados para revisarlos o editarlos.</p>
        </div>
        <Link to="/publicar" className="boton boton--acento">Publicar vehículo</Link>
      </div>

      <input className="buscador" type="search" placeholder="Buscar por marca, modelo, año o número de lote…" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <div className="alerta alerta--error">{error}</div>}

      {!lista ? (
        <p className="cargando-pagina">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="vacio">
          <h3>{q ? 'Ninguna publicación coincide con la búsqueda' : 'Aún no has publicado vehículos'}</h3>
          {!q && <Link to="/publicar" className="boton boton--primario">Publicar mi primer vehículo</Link>}
        </div>
      ) : (
        <div className="mis__lista">
          {lista.map((v) => {
            const estado = estadoEnVivo(v, ahora);
            const editable = estado === 'ACTIVA' || estado === 'PROXIMA';
            return (
              <article key={v.id} className="mis__item">
                {v.portada ? <img src={v.portada} alt="" /> : <div className="mis__sin-foto" />}
                <div className="mis__info">
                  <div className="mis__chips"><EstadoChip estado={estado} /> <DanoBadge dano={v.dano} /></div>
                  <h3>{v.anio} {v.marca} {v.modelo}</h3>
                  <p>Lote #{v.id} · Cierre: {formatoFecha(v.fechaFin)}</p>
                </div>
                <div className="mis__precio">
                  <span>{v.montoActual != null ? 'Oferta actual' : 'Precio base'}</span>
                  <strong>{formatoQ(v.montoActual ?? v.montoBase)}</strong>
                  <small>{v.totalPujas} ofertas</small>
                </div>
                <div className="mis__acciones">
                  <Link to={`/vehiculo/${v.id}`} className="boton boton--suave boton--chico">Ver</Link>
                  {editable && <Link to={`/editar/${v.id}`} className="boton boton--primario boton--chico">Editar</Link>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
