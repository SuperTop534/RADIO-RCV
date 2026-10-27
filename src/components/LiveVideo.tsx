import { useEffect, useState } from 'react';
import type { LiveInfo, VideoItem } from '../../shared/types.ts';
import { embedUrl } from '../services/youtube.ts';
import { IconExternal, IconPlay } from './Icons.tsx';

interface Props {
  video: VideoItem | LiveInfo;
  isLive: boolean;
  onStart: () => void;
  onBackToLive?: () => void;
  /** começa a tocar sem precisar tocar na capa (vídeo escolhido na lista) */
  autoStart?: boolean;
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/**
 * Destaque da seção: a live ativa (prioridade) ou o vídeo escolhido.
 * Mostra a capa primeiro e só carrega o player do YouTube ao tocar —
 * economiza dados e permite pausar a rádio antes do vídeo começar.
 */
export function LiveVideo({ video, isLive, onStart, onBackToLive, autoStart = false }: Props) {
  const blocked = video.embeddable === false;
  const [playing, setPlaying] = useState(autoStart && !blocked);
  const live = isLive ? (video as LiveInfo) : null;

  // o vídeo escolhido na lista começa direto: pausa a rádio uma única vez
  useEffect(() => {
    if (autoStart && !blocked) onStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (blocked) return;
    onStart();
    setPlaying(true);
  };

  return (
    <article className={`featured glass glass--strong ${isLive ? 'featured--live' : ''}`} aria-label={isLive ? 'Transmissão ao vivo' : 'Vídeo selecionado'}>
      <div className="featured__media">
        {playing ? (
          <iframe
            src={embedUrl(video.id, { autoplay: true })}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button type="button" className="featured__poster" onClick={start} disabled={blocked} aria-label={blocked ? undefined : `Assistir: ${video.title}`}>
            <img src={video.thumbnail} alt="" loading="lazy" decoding="async" />
            <span className="featured__scrim" aria-hidden="true" />
            {!blocked && <span className="featured__play" aria-hidden="true"><IconPlay /></span>}
            {isLive && <span className="livebadge"><span className="livechip__dot" />AO VIVO</span>}
            {blocked && (
              <span className="featured__blocked">Este vídeo só pode ser assistido no YouTube.</span>
            )}
          </button>
        )}
      </div>
      <div className="featured__body">
        <h2 className="featured__title">{video.title}</h2>
        <p className="featured__meta">
          {live?.startedAt
            ? `Ao vivo desde ${timeFmt.format(new Date(live.startedAt))}`
            : video.publishedAt ? `Publicado em ${dateFmt.format(new Date(video.publishedAt))}` : null}
          {live?.concurrentViewers != null && ` • ${live.concurrentViewers.toLocaleString('pt-BR')} assistindo`}
        </p>
        <div className="featured__actions">
          {blocked && (
            // só quando o dono do vídeo desativou a reprodução fora do YouTube
            <a className="btn btn--primary btn--sm" href={video.url} target="_blank" rel="noopener noreferrer">
              Assistir no YouTube <IconExternal />
            </a>
          )}
          {onBackToLive && (
            <button type="button" className="btn btn--live btn--sm" onClick={onBackToLive}>
              <span className="livechip__dot" aria-hidden="true" /> Voltar para a live
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
