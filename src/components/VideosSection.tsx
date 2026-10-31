import { useEffect, useMemo, useState } from 'react';
import type { LiveInfo, VideoItem, YouTubeState } from '../../shared/types.ts';
import { useYouTube } from '../hooks/useStores.ts';
import { youtube, CHANNEL_URL } from '../services/youtube.ts';
import { radio } from '../services/radioInstance.ts';
import { LiveVideo } from './LiveVideo.tsx';
import { VideoList } from './VideoList.tsx';
import { IconExternal, IconInfo, IconRefresh } from './Icons.tsx';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/** Os dois catálogos do canal, na mesma ordem das abas do YouTube. */
export type CatalogId = 'videos' | 'streams';
const CATALOGS: { id: CatalogId; label: string; empty: string }[] = [
  { id: 'videos', label: 'Vídeos', empty: 'Nenhum vídeo publicado no catálogo Vídeos.' },
  { id: 'streams', label: 'Ao vivo', empty: 'Nenhuma transmissão encerrada no catálogo Ao vivo.' },
];
const CATALOG_KEY = 'rcv:catalogo';

/** Dados antigos (sem catálogos) caem inteiros em "Vídeos". */
export function catalogsOf(data: YouTubeState | null): Record<CatalogId, VideoItem[]> {
  if (!data) return { videos: [], streams: [] };
  return data.catalogs ?? { videos: data.videos ?? [], streams: [] };
}

function readCatalog(): CatalogId {
  try { return localStorage.getItem(CATALOG_KEY) === 'streams' ? 'streams' : 'videos'; } catch { return 'videos'; }
}

/**
 * Lives e vídeos do canal. `embedded` = exibida abaixo da rádio na tela inicial.
 * Tudo é assistido aqui mesmo (player incorporado), sem sair para o YouTube.
 */
export function VideosSection({ notify, embedded = false }: { notify: (msg: string) => void; embedded?: boolean }) {
  const { data, loading, error, fromCache } = useYouTube();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoStartId, setAutoStartId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogId>(readCatalog);

  // Ao abrir a aba, atualiza se os dados estiverem desatualizados
  useEffect(() => {
    if (youtube.isStale()) void youtube.refresh(true);
  }, []);

  const live = data?.live ?? null;
  const catalogs = useMemo(() => catalogsOf(data), [data]);
  const videos = catalogs[catalog];
  const selected: VideoItem | LiveInfo | null = useMemo(() => {
    if (!selectedId) return live;
    if (live?.id === selectedId) return live;
    return catalogs.videos.find((v) => v.id === selectedId) ?? catalogs.streams.find((v) => v.id === selectedId) ?? null;
  }, [selectedId, live, catalogs]);

  const chooseCatalog = (id: CatalogId) => {
    setCatalog(id);
    try { localStorage.setItem(CATALOG_KEY, id); } catch { /* ignore */ }
  };

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
            <CatalogTabs current={catalog} counts={{ videos: catalogs.videos.length, streams: catalogs.streams.length }} onChange={chooseCatalog} />
            {updated && (
              <span className="list-meta">
                {fromCache && !youtube.getSnapshot().fetchedAt ? 'Salvo em ' : 'Atualizado às '}
                {timeFmt.format(new Date(updated))}
              </span>
            )}
          </div>
          <div id={`catalogo-${catalog}`} role="tabpanel" aria-labelledby={`cat-${catalog}`} key={catalog} className="catalog-panel">
            <VideoList videos={videos} selectedId={selected?.id ?? null} onSelect={select} loading={loading && !data} />
          </div>
          {data && videos.length === 0 && !loading && (
            <div className="empty glass">
              <p>{CATALOGS.find((c) => c.id === catalog)?.empty}</p>
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

/** Seletor dos catálogos "Vídeos" e "Ao vivo" (como as abas do canal no YouTube). */
function CatalogTabs({ current, counts, onChange }: {
  current: CatalogId;
  counts: Record<CatalogId, number>;
  onChange: (id: CatalogId) => void;
}) {
  const index = CATALOGS.findIndex((c) => c.id === current);
  return (
    <div
      className="cattabs glass"
      role="tablist"
      aria-label="Catálogos do canal"
      style={{ ['--i' as string]: index }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = CATALOGS[(index + 1) % CATALOGS.length];
        onChange(next.id);
        document.getElementById(`cat-${next.id}`)?.focus();
      }}
    >
      <span className="cattabs__pill" aria-hidden="true" />
      {CATALOGS.map((c) => (
        <button
          key={c.id}
          id={`cat-${c.id}`}
          type="button"
          role="tab"
          aria-selected={current === c.id}
          aria-controls={`catalogo-${c.id}`}
          tabIndex={current === c.id ? 0 : -1}
          className={`cattabs__btn ${current === c.id ? 'is-active' : ''}`}
          onClick={() => onChange(c.id)}
        >
          {c.id === 'streams' && <span className="cattabs__dot" aria-hidden="true" />}
          {c.label}
          <span className="cattabs__count">{counts[c.id]}</span>
        </button>
      ))}
    </div>
  );
}
