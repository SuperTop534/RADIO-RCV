import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RadioController, retryDelay, MAX_ATTEMPTS } from '../src/services/radio.ts';

/** <audio> falso: registra quantas conexões foram abertas. */
class FakeAudio extends EventTarget {
  preload = '';
  paused = true;
  error: { code: number } | null = null;
  loads = 0;
  connections = 0;
  private attrs = new Map<string, string>();
  playImpl: () => Promise<void> = async () => { this.paused = false; };
  set src(v: string) { this.connections++; this.attrs.set('src', v); }
  get src() { return this.attrs.get('src') ?? ''; }
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  getAttribute(k: string) { return this.attrs.get(k) ?? null; }
  removeAttribute(k: string) { this.attrs.delete(k); }
  load() { this.loads++; }
  play() { return this.playImpl(); }
  pause() { this.paused = true; }
  emit(type: string) { this.dispatchEvent(new Event(type)); }
}

const URL_ = 'https://stm12.voxhd.com.br:13010/stream//';
const make = () => {
  const audio = new FakeAudio();
  const radio = new RadioController(URL_, { audio: audio as unknown as HTMLAudioElement });
  return { audio, radio };
};
const flush = () => new Promise((r) => setImmediate(r));

test('intervalo progressivo com teto de 30s', () => {
  const zero = () => 0;
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((a) => retryDelay(a, zero)), [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  assert.ok(retryDelay(3, () => 1) <= 4800);
});

test('play usa o streaming oficial e só mostra "tocando" após o evento real', async () => {
  const { audio, radio } = make();
  radio.play();
  assert.equal(audio.src, URL_);
  assert.equal(radio.getSnapshot().status, 'connecting');
  await flush();
  assert.equal(radio.getSnapshot().status, 'connecting', 'play() resolvido não basta');
  audio.emit('playing');
  assert.equal(radio.getSnapshot().status, 'playing');
  radio.pause();
});

test('toques repetidos não abrem várias conexões', async () => {
  const { audio, radio } = make();
  radio.play(); radio.play(); radio.play();
  await flush();
  assert.equal(audio.connections, 1);
  audio.emit('playing');
  radio.play();
  assert.equal(audio.connections, 1);
  radio.pause();
});

test('pausar encerra o download e libera a conexão', async () => {
  const { audio, radio } = make();
  radio.play(); audio.emit('playing');
  radio.pause();
  assert.equal(audio.getAttribute('src'), null);
  assert.equal(radio.getSnapshot().status, 'paused');
});

test('erro de rede → reconecta com limite de tentativas', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { audio, radio } = make();
    radio.play();
    audio.emit('error');
    assert.equal(radio.getSnapshot().status, 'reconnecting');
    assert.equal(radio.getSnapshot().attempt, 1);
    // A cada nova conexão o servidor continua fora: falha por erro ou por tempo esgotado
    let last = 1;
    for (let i = 0; i < 2000 && radio.getSnapshot().status !== 'error'; i++) {
      mock.timers.tick(1000);
      const s = radio.getSnapshot();
      if (s.status === 'connecting' || s.status === 'reconnecting') {
        assert.ok(s.attempt >= last && s.attempt <= MAX_ATTEMPTS);
        last = s.attempt;
      }
    }
    assert.equal(radio.getSnapshot().status, 'error');
    assert.equal(radio.getSnapshot().attempt, MAX_ATTEMPTS);
    assert.equal(audio.connections, MAX_ATTEMPTS + 1, '1 conexão inicial + 1 por tentativa');
    assert.equal(audio.getAttribute('src'), null, 'não fica tentando para sempre');
  } finally {
    mock.timers.reset();
  }
});

test('reconexão bem-sucedida zera o contador', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { audio, radio } = make();
    radio.play();
    audio.emit('error');
    mock.timers.tick(2000);
    audio.emit('playing');
    const s = radio.getSnapshot();
    assert.equal(s.status, 'playing');
    assert.equal(s.attempt, 0);
    radio.pause();
  } finally {
    mock.timers.reset();
  }
});

test('reprodução automática bloqueada pede um toque (sem fingir que toca)', async () => {
  const { audio, radio } = make();
  audio.playImpl = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  radio.play();
  await flush();
  assert.equal(radio.getSnapshot().status, 'blocked');
  assert.equal(radio.isActive, false);
});

test('pausa vinda do sistema (ligação, fone) atualiza o estado', () => {
  const { audio, radio } = make();
  radio.play(); audio.emit('playing');
  audio.emit('pause');
  assert.equal(radio.getSnapshot().status, 'paused');
});
