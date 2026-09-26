import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';

// Solo se permite volver a rutas internas (evita redirecciones abiertas a otros sitios).
export const rutaSegura = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

export default function Login() {
  const { usuario, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const next = rutaSegura(params.get('next'));

  if (usuario) return <Navigate to={next} replace />;

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(correo, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="contenedor auth">
      <form className="tarjeta auth__form" onSubmit={enviar}>
        <h1>Iniciar sesión</h1>
        <p className="sub">Necesitas una cuenta para ofertar y publicar vehículos.</p>
        <label className="campo">
          <span>Correo electrónico</span>
          <input type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="alerta alerta--error">{error}</div>}
        <button className="boton boton--primario boton--ancho" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p className="auth__alterno">¿No tienes cuenta? <Link to={`/registro${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Regístrate</Link></p>
      </form>
    </div>
  );
}
