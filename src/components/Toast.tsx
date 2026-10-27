import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(0);
  const notify = useCallback((m: string) => {
    window.clearTimeout(timer.current);
    setMsg(m);
    timer.current = window.setTimeout(() => setMsg(null), 3600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { msg, notify, dismiss: () => setMsg(null) };
}

export function Toast({ msg, onDismiss }: { msg: string | null; onDismiss: () => void }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {msg && (
        <button type="button" className="toast glass glass--strong" onClick={onDismiss}>
          {msg}
        </button>
      )}
    </div>
  );
}
