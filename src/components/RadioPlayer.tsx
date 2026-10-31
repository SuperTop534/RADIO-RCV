import { useEffect, useState } from 'react';
import { radio } from '../services/radioInstance.ts';
import { STATUS_LABEL, type RadioSnapshot } from '../services/radio.ts';
import { useRadio } from '../hooks/useStores.ts';
import { Equalizer } from './Equalizer.tsx';
import { Logo3D } from './Logo3D.tsx';
import { IconChat, IconPause, IconPlay, IconVideo } from './Icons.tsx';
import type { Tab } from './BottomNavigation.tsx';
import { useYouTube } from '../hooks/useStores.ts';

export const isActiveStatus = (s: RadioSnapshot['status']) =>
  s === 'connecting' || s === 'playing' || s === 'buffering' || s === 'reconnecting';

function useCountdown(target: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [target]);
  return target ? Math.max(0, Math.ceil((target - now) / 1000)) : null;
}

export function PlayButton({ size = 'xl' }: { size?: 'xl' | 'sm' }) {
  const snap = useRadio();
  const active = isActiveStatus(snap.status);
  const loading = snap.status === 'connecting' || snap.status === 'reconnecting' || snap.status === 'buffering';
  const label = active ? 'Pausar a rádio' : 'Ouvir a rádio ao vivo';
  return (
    <button
      type="button"
      className={`playbtn playbtn--${size} ${active ? 'is-active' : ''} ${loading ? 'is-loading' : ''} ${snap.status === 'playing' ? 'is-playing' : ''}`}
      onClick={() => radio.toggle()}
      aria-label={label}
      aria-pressed={active}
    >
      <span className="playbtn__ring" aria-hidden="true" />
      <span className="playbtn__core">
        {active ? <IconPause /> : <IconPlay className="playbtn__playicon" />}
      </span>
      {loading && <span className="playbtn__spinner" aria-hidden="true" />}
    </button>
  );
}

/** Tela inicial: só a rádio. Vídeos e CHAT RCV ficam nas próprias abas (atalhos abaixo do player). */
export function RadioPlayer({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const snap = useRadio();
  const liveNow = Boolean(useYouTube().data?.live);
  const secs = useCountdown(snap.status === 'reconnecting' ? snap.nextRetryAt : null);
  const playing = snap.status === 'playing';

  let detail: string | null = null;
  if (snap.status === 'reconnecting') {
    detail = secs ? `Nova tentativa em ${secs}s (${snap.attempt}/${snap.maxAttempts})` : `Tentativa ${snap.attempt}/${snap.maxAttempts}`;
  } else if (snap.status === 'error' && snap.errorMessage === 'preview') {
    detail = 'Nesta prévia o áudio da rádio é bloqueado. Use o link abaixo para ouvir o streaming real.';
  } else if (snap.status === 'error') {
    detail = 'Não conseguimos conectar à transmissão. Verifique sua internet e tente novamente.';
  } else if (snap.status === 'blocked') {
    detail = 'Seu navegador pediu uma confirmação para tocar áudio.';
  } else if (snap.status === 'offline') {
    detail = 'A rádio volta automaticamente quando a internet retornar.';
  } else if (snap.status === 'idle' || snap.status === 'paused') {
    detail = 'Volume pelos botões do seu aparelho ou pelo sistema.';
  }

  return (
    <section className="home" aria-labelledby="home-title">
      <div className="home__brand">
        <Logo3D size="hero" eager />
      </div>

      <div className="player glass glass--strong">
        <div className="player__top">
          <h1 id="home-title" className="player__title">RCV ESTÚDIO RÁDIO</h1>
          <span className={`livechip ${playing ? 'livechip--on' : ''}`}>
            <span className="livechip__dot" aria-hidden="true" />
            {playing ? 'AO VIVO' : 'RÁDIO ONLINE'}
          </span>
        </div>

        <div className="player__center">
          <PlayButton />
          <Equalizer active={playing} />
        </div>

        <div className="player__status" role="status" aria-live="polite">
          <strong className={`statusline statusline--${snap.status}`}>{snap.errorMessage === 'preview' ? 'Áudio desativado nesta prévia' : STATUS_LABEL[snap.status]}</strong>
          {detail && <span className="player__detail">{detail}</span>}
          {__PREVIEW__ && (
            <a className="btn btn--primary btn--sm" href={radio.streamUrl} target="_blank" rel="noopener noreferrer">
              Ouvir o streaming real
            </a>
          )}
          {snap.status === 'error' && !__PREVIEW__ && (
            <button type="button" className="btn btn--glass btn--sm" onClick={() => radio.play()}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>

      <nav className="quicklinks" aria-label="Atalhos">
        <button type="button" className="quick glass" onClick={() => onNavigate('videos')}>
          <span className="quick__icon quick__icon--yt"><IconVideo /></span>
          <span className="quick__text">
            <strong>Vídeos</strong>
            {liveNow
              ? <small className="quick__live"><span className="livechip__dot" aria-hidden="true" /> AO VIVO agora</small>
              : <small>Lives e vídeos do canal</small>}
          </span>
        </button>
        <button type="button" className="quick glass" onClick={() => onNavigate('chat')}>
          <span className="quick__icon quick__icon--wa"><IconChat /></span>
          <span className="quick__text"><strong>CHAT RCV</strong><small>Fale com a rádio</small></span>
        </button>
      </nav>
    </section>
  );
}
