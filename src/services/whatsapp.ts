/** Integração honesta com o WhatsApp: abre a conversa com a mensagem preenchida. */

export const DEFAULT_WHATSAPP_NUMBER = '5543984195925';
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_NAME_LENGTH = 60;

/** Normaliza qualquer formato (+55 43 98419-5925, http://wa.me//+55…) para só dígitos. */
export function normalizePhone(input: string): string {
  return input.replace(/^https?:\/\/wa\.me\/+/i, '').replace(/\D/g, '');
}

export function composeMessage(message: string, name?: string): string {
  const body = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  const who = (name ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  const header = who ? `Olá, RCV! Aqui é ${who}.` : 'Olá, RCV!';
  return `${header}\n\n${body}\n\n— Enviado pelo app RCV Estúdio Rádio`;
}

/** https://wa.me/5543984195925?text=... (abre o app ou o WhatsApp Web automaticamente) */
export function buildWhatsAppUrl(number: string, text: string): string {
  const phone = normalizePhone(number) || DEFAULT_WHATSAPP_NUMBER;
  const base = `https://wa.me/${phone}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function formatPhoneBR(number: string): string {
  const d = normalizePhone(number);
  const m = /^55(\d{2})(\d{5})(\d{4})$/.exec(d);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${d}`;
}
