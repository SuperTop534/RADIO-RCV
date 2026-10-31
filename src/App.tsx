import { useCallback, useEffect, useRef, useState } from 'react';
import { SplashScreen } from './components/SplashScreen.tsx';
import { BottomNavigation, TABS, type Tab } from './components/BottomNavigation.tsx';
import { RadioPlayer } from './components/RadioPlayer.tsx';
import { MiniPlayer } from './components/MiniPlayer.tsx';
import { VideosSection } from './components/VideosSection.tsx';
import { ChatRCV } from './components/ChatRCV.tsx';
import { Toast, useToast } from './components/Toast.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useYouTube } from './hooks/useStores.ts';
import { youtube } from './services/youtube.ts';
import { loadPublicConfig } from './services/radioInstance.ts';
import { DEFAULT_WHATSAPP_NUMBER } from './services/whatsapp.ts';

const HASH: Record<string, Tab> = { '#inicio': 'inicio', '#videos': 'videos', '#chat': 'chat' };
const tabFromHash = (): Tab => HASH[window.location.hash] ?? 'inicio';

export function App() {
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [waNumber, setWaNumber] = useState(DEFAULT_WHATSAPP_NUMBER);
  const { msg, notify, dismiss } = useToast();
  const yt = useYouTube();
  const mainRef = useRef<HTMLElement>(null);

  const endSplash = useCallback(() => setSplash(false), []);

  // Navegação por hash: o botão "voltar" do celular funciona entre as abas
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((t: Tab) => {
    if (t === tabFromHash() && window.location.hash) return;
    window.location.hash = t;
    setTab(t);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    void loadPublicConfig().then((cfg) => {
      if (cfg?.whatsappNumber) setWaNumber(cfg.whatsappNumber);
    });
    // Estado do YouTube carregado em segundo plano: uma falha aqui não afeta o rádio
    void youtube.refresh();
    youtube.startPolling();
  }, []);

  useEffect(() => {
    const t = TABS.find((x) => x.id === tab);
    document.title = tab === 'inicio' ? 'RCV Estúdio Rádio — Ao vivo' : `${t?.label} • RCV Estúdio Rádio`;
  }, [tab]);

  const liveNow = Boolean(yt.data?.live);

  return (
    <>
      <div className="backdrop" aria-hidden="true" />

      <div className={`shell shell--${tab} ${splash ? 'shell--behind' : 'shell--ready'}`} aria-hidden={splash}>
        <a className="skip" href="#conteudo">Pular para o conteúdo</a>

        <header className="topbar">
          <button type="button" className="topbar__brand" onClick={() => navigate('inicio')} aria-label="RCV Estúdio Rádio — início">
            <img src="icons/icon-192.png" alt="" width={36} height={36} />
            <span>RCV <em>Estúdio Rádio</em></span>
          </button>
          <BottomNavigation current={tab} onChange={navigate} liveBadge={liveNow} />
        </header>

        <main id="conteudo" ref={mainRef} tabIndex={-1} className={`main main--${tab}`}>
          <div key={tab} id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="panel">
            {tab === 'inicio' && <RadioPlayer onNavigate={navigate} />}
            {tab === 'videos' && (
              <ErrorBoundary fallback="Não foi possível exibir os vídeos agora. O rádio e o CHAT RCV continuam funcionando.">
                <VideosSection notify={notify} />
              </ErrorBoundary>
            )}
            {tab === 'chat' && (
              <ErrorBoundary fallback="Não foi possível exibir o CHAT RCV agora.">
                <ChatRCV number={waNumber} />
              </ErrorBoundary>
            )}
          </div>
        </main>

        {tab !== 'inicio' && <MiniPlayer onOpen={() => navigate('inicio')} />}
        <InstallPrompt />
        <Toast msg={msg} onDismiss={dismiss} />
      </div>

      {splash && <SplashScreen onDone={endSplash} />}
    </>
  );
}
