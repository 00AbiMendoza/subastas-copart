import { useEffect, useState } from 'react';

export default function Carrusel({ fotos, titulo }) {
  const [i, setI] = useState(0);
  const total = fotos.length;
  const ir = (n) => setI(((n % total) + total) % total);

  useEffect(() => setI(0), [fotos]);
  useEffect(() => {
    const tecla = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + total) % total);
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % total);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [total]);

  if (!total) return <div className="carrusel carrusel--vacio">Sin fotografías</div>;

  return (
    <div className="carrusel">
      <div className="carrusel__principal">
        {fotos.map((f, n) => (
          <img key={f.id} src={f.url} alt={`${titulo} — foto ${n + 1}`} className={n === i ? 'activa' : ''} loading={n === 0 ? 'eager' : 'lazy'} />
        ))}
        <button className="carrusel__flecha carrusel__flecha--izq" onClick={() => ir(i - 1)} aria-label="Foto anterior">‹</button>
        <button className="carrusel__flecha carrusel__flecha--der" onClick={() => ir(i + 1)} aria-label="Foto siguiente">›</button>
        <span className="carrusel__contador">{i + 1} / {total}</span>
      </div>
      <div className="carrusel__miniaturas">
        {fotos.map((f, n) => (
          <button key={f.id} className={n === i ? 'activa' : ''} onClick={() => setI(n)} aria-label={`Ver foto ${n + 1}`}>
            <img src={f.url} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
