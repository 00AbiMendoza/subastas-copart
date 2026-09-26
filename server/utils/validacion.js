const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^\+?[0-9][0-9\s-]{6,18}$/;
const TRENES = ['AWD', 'FWD', 'RWD', '4WD'];
const DANOS = ['VERDE', 'AMARILLO', 'ROJO'];
const MIN_FOTOS = 5;
const MAX_FOTOS = 12;
const MAX_BYTES_FOTO = 4 * 1024 * 1024;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

const txt = (v) => (typeof v === 'string' ? v.trim() : '');

function requerido(errores, campo, valor, max) {
  if (!valor) errores.push(`${campo} es obligatorio.`);
  else if (valor.length > max) errores.push(`${campo} no puede exceder ${max} caracteres.`);
}

function problemasPassword(password) {
  const faltas = [];
  if (password.length < 8) faltas.push('al menos 8 caracteres');
  if (!/[A-Z]/.test(password)) faltas.push('una mayúscula');
  if (!/[a-z]/.test(password)) faltas.push('una minúscula');
  if (!/[0-9]/.test(password)) faltas.push('un número');
  if (!/[^A-Za-z0-9]/.test(password)) faltas.push('un símbolo');
  return faltas;
}

function validarRegistro(body = {}) {
  const errores = [];
  const datos = {
    nombre: txt(body.nombre),
    apellido: txt(body.apellido),
    correo: txt(body.correo).toLowerCase(),
    telefono: txt(body.telefono),
    password: typeof body.password === 'string' ? body.password : '',
  };
  requerido(errores, 'El nombre', datos.nombre, 80);
  requerido(errores, 'El apellido', datos.apellido, 80);
  requerido(errores, 'El correo', datos.correo, 150);
  if (datos.correo && !EMAIL_RE.test(datos.correo)) errores.push('El correo no tiene un formato válido.');
  requerido(errores, 'El teléfono', datos.telefono, 20);
  if (datos.telefono && !TEL_RE.test(datos.telefono)) errores.push('El teléfono no tiene un formato válido.');
  if (!datos.password) errores.push('La contraseña es obligatoria.');
  else if (datos.password.length > 72) errores.push('La contraseña no puede exceder 72 caracteres.');
  else {
    const faltas = problemasPassword(datos.password);
    if (faltas.length) errores.push(`La contraseña debe tener ${faltas.join(', ')}.`);
  }
  return { errores, datos };
}

// Firma binaria ("magic bytes") de cada formato: se valida el contenido real del
// archivo, no solo el tipo declarado, para impedir subir otra cosa disfrazada de imagen.
const FIRMAS = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

/** Convierte "data:image/jpeg;base64,..." en { contentType, buffer }; null si no es una imagen válida. */
function parsearFoto(dataUrl) {
  const m = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!m || !TIPOS_IMAGEN.includes(m[1])) return null;
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length < 12 || buffer.length > MAX_BYTES_FOTO || !FIRMAS[m[1]](buffer)) return null;
  return { contentType: m[1], buffer };
}

/**
 * Valida la ficha técnica y los parámetros de la subasta.
 * `catalogos` = { TIPO_ARTICULO: Set, COMBUSTIBLE: Set, TRANSMISION: Set }
 */
function validarVehiculo(body = {}, catalogos) {
  const errores = [];
  const anioMax = new Date().getFullYear() + 1;
  const d = {
    anio: Number(body.anio),
    tipoArticulo: txt(body.tipoArticulo),
    marca: txt(body.marca),
    modelo: txt(body.modelo),
    motor: txt(body.motor),
    transmision: txt(body.transmision),
    combustible: txt(body.combustible),
    tren: txt(body.tren).toUpperCase(),
    cilindros: Number(body.cilindros),
    dano: txt(body.dano).toUpperCase(),
    descripcion: txt(body.descripcion) || null,
    montoBase: Number(body.montoBase),
    fechaInicio: new Date(body.fechaInicio),
    fechaFin: new Date(body.fechaFin),
  };

  if (!Number.isInteger(d.anio) || d.anio < 1950 || d.anio > anioMax) errores.push(`El año debe estar entre 1950 y ${anioMax}.`);
  requerido(errores, 'El tipo de artículo', d.tipoArticulo, 40);
  if (d.tipoArticulo && !catalogos.TIPO_ARTICULO.has(d.tipoArticulo)) errores.push('El tipo de artículo no existe en el catálogo.');
  requerido(errores, 'La marca', d.marca, 60);
  requerido(errores, 'El modelo', d.modelo, 80);
  requerido(errores, 'El motor', d.motor, 60);
  requerido(errores, 'La transmisión', d.transmision, 30);
  if (d.transmision && !catalogos.TRANSMISION.has(d.transmision)) errores.push('La transmisión no existe en el catálogo.');
  requerido(errores, 'El tipo de combustible', d.combustible, 30);
  if (d.combustible && !catalogos.COMBUSTIBLE.has(d.combustible)) errores.push('El combustible no existe en el catálogo.');
  if (!TRENES.includes(d.tren)) errores.push('El tren de manejo debe ser AWD, FWD, RWD o 4WD.');
  if (!Number.isInteger(d.cilindros) || d.cilindros < 0 || d.cilindros > 16) errores.push('El número de cilindros debe ser un entero entre 0 y 16.');
  if (!DANOS.includes(d.dano)) errores.push('El estado de daño debe ser Verde, Amarillo o Rojo.');
  if (d.descripcion && d.descripcion.length > 1000) errores.push('La descripción no puede exceder 1000 caracteres.');
  if (!Number.isFinite(d.montoBase) || d.montoBase <= 0 || d.montoBase > 99999999) errores.push('El monto base debe ser mayor a Q 0.');
  else d.montoBase = Math.round(d.montoBase * 100) / 100;
  if (Number.isNaN(d.fechaInicio.getTime())) errores.push('La fecha y hora de inicio no es válida.');
  if (Number.isNaN(d.fechaFin.getTime())) errores.push('La fecha y hora de cierre no es válida.');
  else if (d.fechaFin <= d.fechaInicio) errores.push('La fecha de cierre debe ser posterior a la de inicio.');

  return { errores, datos: d };
}

module.exports = { validarRegistro, validarVehiculo, parsearFoto, MIN_FOTOS, MAX_FOTOS };
