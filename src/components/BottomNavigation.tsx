import { useRef, type KeyboardEvent } from 'react';
import { IconChat, IconRadio, IconVideo } from './Icons.tsx';

export type Tab = 'inicio' | 'videos' | 'chat';

export const TABS: { id: Tab; label: string; Icon: typeof IconRadio }[] = [
  { id: 'inicio', label: 'Início', Icon: IconRadio },
  { id: 'videos', label: 'Vídeos', Icon: IconVideo },
  { id: 'chat', label: 'CHAT RCV', Icon: IconChat },
];

/**
 * Navegação principal. No celular é uma barra inferior flutuante;
 * no computador o CSS a transforma em uma pílula no topo.
 */
export function BottomNavigation({ current, onChange, liveBadge }: { current: Tab; onChange: (t: Tab) => void; liveBadge: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = TABS.findIndex((t) => t.id === current);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    onChange(TABS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <nav className="tabbar glass glass--strong" aria-label="Seções do app">
      <div className="tabbar__inner" role="tablist" onKeyDown={onKey} style={{ ['--i' as string]: index }}>
        <span className="tabbar__pill" aria-hidden="true" />
        {TABS.map(({ id, label, Icon }, i) => (
          <button
            key={id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={current === id}
            aria-controls={`panel-${id}`}
            tabIndex={current === id ? 0 : -1}
            className={`tabbar__btn ${current === id ? 'is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            <span className="tabbar__icon">
              <Icon />
              {id === 'videos' && liveBadge && <span className="tabbar__live" aria-label="Transmissão ao vivo agora" />}
            </span>
            <span className="tabbar__label">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
