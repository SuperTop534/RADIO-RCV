import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDailyOccurrence, zonedTimeToUtc, parseHHMM } from '../server/jobs/schedule.ts';

const TZ = 'America/Sao_Paulo';

test('18h00 de Brasília = 21h00 UTC', () => {
  assert.equal(zonedTimeToUtc(2026, 10, 27, 18, 0, TZ).toISOString(), '2026-10-27T21:00:00.000Z');
});

test('antes das 18h → hoje às 18h', () => {
  const from = new Date('2026-10-27T15:00:00-03:00');
  assert.equal(nextDailyOccurrence('18:00', TZ, from).toISOString(), '2026-10-27T21:00:00.000Z');
});

test('depois das 18h → amanhã às 18h', () => {
  const from = new Date('2026-10-27T19:35:00-03:00');
  assert.equal(nextDailyOccurrence('18:00', TZ, from).toISOString(), '2026-10-28T21:00:00.000Z');
});

test('exatamente às 18h → próxima é amanhã', () => {
  const from = new Date('2026-10-27T18:00:00-03:00');
  assert.equal(nextDailyOccurrence('18:00', TZ, from).toISOString(), '2026-10-28T21:00:00.000Z');
});

test('virada de mês e de ano', () => {
  assert.equal(nextDailyOccurrence('18:00', TZ, new Date('2026-12-31T20:00:00-03:00')).toISOString(), '2027-01-01T21:00:00.000Z');
  // 22h UTC do dia 31 ainda é dia 31 em Brasília (19h): próxima é 1º de janeiro
  assert.equal(nextDailyOccurrence('18:00', TZ, new Date('2026-12-31T22:00:00Z')).toISOString(), '2027-01-01T21:00:00.000Z');
});

test('servidor em outro fuso não altera o resultado (cálculo é por instante)', () => {
  const from = new Date('2026-10-28T02:30:00Z'); // 23h30 do dia 27 em Brasília
  assert.equal(nextDailyOccurrence('18:00', TZ, from).toISOString(), '2026-10-28T21:00:00.000Z');
});

test('horário inválido gera erro claro', () => {
  assert.throws(() => parseHHMM('25:00'));
  assert.throws(() => parseHHMM('18h'));
  assert.deepEqual(parseHHMM('08:05'), { hour: 8, minute: 5 });
});
