/**
 * Agendamento diário em fuso horário específico, sem dependências.
 * Usa Intl para converter "18:00 em America/Sao_Paulo" para o instante UTC correto,
 * inclusive se o fuso voltar a ter horário de verão no futuro.
 */

interface ZonedParts {
  year: number; month: number; day: number; hour: number; minute: number; second: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** Diferença (ms) entre o horário local do fuso e UTC em um instante. */
function tzOffsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Converte data/hora local de um fuso para o instante UTC. */
export function zonedTimeToUtc(
  year: number, month: number, day: number, hour: number, minute: number, timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ts = guess - tzOffsetMs(guess, timeZone);
  ts = guess - tzOffsetMs(ts, timeZone); // segunda passada corrige transições de horário de verão
  return new Date(ts);
}

export function parseHHMM(value: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`Horário inválido: "${value}" (use HH:MM)`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error(`Horário inválido: "${value}"`);
  return { hour, minute };
}

/** Próxima ocorrência estritamente posterior a `from` do horário HH:MM no fuso. */
export function nextDailyOccurrence(hhmm: string, timeZone: string, from = new Date()): Date {
  const { hour, minute } = parseHHMM(hhmm);
  const today = zonedParts(from, timeZone);
  let candidate = zonedTimeToUtc(today.year, today.month, today.day, hour, minute, timeZone);
  if (candidate.getTime() <= from.getTime()) {
    // "amanhã" no calendário local: soma um dia na data civil e recalcula
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
    candidate = zonedTimeToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, minute, timeZone);
  }
  return candidate;
}

export interface DailyJobHandle {
  stop(): void;
  next(): Date;
}

/**
 * Executa `task` todo dia no horário indicado. Reagenda a cada execução
 * (setTimeout tem limite de ~24,8 dias, então dividimos esperas longas).
 */
export function scheduleDaily(
  hhmm: string,
  timeZone: string,
  task: () => Promise<unknown> | unknown,
  log: (msg: string) => void = console.log,
): DailyJobHandle {
  let timer: NodeJS.Timeout | null = null;
  let nextRun = nextDailyOccurrence(hhmm, timeZone);
  let stopped = false;
  const MAX_WAIT = 6 * 60 * 60 * 1000;

  const arm = () => {
    if (stopped) return;
    const wait = Math.max(0, nextRun.getTime() - Date.now());
    timer = setTimeout(async () => {
      if (Date.now() + 1000 < nextRun.getTime()) return arm(); // ainda não chegou (espera dividida)
      log(`[agenda] verificação diária das ${hhmm} (${timeZone}) iniciada`);
      try {
        await task();
      } catch (err) {
        log(`[agenda] falha na verificação diária: ${(err as Error).message}`);
      }
      nextRun = nextDailyOccurrence(hhmm, timeZone, new Date(Date.now() + 1000));
      arm();
    }, Math.min(wait, MAX_WAIT));
    timer.unref?.();
  };
  arm();

  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
    next() { return nextRun; },
  };
}
