import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import FormVehiculo from '../components/FormVehiculo';

export default function Publicar() {
  const navigate = useNavigate();
  const guardar = async (cuerpo) => {
    const r = await api('/vehiculos', { metodo: 'POST', cuerpo });
    navigate(`/vehiculo/${r.id}`);
  };
  return (
    <div className="contenedor pagina-form">
      <h1>Publicar vehículo</h1>
      <p className="sub">Completa la ficha técnica, la clasificación de daño, al menos 5 fotos y los parámetros de la subasta.</p>
      <FormVehiculo onGuardar={guardar} textoBoton="Publicar subasta" />
    </div>
  );
}
