/** Cache local simples (localStorage) com tolerância a navegação privada/armazenamento bloqueado. */

interface Entry<T> { savedAt: number; value: T }

export function readCache<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem(`rcv:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    return typeof parsed?.savedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`rcv:${key}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch { /* armazenamento indisponível: segue sem cache */ }
}
