import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import { useAuth } from '../auth';
import { DANOS } from '../util';
import VehiculoCard from '../components/VehiculoCard';

const VACIO = {
  q: '', marca: '', modelo: '', anioMin: '', anioMax: '', tipo: '', combustible: '',
  transmision: '', tren: '', cilindros: '', dano: '', estado: '', orden: 'cierre',
};

function Select({ etiqueta, valor, onChange, opciones, todos = 'Todos' }) {
  return (
    <label className="filtro">
      <span>{etiqueta}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{todos}</option>
        {opciones.map((o) => (
          <option key={o.valor ?? o} value={o.valor ?? o}>{o.texto ?? o}</option>
        ))}
      </select>
    </label>
  );
}

export default function Home() {
  const { usuario } = useAuth();
  const [filtros, setFiltros] = useState(VACIO);
  const [catalogos, setCatalogos] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [destellos, setDestellos] = useState({});
  const [panelAbierto, setPanelAbierto] = useState(false);
  const ultimaConsulta = useRef(0);

  const cargarCatalogos = useCallback(() => api('/catalogos').then(setCatalogos).catch(() => {}), []);
  useEffect(() => { cargarCatalogos(); }, [cargarCatalogos]);

  const consulta = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [filtros]);

  const cargar = useCallback(async () => {
    const n = ++ultimaConsulta.current;
    try {
      const r = await api(`/vehiculos?${consulta}`);
      if (n === ultimaConsulta.current) {
        setVehiculos(r.vehiculos);
        setError('');
      }
    } catch (e) {
      if (n === ultimaConsulta.current) setError(e.message);
    } finally {
      if (n === ultimaConsulta.current) setCargando(false);
    }
  }, [consulta]);

  // Los filtros de texto esperan a que el usuario deje de escribir.
  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar, usuario]);

  // Tiempo real: precios y estados se actualizan en las tarjetas sin recargar.
  useEffect(() => {
    const actualizar = (s) => {
      setVehiculos((lista) => lista.map((v) => (v.id === s.vehiculoId ? { ...v, ...s, id: v.id } : v)));
      setDestellos((d) => ({ ...d, [s.vehiculoId]: Date.now() }));
      setTimeout(() => setDestellos((d) => ({ ...d, [s.vehiculoId]: 0 })), 1200);
    };
    const cambio = () => {
      cargar();
      cargarCatalogos();
    };
    socket.on('inventario:actualizado', actualizar);
    socket.on('inventario:cambio', cambio);
    return () => {
      socket.off('inventario:actualizado', actualizar);
      socket.off('inventario:cambio', cambio);
    };
  }, [cargar, cargarCatalogos]);

  const set = (campo) => (valor) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const activos = Object.entries(filtros).filter(([k, v]) => v && k !== 'orden').length;
  const nombres = (lista) => (lista || []).map((x) => x.nombre);
  const anios = catalogos?.inventario.anios || [];

  return (
    <>
      <section className="hero">
        <div className="contenedor hero__contenido">
          <div>
            <p className="hero__etiqueta">Subastas de vehículos importados · en tiempo real</p>
            <h1>Tu próximo vehículo está a una oferta de distancia</h1>
            <p className="hero__texto">
              Autos, pickups, SUV y motos con historial de daño clasificado. Oferta en vivo y entérate al instante si vas ganando.
            </p>
            {!usuario && (
              <div className="hero__acciones">
                <Link to="/registro" className="boton boton--acento">Crear cuenta gratis</Link>
                <Link to="/login" className="boton boton--blanco">Ya tengo cuenta</Link>
              </div>
            )}
            {usuario && (
              <div className="hero__acciones">
                <Link to="/publicar" className="boton boton--acento">Publicar un vehículo</Link>
              </div>
            )}
          </div>
          <ol className="pilares">
            <li><b>1</b><div><strong>Regístrese</strong><span>Crea tu cuenta para ofertar y publicar.</span></div></li>
            <li><b>2</b><div><strong>Encuentre</strong><span>Filtra por marca, año, daño y más.</span></div></li>
            <li><b>3</b><div><strong>Oferte</strong><span>Puja en vivo y recibe el estado al instante.</span></div></li>
          </ol>
        </div>
      </section>

      <div className="contenedor inventario">
        <aside className={`filtros ${panelAbierto ? 'filtros--abierto' : ''}`}>
          <div className="filtros__cabecera">
            <h2>Filtros {activos > 0 && <span className="contador">{activos}</span>}</h2>
            {activos > 0 && <button className="enlace" onClick={() => setFiltros({ ...VACIO, orden: filtros.orden })}>Limpiar</button>}
          </div>

          <label className="filtro">
            <span>Buscar</span>
            <input type="search" placeholder="Marca, modelo, motor, lote…" value={filtros.q} onChange={(e) => set('q')(e.target.value)} />
          </label>

          <div className="filtro">
            <span>Nivel de daño</span>
            <div className="danos-filtro">
              {Object.entries(DANOS).map(([cod, d]) => (
                <button
                  key={cod}
                  type="button"
                  className={`dano-opcion dano-opcion--${cod.toLowerCase()} ${filtros.dano === cod ? 'activa' : ''}`}
                  onClick={() => set('dano')(filtros.dano === cod ? '' : cod)}
                  title={d.detalle}
                  aria-pressed={filtros.dano === cod}
                >
                  <i /> {d.nombre}
                </button>
              ))}
            </div>
          </div>

          <Select etiqueta="Estado de la subasta" valor={filtros.estado} onChange={set('estado')} todos="Todas"
            opciones={[{ valor: 'ACTIVA', texto: 'En vivo' }, { valor: 'PROXIMA', texto: 'Próximamente' }, { valor: 'CERRADA', texto: 'Cerradas' }]} />
          <Select etiqueta="Marca" valor={filtros.marca} onChange={set('marca')} todos="Todas" opciones={catalogos?.inventario.marcas || []} />
          <label className="filtro">
            <span>Modelo</span>
            <input type="text" placeholder="Ej. Corolla" value={filtros.modelo} onChange={(e) => set('modelo')(e.target.value)} />
          </label>
          <div className="filtro-doble">
            <Select etiqueta="Año desde" valor={filtros.anioMin} onChange={set('anioMin')} todos="—" opciones={[...anios].reverse()} />
            <Select etiqueta="Año hasta" valor={filtros.anioMax} onChange={set('anioMax')} todos="—" opciones={anios} />
          </div>
          <Select etiqueta="Tipo de artículo" valor={filtros.tipo} onChange={set('tipo')} opciones={nombres(catalogos?.tiposArticulo)} />
          <Select etiqueta="Combustible" valor={filtros.combustible} onChange={set('combustible')} opciones={nombres(catalogos?.combustibles)} />
          <Select etiqueta="Transmisión" valor={filtros.transmision} onChange={set('transmision')} todos="Todas"opciones={nombres(catalogos?.transmisiones)} />
          <Select etiqueta="Tren de manejo" valor={filtros.tren} onChange={set('tren')} opciones={nombres(catalogos?.trenes)} />
          <Select etiqueta="Cilindros" valor={filtros.cilindros} onChange={set('cilindros')} opciones={catalogos?.inventario.cilindros || []} />
        </aside>

        <section className="resultados">
          <div className="resultados__barra">
            <button className="boton boton--suave boton--chico solo-movil" onClick={() => setPanelAbierto(!panelAbierto)}>
              {panelAbierto ? 'Ocultar filtros' : `Filtros${activos ? ` (${activos})` : ''}`}
            </button>
            <p><b>{vehiculos.length}</b> {vehiculos.length === 1 ? 'vehículo' : 'vehículos'}</p>
            <label className="orden">
              Ordenar por
              <select value={filtros.orden} onChange={(e) => set('orden')(e.target.value)}>
                <option value="cierre">Cierran pronto</option>
                <option value="recientes">Más recientes</option>
                <option value="precio_asc">Precio: menor a mayor</option>
                <option value="precio_desc">Precio: mayor a menor</option>
                <option value="anio_desc">Año: más nuevo</option>
              </select>
            </label>
          </div>

          {error && <div className="alerta alerta--error">{error}</div>}
          {cargando ? (
            <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card card--esqueleto" />)}</div>
          ) : vehiculos.length ? (
            <div className="grid">
              {vehiculos.map((v) => <VehiculoCard key={v.id} v={v} destello={destellos[v.id]} />)}
            </div>
          ) : (
            <div className="vacio">
              <h3>No hay vehículos con esos filtros</h3>
              <p>Prueba quitando algún filtro{usuario ? ' o publica el primero.' : '.'}</p>
              {usuario && <Link to="/publicar" className="boton boton--primario">Publicar vehículo</Link>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
