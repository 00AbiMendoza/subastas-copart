import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, obtenerToken } from './api';
import { reconectarSocket } from './socket';

const AuthContext = createContext(null);

function guardar(token, usuario) {
  try {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
  } catch {
    /* almacenamiento no disponible: la sesión dura lo que la pestaña */
  }
}

function usuarioGuardado() {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => (obtenerToken() ? usuarioGuardado() : null));

  // Verifica que el token guardado siga siendo válido.
  useEffect(() => {
    if (!obtenerToken()) return;
    api('/auth/yo')
      .then(({ usuario: u }) => setUsuario(u))
      .catch((e) => {
        if (e.status === 401) {
          guardar(null);
          setUsuario(null);
          reconectarSocket();
        }
      });
  }, []);

  const entrar = useCallback((token, u) => {
    guardar(token, u);
    setUsuario(u);
    reconectarSocket();
  }, []);

  const login = useCallback(async (correo, password) => {
    const r = await api('/auth/login', { metodo: 'POST', cuerpo: { correo, password } });
    entrar(r.token, r.usuario);
    return r.usuario;
  }, [entrar]);

  const registro = useCallback(async (datos) => {
    const r = await api('/auth/registro', { metodo: 'POST', cuerpo: datos });
    entrar(r.token, r.usuario);
    return r.usuario;
  }, [entrar]);

  const salir = useCallback(() => {
    guardar(null);
    setUsuario(null);
    reconectarSocket();
  }, []);

  const valor = useMemo(() => ({ usuario, login, registro, salir }), [usuario, login, registro, salir]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
