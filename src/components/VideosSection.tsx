import { useEffect, useMemo, useState } from 'react';
import type { LiveInfo, VideoItem } from '../../shared/types.ts';
import { useYouTube } from '../hooks/useStores.ts';
import { youtube, CHANNEL_URL } from '../services/youtube.ts';
import { radio } from '../services/radioInstance.ts';
import { LiveVideo } from './LiveVideo.tsx';
import { VideoList } from './VideoList.tsx';
import { IconExternal, IconInfo, IconRefresh } from './Icons.tsx';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/**
 * Lives e vídeos do canal. `embedded` = exibida abaixo da rádio na tela inicial.
 * Tudo é assistido aqui mesmo (player incorporado), sem sair para o YouTube.
 */
export function VideosSection({ notify, embedded = false }: { notify: (msg: string) => void; embedded?: boolean }) {
  const { data, loading, error, fromCache } = useYouTube();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoStartId, setAutoStartId] = useState<string | null>(null);

  // Ao abrir a aba, atualiza se os dados estiverem desatualizados
  useEffect(() => {
    if (youtube.isStale()) void youtube.refresh(true);
  }, []);

  const live = data?.live ?? null;
  const videos = data?.videos ?? [];
  const selected: VideoItem | LiveInfo | null = useMemo(() => {
    if (selectedId) return (live?.id === selectedId ? live : videos.find((v) => v.id === selectedId)) ?? null;
    return live;
  }, [selectedId, live, videos]);

  const onStartWatching = () => {
    if (radio.isActive) {
      radio.pause();
      notify('Rádio pausada para você assistir ao vídeo.');
    }
  };

  const select = (id: string) => {
    setSelectedId(id);
    setAutoStartId(id); // tocou no vídeo da lista: já começa a tocar no player do site
    requestAnimationFrame(() => document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const updated = data?.lastLiveCheckAt ?? data?.lastVideosAt;

  return (
    <section className={`videos ${embedded ? 'videos--embedded' : ''}`} aria-labelledby="videos-title">
      <header className="section-head">
        <div>
          <p className="eyebrow">{live ? 'Ao vivo agora no canal' : 'YouTube • RCV ESTÚDIO-RÁDIO'}</p>
          {embedded
            ? <h2 id="videos-title" className="section-title section-title--sm">Vídeos e lives</h2>
            : <h1 id="videos-title" className="section-title">Vídeos</h1>}
        </div>
        <button
          type="button"
          className={`iconbtn glass ${loading ? 'is-spinning' : ''}`}
          onClick={() => void youtube.refresh(true)}
          disabled={loading}
          aria-label="Atualizar vídeos"
        >
          <IconRefresh />
        </button>
      </header>

      {data && (data.liveCheck !== 'ok' || data.message) && (
        <p className="notice glass" role="note">
          <IconInfo />
          <span>
            {data.liveCheck === 'unconfigured' && 'A verificação de transmissão ao vivo está temporariamente indisponível. '}
            {data.message ?? (data.liveCheck === 'error' ? 'A verificação de transmissão ao vivo está temporariamente indisponível.' : '')}
          </span>
        </p>
      )}

      <div id="featured" className="featured-anchor">
        {selected ? (
          <LiveVideo
            key={selected.id}
            video={selected}
            isLive={Boolean(live && selected.id === live.id)}
            onStart={onStartWatching}
            autoStart={autoStartId === selected.id}
            onBackToLive={live && selected.id !== live.id ? () => { setSelectedId(null); setAutoStartId(live.id); } : undefined}
          />
        ) : !data && loading ? (
          <div className="featured featured--skeleton glass" aria-busy="true" aria-label="Carregando" />
        ) : null}
      </div>

      {(error && !data) ? (
        <div className="empty glass">
          <p>{error}</p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={() => void youtube.refresh(true)}>Tentar novamente</button>
            <a className="btn btn--glass" href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">Abrir canal <IconExternal /></a>
          </div>
        </div>
      ) : (
        <>
          <div className="list-head">
            <h2 className="list-title">{live ? 'Vídeos publicados' : 'Últimos vídeos'}</h2>
            {updated && (
              <span className="list-meta">
                {fromCache && !youtube.getSnapshot().fetchedAt ? 'Salvo em ' : 'Atualizado às '}
                {timeFmt.format(new Date(updated))}
              </span>
            )}
          </div>
          <VideoList videos={videos} selectedId={selected?.id ?? null} onSelect={select} loading={loading && !data} />
          {data && videos.length === 0 && !loading && (
            <div className="empty glass">
              <p>Nenhum vídeo disponível no momento.</p>
              <a className="btn btn--glass" href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">Ver canal no YouTube <IconExternal /></a>
            </div>
          )}
          {error && data && <p className="list-error">{error} Mostrando a última lista salva.</p>}
        </>
      )}

      <a className="channel-link glass" href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">
        <span>Inscreva-se no canal <strong>@rcvestudioradio4570</strong></span>
        <IconExternal />
      </a>
    </section>
  );
}
