const moneda = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 });
export const formatoQ = (n) => (n == null ? '—' : moneda.format(n));

export const formatoFecha = (f) =>
  new Date(f).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const DANOS = {
  VERDE: { nombre: 'Verde', detalle: 'Daño menor / Limpio', emoji: '🟢' },
  AMARILLO: { nombre: 'Amarillo', detalle: 'Daño medio / Reparable', emoji: '🟡' },
  ROJO: { nombre: 'Rojo', detalle: 'Daño severo / Salvamento', emoji: '🔴' },
};

export const ESTADOS = {
  ACTIVA: { texto: 'En vivo', clase: 'estado--vivo' },
  PROXIMA: { texto: 'Próximamente', clase: 'estado--proxima' },
  VENDIDA: { texto: 'Vendida', clase: 'estado--vendida' },
  DESIERTA: { texto: 'Desierta', clase: 'estado--desierta' },
};

/** Valor para <input type="datetime-local"> en la hora local del navegador. */
export function aInputFecha(fecha) {
  const d = new Date(fecha);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Reduce la foto en el navegador (máx. 1600 px, JPEG) antes de enviarla. */
export function comprimirImagen(archivo, maximo = 1600, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`No se pudo leer la imagen ${archivo.name}.`));
    };
    img.src = url;
  });
}

export function problemasPassword(p) {
  return [
    [p.length >= 8, 'Al menos 8 caracteres'],
    [/[A-Z]/.test(p), 'Una mayúscula'],
    [/[a-z]/.test(p), 'Una minúscula'],
    [/[0-9]/.test(p), 'Un número'],
    [/[^A-Za-z0-9]/.test(p), 'Un símbolo (#, !, @…)'],
  ];
}
