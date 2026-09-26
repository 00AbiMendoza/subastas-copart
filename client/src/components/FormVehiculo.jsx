import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { DANOS, aInputFecha, comprimirImagen } from '../util';

const MIN_FOTOS = 5;
const MAX_FOTOS = 12;

const inicial = () => {
  const inicio = new Date(Date.now() + 5 * 60000);
  const fin = new Date(Date.now() + 3 * 86400000);
  return {
    anio: '', tipoArticulo: '', marca: '', modelo: '', motor: '', transmision: '', combustible: '',
    tren: '', cilindros: '', dano: '', descripcion: '', montoBase: '',
    fechaInicio: aInputFecha(inicio), fechaFin: aInputFecha(fin),
  };
};

/**
 * Formulario compartido para publicar y editar.
 * `vehiculo` (opcional) precarga los datos al editar; `onGuardar(cuerpo)` hace la petición.
 */
export default function FormVehiculo({ vehiculo, onGuardar, textoBoton }) {
  const [catalogos, setCatalogos] = useState(null);
  const [f, setF] = useState(inicial);
  const [existentes, setExistentes] = useState([]); // fotos ya guardadas (edición)
  const [nuevas, setNuevas] = useState([]); // data URLs comprimidas
  const [procesando, setProcesando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState([]);
  const inputFotos = useRef(null);
  const conOfertas = vehiculo?.totalPujas > 0;

  useEffect(() => { api('/catalogos').then(setCatalogos).catch(() => {}); }, []);

  useEffect(() => {
    if (!vehiculo) return;
    setF({
      anio: vehiculo.anio, tipoArticulo: vehiculo.tipoArticulo, marca: vehiculo.marca, modelo: vehiculo.modelo,
      motor: vehiculo.motor, transmision: vehiculo.transmision, combustible: vehiculo.combustible, tren: vehiculo.tren,
      cilindros: vehiculo.cilindros, dano: vehiculo.dano, descripcion: vehiculo.descripcion || '', montoBase: vehiculo.montoBase,
      fechaInicio: aInputFecha(vehiculo.fechaInicio), fechaFin: aInputFecha(vehiculo.fechaFin),
    });
    setExistentes(vehiculo.fotos);
  }, [vehiculo]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const totalFotos = existentes.length + nuevas.length;

  async function agregarFotos(e) {
    const archivos = [...e.target.files].filter((a) => a.type.startsWith('image/'));
    e.target.value = '';
    const espacio = MAX_FOTOS - totalFotos;
    if (!archivos.length || espacio <= 0) return;
    setProcesando(true);
    try {
      const comprimidas = await Promise.all(archivos.slice(0, espacio).map((a) => comprimirImagen(a)));
      setNuevas((n) => [...n, ...comprimidas]);
    } catch (err) {
      setErrores([err.message]);
    } finally {
      setProcesando(false);
    }
  }

  function validar() {
    const e = [];
    const requeridos = { anio: 'Año', tipoArticulo: 'Tipo de artículo', marca: 'Marca', modelo: 'Modelo', motor: 'Motor', transmision: 'Transmisión', combustible: 'Combustible', tren: 'Tren de manejo', cilindros: 'Número de cilindros', dano: 'Estado de daño', montoBase: 'Monto base' };
    Object.entries(requeridos).forEach(([k, n]) => (f[k] === '' || f[k] == null) && e.push(`${n} es obligatorio.`));
    if (totalFotos < MIN_FOTOS) e.push(`Agrega al menos ${MIN_FOTOS} fotografías (llevas ${totalFotos}).`);
    if (new Date(f.fechaFin) <= new Date(f.fechaInicio)) e.push('La fecha de cierre debe ser posterior a la de inicio.');
    if (new Date(f.fechaFin) <= new Date()) e.push('La fecha de cierre debe ser futura.');
    return e;
  }

  async function enviar(e) {
    e.preventDefault();
    const problemas = validar();
    setErrores(problemas);
    if (problemas.length) return window.scrollTo({ top: 0, behavior: 'smooth' });

    const cuerpo = {
      ...f,
      anio: Number(f.anio),
      cilindros: Number(f.cilindros),
      montoBase: Number(f.montoBase),
      fechaInicio: new Date(f.fechaInicio).toISOString(),
      fechaFin: new Date(f.fechaFin).toISOString(),
      ...(vehiculo ? { fotosConservar: existentes.map((x) => x.id), fotosNuevas: nuevas } : { fotos: nuevas }),
    };
    setEnviando(true);
    try {
      await onGuardar(cuerpo);
    } catch (err) {
      setErrores(err.cuerpo?.errores || [err.message]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  }

  const opciones = (lista) => (lista || []).map((x) => <option key={x.codigo} value={x.nombre}>{x.nombre}</option>);
  const anioMax = new Date().getFullYear() + 1;

  return (
    <form className="form-vehiculo" onSubmit={enviar} noValidate>
      {errores.length > 0 && (
        <div className="alerta alerta--error">
          <b>Revisa lo siguiente:</b>
          <ul>{errores.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      <section className="tarjeta">
        <h2>1. Ficha técnica</h2>
        <div className="fila-3">
          <label className="campo"><span>Año *</span><input type="number" min="1950" max={anioMax} value={f.anio} onChange={set('anio')} placeholder="2020" /></label>
          <label className="campo"><span>Tipo de artículo *</span><select value={f.tipoArticulo} onChange={set('tipoArticulo')}><option value="">Selecciona…</option>{opciones(catalogos?.tiposArticulo)}</select></label>
          <label className="campo">
            <span>Marca *</span>
            <input list="marcas" value={f.marca} onChange={set('marca')} maxLength={60} placeholder="Toyota" />
            <datalist id="marcas">{(catalogos?.marcas || []).map((m) => <option key={m.codigo} value={m.nombre} />)}</datalist>
          </label>
          <label className="campo"><span>Modelo *</span><input value={f.modelo} onChange={set('modelo')} maxLength={80} placeholder="Corolla LE" /></label>
          <label className="campo"><span>Motor *</span><input value={f.motor} onChange={set('motor')} maxLength={60} placeholder="1.8L 4 cil." /></label>
          <label className="campo"><span>Transmisión *</span><select value={f.transmision} onChange={set('transmision')}><option value="">Selecciona…</option>{opciones(catalogos?.transmisiones)}</select></label>
          <label className="campo"><span>Combustible *</span><select value={f.combustible} onChange={set('combustible')}><option value="">Selecciona…</option>{opciones(catalogos?.combustibles)}</select></label>
          <label className="campo"><span>Tren de manejo *</span><select value={f.tren} onChange={set('tren')}><option value="">Selecciona…</option>{opciones(catalogos?.trenes)}</select></label>
          <label className="campo"><span>Número de cilindros *</span><input type="number" min="0" max="16" value={f.cilindros} onChange={set('cilindros')} placeholder="4" /></label>
        </div>
        <label className="campo"><span>Descripción (opcional)</span><textarea rows="3" maxLength={1000} value={f.descripcion} onChange={set('descripcion')} placeholder="Kilometraje, detalles del daño, llaves, etc." /></label>
      </section>

      <section className="tarjeta">
        <h2>2. Clasificación por estado de daño *</h2>
        <div className="danos-selector">
          {Object.entries(DANOS).map(([cod, d]) => (
            <label key={cod} className={`dano-card dano-card--${cod.toLowerCase()} ${f.dano === cod ? 'activa' : ''}`}>
              <input type="radio" name="dano" value={cod} checked={f.dano === cod} onChange={set('dano')} />
              <i />
              <strong>{d.nombre}</strong>
              <span>{d.detalle}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="tarjeta">
        <div className="tarjeta__cabecera">
          <h2>3. Galería fotográfica *</h2>
          <span className={`contador-fotos ${totalFotos >= MIN_FOTOS ? 'ok' : ''}`}>{totalFotos} / mínimo {MIN_FOTOS}</span>
        </div>
        <div className="galeria-form">
          {existentes.map((foto, i) => (
            <div key={`e${foto.id}`} className="miniatura">
              <img src={foto.url} alt={`Foto ${i + 1}`} />
              {i === 0 && <span className="portada">Portada</span>}
              <button type="button" onClick={() => setExistentes(existentes.filter((x) => x.id !== foto.id))} aria-label="Quitar foto">✕</button>
            </div>
          ))}
          {nuevas.map((src, i) => (
            <div key={`n${i}`} className="miniatura">
              <img src={src} alt={`Foto nueva ${i + 1}`} />
              {existentes.length === 0 && i === 0 && <span className="portada">Portada</span>}
              <button type="button" onClick={() => setNuevas(nuevas.filter((_, j) => j !== i))} aria-label="Quitar foto">✕</button>
            </div>
          ))}
          {totalFotos < MAX_FOTOS && (
            <button type="button" className="agregar-foto" onClick={() => inputFotos.current.click()} disabled={procesando}>
              <span>＋</span>{procesando ? 'Procesando…' : 'Agregar fotos'}
            </button>
          )}
        </div>
        <input ref={inputFotos} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={agregarFotos} />
        <p className="nota">JPG, PNG o WEBP. Mínimo {MIN_FOTOS}, máximo {MAX_FOTOS}. Se optimizan automáticamente antes de subirlas.</p>
      </section>

      <section className="tarjeta">
        <h2>4. Parámetros de la subasta</h2>
        {conOfertas && <div className="alerta alerta--info">Esta subasta ya tiene ofertas: el monto base y la fecha de inicio no se pueden cambiar, y el cierre solo se puede extender.</div>}
        <div className="fila-3">
          <label className="campo"><span>Monto base (Q) *</span><input type="number" min="1" step="0.01" value={f.montoBase} onChange={set('montoBase')} placeholder="20000" disabled={conOfertas} /></label>
          <label className="campo"><span>Fecha y hora de inicio *</span><input type="datetime-local" value={f.fechaInicio} onChange={set('fechaInicio')} disabled={conOfertas} /></label>
          <label className="campo"><span>Fecha y hora de cierre *</span><input type="datetime-local" value={f.fechaFin} onChange={set('fechaFin')} /></label>
        </div>
      </section>

      <div className="form-vehiculo__acciones">
        <button className="boton boton--acento" disabled={enviando || procesando}>{enviando ? 'Guardando…' : textoBoton}</button>
      </div>
    </form>
  );
}
