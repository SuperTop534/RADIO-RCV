import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true, focusable: false, ...p,
});

export const IconPlay = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6Z" /></svg>
);
export const IconPause = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><rect x="6" y="5" width="4.2" height="14" rx="1.3" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.3" /></svg>
);
export const IconRadio = (p: P) => (
  <svg {...base(p)}><path d="M4.9 16.1a9 9 0 0 1 0-12.2" /><path d="M7.8 13.2a5 5 0 0 1 0-6.4" /><circle cx="12" cy="10" r="1.6" /><path d="M16.2 6.8a5 5 0 0 1 0 6.4" /><path d="M19.1 3.9a9 9 0 0 1 0 12.2" /><path d="M12 12v8.5" /><path d="M9 20.5h6" /></svg>
);
export const IconVideo = (p: P) => (
  <svg {...base(p)}><rect x="2.8" y="5" width="18.4" height="14" rx="4" /><path d="m10.2 9.2 4.6 2.8-4.6 2.8Z" fill="currentColor" /></svg>
);
export const IconChat = (p: P) => (
  <svg {...base(p)}><path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.4l1.5-4.4a8.4 8.4 0 1 1 15.5-4.4Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.6" /></svg>
);
export const IconWhatsApp = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12.04 2.5a9.45 9.45 0 0 0-8.13 14.26L2.5 21.5l4.86-1.38A9.45 9.45 0 1 0 12.04 2.5Zm0 17.2a7.74 7.74 0 0 1-3.95-1.08l-.28-.17-2.88.82.84-2.8-.19-.3a7.75 7.75 0 1 1 6.46 3.53Zm4.25-5.8c-.23-.12-1.38-.68-1.6-.76-.21-.08-.37-.12-.52.12-.16.23-.6.75-.74.9-.13.16-.27.18-.5.06a6.35 6.35 0 0 1-3.15-2.76c-.24-.41.24-.38.68-1.27.08-.15.04-.29-.02-.4-.06-.12-.52-1.26-.72-1.72-.19-.45-.38-.39-.52-.4h-.45a.86.86 0 0 0-.62.3 2.6 2.6 0 0 0-.81 1.93 4.5 4.5 0 0 0 .95 2.4 10.35 10.35 0 0 0 3.97 3.5c1.47.64 2.05.69 2.79.58.45-.07 1.38-.56 1.57-1.11.2-.55.2-1.02.14-1.12-.06-.1-.21-.16-.45-.27Z" />
  </svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)}><path d="M14 4h6v6" /><path d="M20 4 10.5 13.5" /><path d="M19 14v4.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5H10" /></svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base(p)}><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20.5V16h-4.5" /></svg>
);
export const IconSend = (p: P) => (
  <svg {...base(p)}><path d="M21 3 10.5 13.5" /><path d="M21 3 14.5 21l-4-7.5L3 9.5Z" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6h.01" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M12 3.5v11" /><path d="m7.5 10 4.5 4.5 4.5-4.5" /><path d="M4.5 19.5h15" /></svg>
);
