import { useEffect, useState } from 'react';
import { IconClose, IconDownload } from './Icons.tsx';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'rcv:install-dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Convite discreto para instalar o app. No Android/Chrome usa o prompt nativo;
 * no iPhone explica o caminho "Compartilhar → Adicionar à Tela de Início".
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try { dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now(); } catch { /* ignore */ }
    if (dismissed) return;

    const onBIP = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); setHidden(false); };
    window.addEventListener('beforeinstallprompt', onBIP);
    let t = 0;
    if (isIOS()) t = window.setTimeout(() => { setShowIOS(true); setHidden(false); }, 8000);
    return () => { window.removeEventListener('beforeinstallprompt', onBIP); window.clearTimeout(t); };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 86400_000)); } catch { /* ignore */ }
  };

  if (hidden || (!evt && !showIOS)) return null;

  return (
    <div className="install glass glass--strong" role="dialog" aria-label="Instalar o app">
      <img src="icons/icon-192.png" alt="" width={40} height={40} />
      <p>
        {evt
          ? <>Instale o app da <strong>RCV</strong> e ouça com um toque.</>
          : <>No iPhone: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</>}
      </p>
      {evt && (
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={async () => { await evt.prompt(); await evt.userChoice.catch(() => null); setEvt(null); setHidden(true); }}
        >
          <IconDownload /> Instalar
        </button>
      )}
      <button type="button" className="iconbtn iconbtn--plain" onClick={dismiss} aria-label="Fechar"><IconClose /></button>
    </div>
  );
}
