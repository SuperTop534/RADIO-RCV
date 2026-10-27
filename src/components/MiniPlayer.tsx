import { STATUS_LABEL } from '../services/radio.ts';
import { useRadio } from '../hooks/useStores.ts';
import { PlayButton } from './RadioPlayer.tsx';
import { Equalizer } from './Equalizer.tsx';

/** Barra compacta do rádio visível nas outras abas (o áudio nunca é recriado). */
export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const snap = useRadio();
  const playing = snap.status === 'playing';
  return (
    <div className="mini glass glass--strong" role="region" aria-label="Rádio">
      <button type="button" className="mini__info" onClick={onOpen} aria-label="Abrir o player da rádio">
        <img className="mini__art" src="icons/icon-192.png" alt="" width={44} height={44} />
        <span className="mini__text">
          <strong>RCV Estúdio Rádio</strong>
          <small className={`statusline statusline--${snap.status}`}>
            {playing && <span className="mini__dot" aria-hidden="true" />}
            {playing ? 'Ao vivo agora' : STATUS_LABEL[snap.status]}
          </small>
        </span>
      </button>
      <Equalizer active={playing} bars={5} compact />
      <PlayButton size="sm" />
    </div>
  );
}
