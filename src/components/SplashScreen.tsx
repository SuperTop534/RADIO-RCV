import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo3D } from './Logo3D.tsx';

const SEEN_KEY = 'rcv:splash-seen';

function durations() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* ignore */ }
  if (reduced) return { hold: 600, exit: 250 };
  // Primeira abertura um pouco mais longa; as próximas são mais rápidas.
  return seen ? { hold: 1150, exit: 520 } : { hold: 1900, exit: 620 };
}

/**
 * Abertura com a logo. Montada uma única vez na raiz do app — trocar de aba
 * não a reinicia. Toque, clique ou tecla pulam a animação.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const finished = useRef(false);
  const timers = useRef<number[]>([]);
  const cfg = useRef(durations());

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setPhase('out');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    timers.current.push(window.setTimeout(onDone, cfg.current.exit));
  }, [onDone]);

  useEffect(() => {
    timers.current.push(window.setTimeout(finish, cfg.current.hold));
    window.addEventListener('keydown', finish);
    const t = timers.current;
    return () => {
      t.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('keydown', finish);
    };
  }, [finish]);

  return (
    <div
      className={`splash splash--${phase}`}
      style={{ ['--exit' as string]: `${cfg.current.exit}ms` }}
      onClick={finish}
      aria-hidden={phase === 'out'}
    >
      <div className="splash__glow" aria-hidden="true" />
      <div className="splash__logo">
        <Logo3D size="splash" interactive={false} eager />
      </div>
      <div className="splash__bars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 90}ms` }} />)}
      </div>
      <p className="sr-only" role="status">Abrindo RCV Estúdio Rádio</p>
    </div>
  );
}
