import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { problemasPassword } from '../util';
import { rutaSegura } from './Login';

export default function Registro() {
  const { usuario, registro } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [f, setF] = useState({ nombre: '', apellido: '', correo: '', telefono: '', password: '', confirmar: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const next = rutaSegura(params.get('next'));

  if (usuario) return <Navigate to={next} replace />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const reglas = problemasPassword(f.password);
  const segura = reglas.every(([ok]) => ok);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!segura) return setError('La contraseña no cumple los requisitos de seguridad.');
    if (f.password !== f.confirmar) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    try {
      const { confirmar, ...datos } = f;
      await registro(datos);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="contenedor auth">
      <form className="tarjeta auth__form auth__form--ancho" onSubmit={enviar}>
        <h1>Crear cuenta</h1>
        <p className="sub">Regístrate para ofertar en subastas y publicar tus vehículos.</p>
        <div className="fila-2">
          <label className="campo"><span>Nombre</span><input value={f.nombre} onChange={set('nombre')} maxLength={80} autoComplete="given-name" required /></label>
          <label className="campo"><span>Apellido</span><input value={f.apellido} onChange={set('apellido')} maxLength={80} autoComplete="family-name" required /></label>
        </div>
        <div className="fila-2">
          <label className="campo"><span>Correo electrónico</span><input type="email" value={f.correo} onChange={set('correo')} maxLength={150} autoComplete="email" required /></label>
          <label className="campo"><span>Teléfono</span><input type="tel" value={f.telefono} onChange={set('telefono')} maxLength={20} placeholder="5555-1234" autoComplete="tel" required /></label>
        </div>
        <div className="fila-2">
          <label className="campo"><span>Contraseña</span><input type="password" value={f.password} onChange={set('password')} maxLength={72} autoComplete="new-password" required /></label>
          <label className="campo"><span>Confirmar contraseña</span><input type="password" value={f.confirmar} onChange={set('confirmar')} maxLength={72} autoComplete="new-password" required /></label>
        </div>
        <ul className="reglas">
          {reglas.map(([ok, texto]) => <li key={texto} className={ok ? 'ok' : ''}>{ok ? '✓' : '•'} {texto}</li>)}
        </ul>
        {error && <div className="alerta alerta--error">{error}</div>}
        <button className="boton boton--acento boton--ancho" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
        <p className="auth__alterno">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
