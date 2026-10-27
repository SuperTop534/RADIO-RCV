import { useEffect, useRef } from 'react';

interface Props {
  size?: 'hero' | 'splash' | 'compact';
  interactive?: boolean;
  eager?: boolean;
}

/**
 * Logo oficial sobre uma placa de vidro clara (as cores originais — azul-marinho,
 * laranja e preto — precisam de fundo claro para manter a identidade e a leitura).
 * Profundidade 3D discreta: inclinação acompanha o ponteiro no computador.
 */
export function Logo3D({ size = 'hero', interactive = true, eager = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
        el.style.setProperty('--gx', `${50 + x * 60}%`);
      });
    };
    const reset = () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--gx', '50%');
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', reset);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', reset);
    };
  }, [interactive]);

  return (
    <div ref={ref} className={`logo3d logo3d--${size}`}>
      <div className="logo3d__float">
        <div className="logo3d__plate">
          <picture>
            <source srcSet="assets/logo-rcv-900.webp 900w, assets/logo-rcv.webp 1729w" sizes="(min-width: 900px) 480px, 82vw" type="image/webp" />
            <img
              className="logo3d__img"
              src="assets/logo-rcv-900.png"
              alt="RCV Estúdio Rádio — A sua playlist digital na internet"
              width={900}
              height={430}
              decoding="async"
              fetchPriority={eager ? 'high' : 'auto'}
              draggable={false}
            />
          </picture>
          <span className="logo3d__sheen" aria-hidden="true" />
        </div>
        <span className="logo3d__shadow" aria-hidden="true" />
      </div>
    </div>
  );
}
