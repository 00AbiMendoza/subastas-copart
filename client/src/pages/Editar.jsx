import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import FormVehiculo from '../components/FormVehiculo';

export default function Editar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehiculo, setVehiculo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/vehiculos/${id}`)
      .then((v) => (v.esMio ? setVehiculo(v) : setError('Solo el publicador puede editar este vehículo.')))
      .catch((e) => setError(e.message));
  }, [id]);

  const guardar = async (cuerpo) => {
    await api(`/vehiculos/${id}`, { metodo: 'PUT', cuerpo });
    navigate(`/vehiculo/${id}`);
  };

  if (error) return <div className="contenedor vacio-pagina"><h2>{error}</h2><Link to="/mis-publicaciones">Volver a mis publicaciones</Link></div>;
  if (!vehiculo) return <div className="contenedor cargando-pagina">Cargando publicación…</div>;

  return (
    <div className="contenedor pagina-form">
      <nav className="migas"><Link to="/mis-publicaciones">Mis publicaciones</Link> / <span>Editar lote #{id}</span></nav>
      <h1>Editar {vehiculo.anio} {vehiculo.marca} {vehiculo.modelo}</h1>
      <FormVehiculo vehiculo={vehiculo} onGuardar={guardar} textoBoton="Guardar cambios" />
    </div>
  );
}
