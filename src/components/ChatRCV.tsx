import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  buildWhatsAppUrl, composeMessage, formatPhoneBR,
  MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, DEFAULT_WHATSAPP_NUMBER,
} from '../services/whatsapp.ts';
import { IconInfo, IconWhatsApp } from './Icons.tsx';

const NAME_KEY = 'rcv:chat-name';

/** Abre o WhatsApp de forma compatível com navegadores e PWA instalados. */
function openWhatsApp(url: string) {
  const w = window.open(url, '_blank');
  if (w) {
    try { w.opener = null; } catch { /* ignore */ }
  } else {
    window.location.href = url; // pop-up bloqueado: segue na mesma janela
  }
}

export function ChatRCV({ number = DEFAULT_WHATSAPP_NUMBER }: { number?: string }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<'compose' | 'sending' | 'handoff'>('compose');
  const [touched, setTouched] = useState(false);
  const [lastUrl, setLastUrl] = useState('');
  const ids = { name: useId(), msg: useId(), help: useId(), err: useId() };

  useEffect(() => {
    try { setName(localStorage.getItem(NAME_KEY) ?? ''); } catch { /* ignore */ }
  }, []);

  const empty = message.trim().length === 0;
  const showError = touched && empty;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (empty || phase === 'sending') return;
    const url = buildWhatsAppUrl(number, composeMessage(message, name));
    setLastUrl(url);
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
    setPhase('sending');
    // Abre já no gesto do usuário (evita bloqueio de pop-up)
    if (!__PREVIEW__) openWhatsApp(url);
    window.setTimeout(() => setPhase('handoff'), 700);
  };

  const reset = () => {
    setMessage('');
    setTouched(false);
    setPhase('compose');
  };

  return (
    <section className="chat" aria-labelledby="chat-title">
      <header className="section-head">
        <div>
          <p className="eyebrow">Fale com a gente</p>
          <h1 id="chat-title" className="section-title">CHAT RCV</h1>
        </div>
        <span className="wa-badge" aria-hidden="true"><IconWhatsApp /></span>
      </header>

      <div className="chat__welcome glass">
        <p>
          Olá, ouvinte! Mande seu recado, pedido de música ou alô para a <strong>RCV Estúdio Rádio</strong>.
        </p>
      </div>

      {phase === 'handoff' ? (
        <div className="chat__card glass glass--strong handoff" role="status" aria-live="polite">
          <span className="handoff__icon" aria-hidden="true"><IconWhatsApp /></span>
          <h2>Conclua o envio no WhatsApp</h2>
          <p>
            Abrimos o WhatsApp com sua mensagem pronta para <strong className="nowrap">{formatPhoneBR(number)}</strong>.
            Ela só chega à rádio depois que você tocar em <strong>enviar</strong> por lá.
          </p>
          <div className="handoff__actions">
            <a className="btn btn--wa" href={lastUrl} target="_blank" rel="noopener noreferrer">
              <IconWhatsApp /> Abrir o WhatsApp de novo
            </a>
            <button type="button" className="btn btn--glass" onClick={reset}>Escrever outra mensagem</button>
          </div>
        </div>
      ) : (
        <form className="chat__card glass glass--strong" onSubmit={submit} noValidate>
          <label className="field">
            <span className="field__label" id={ids.name}>Seu nome ou apelido <em>(opcional)</em></span>
            <input
              className="field__input"
              aria-labelledby={ids.name}
              type="text"
              name="name"
              autoComplete="nickname"
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Maria de Londrina"
            />
          </label>

          <label className="field">
            <span className="field__label" id={ids.msg}>Sua mensagem</span>
            <textarea
              className={`field__input field__textarea ${showError ? 'is-invalid' : ''}`}
              aria-labelledby={ids.msg}
              aria-describedby={showError ? ids.err : ids.help}
              aria-invalid={showError}
              aria-required="true"
              name="message"
              rows={5}
              maxLength={MAX_MESSAGE_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => message && setTouched(true)}
              placeholder="Escreva seu recado, pedido de música ou alô…"
            />
            <span className="field__foot">
              {showError
                ? <span id={ids.err} className="field__error">Escreva uma mensagem antes de enviar.</span>
                : <span />}
              <span className="field__count" aria-hidden="true">{message.length}/{MAX_MESSAGE_LENGTH}</span>
            </span>
          </label>

          <p className="chat__note" id={ids.help}>
            <IconInfo />
            <span>Ao tocar em enviar, o <strong>WhatsApp</strong> será aberto com sua mensagem pronta. Para concluir, confirme o envio por lá.</span>
          </p>

          <button type="submit" className={`btn btn--wa btn--block ${phase === 'sending' ? 'is-sending' : ''}`} disabled={phase === 'sending'}>
            {phase === 'sending' ? <span className="btn__spinner" aria-hidden="true" /> : <IconWhatsApp />}
            {phase === 'sending' ? 'Abrindo o WhatsApp…' : 'Enviar mensagem'}
          </button>
        </form>
      )}

      <p className="chat__alt">
        Prefere chamar direto? <a href={buildWhatsAppUrl(number, '')} target="_blank" rel="noopener noreferrer">{formatPhoneBR(number)}</a>
      </p>
    </section>
  );
}
