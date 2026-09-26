import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { socket } from './socket';
import Home from './pages/Home';
import Detalle from './pages/Detalle';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Publicar from './pages/Publicar';
import Editar from './pages/Editar';
import MisPublicaciones from './pages/MisPublicaciones';

function RutaPrivada({ children }) {
  const { usuario } = useAuth();
  const location = useLocation();
  if (!usuario) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

function IndicadorConexion() {
  const [conectado, setConectado] = useState(socket.connected);
  useEffect(() => {
    const on = () => setConectado(true);
    const off = () => setConectado(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    return () => {
      socket.off('connect', on);
      socket.off('disconnect', off);
    };
  }, []);
  return (
    <span className={`conexion ${conectado ? 'conexion--ok' : ''}`} title={conectado ? 'Conectado en tiempo real' : 'Reconectando…'}>
      <i /> {conectado ? 'En vivo' : 'Conectando…'}
    </span>
  );
}

function Encabezado() {
  const { usuario, salir } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const location = useLocation();
  useEffect(() => setAbierto(false), [location.pathname]);

  return (
    <header className="encabezado">
      <div className="contenedor encabezado__barra">
        <Link to="/" className="logo">
          <span className="logo__icono" aria-hidden="true">
            <svg viewBox="0 0 32 32"><path d="M5 19l2.8-7h16.4L27 19v5h-3a2.6 2.6 0 0 1-5.2 0h-5.6a2.6 2.6 0 0 1-5.2 0H5z" /></svg>
          </span>
          <span>Auto<b>Subasta</b> GT</span>
        </Link>
        <button className="menu-boton" onClick={() => setAbierto(!abierto)} aria-label="Abrir menú" aria-expanded={abierto}>☰</button>
        <nav className={`nav ${abierto ? 'nav--abierto' : ''}`}>
          <NavLink to="/" end>Inventario</NavLink>
          {usuario ? (
            <>
              <NavLink to="/publicar">Publicar vehículo</NavLink>
              <NavLink to="/mis-publicaciones">Mis publicaciones</NavLink>
              <span className="nav__usuario">Hola, <b>{usuario.nombre}</b></span>
              <button className="boton boton--suave boton--chico" onClick={salir}>Salir</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Iniciar sesión</NavLink>
              <Link to="/registro" className="boton boton--acento boton--chico">Regístrese</Link>
            </>
          )}
          <IndicadorConexion />
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Encabezado />
      <main className="principal">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vehiculo/:id" element={<Detalle />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/publicar" element={<RutaPrivada><Publicar /></RutaPrivada>} />
          <Route path="/editar/:id" element={<RutaPrivada><Editar /></RutaPrivada>} />
          <Route path="/mis-publicaciones" element={<RutaPrivada><MisPublicaciones /></RutaPrivada>} />
          <Route path="*" element={<div className="contenedor vacio-pagina"><h2>Página no encontrada</h2><Link to="/">Volver al inventario</Link></div>} />
        </Routes>
      </main>
      <footer className="pie">
        <div className="contenedor">
          AutoSubasta GT · Desarrollado por Esaú Abimael de la Cruz Mendoza (1890-21-13279) · Desarrollo Web · UMG
        </div>
      </footer>
    </>
  );
}
