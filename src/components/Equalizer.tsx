/**
 * Equalizador decorativo: só se move quando o áudio está realmente tocando.
 * Não representa o sinal (o streaming é de outra origem e não é analisado).
 */
export function Equalizer({ active, bars = 24, compact = false }: { active: boolean; bars?: number; compact?: boolean }) {
  return (
    <div className={`eq ${active ? 'eq--on' : ''} ${compact ? 'eq--compact' : ''}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        // alturas e ritmos pseudoaleatórios, estáveis entre renderizações
        const seed = Math.sin(i * 12.9898) * 43758.5453;
        const r = seed - Math.floor(seed);
        const center = 1 - Math.abs(i - (bars - 1) / 2) / (bars / 2);
        return (
          <span
            key={i}
            style={{
              ['--h' as string]: (0.35 + 0.65 * (0.45 * r + 0.55 * center)).toFixed(2),
              ['--d' as string]: `${(0.7 + r * 0.7).toFixed(2)}s`,
              ['--delay' as string]: `${(-r * 1.2).toFixed(2)}s`,
            }}
          />
        );
      })}
    </div>
  );
}
