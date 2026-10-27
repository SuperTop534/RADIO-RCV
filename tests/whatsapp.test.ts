import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppUrl, composeMessage, normalizePhone, formatPhoneBR } from '../src/services/whatsapp.ts';

test('normaliza o número oficial em qualquer formato', () => {
  assert.equal(normalizePhone('+55 43 98419-5925'), '5543984195925');
  assert.equal(normalizePhone('http://wa.me//+5543984195925'), '5543984195925');
  assert.equal(normalizePhone('5543984195925'), '5543984195925');
});

test('gera link wa.me válido com a mensagem codificada', () => {
  const url = buildWhatsAppUrl('+55 43 98419-5925', 'Olá & bom dia! Música #1 ção?');
  assert.equal(url, 'https://wa.me/5543984195925?text=Ol%C3%A1%20%26%20bom%20dia!%20M%C3%BAsica%20%231%20%C3%A7%C3%A3o%3F');
  const back = new URL(url).searchParams.get('text');
  assert.equal(back, 'Olá & bom dia! Música #1 ção?');
});

test('sem texto, abre só a conversa', () => {
  assert.equal(buildWhatsAppUrl('5543984195925', ''), 'https://wa.me/5543984195925');
});

test('quebras de linha e emojis chegam intactos', () => {
  const text = composeMessage('Manda um alô 🎶\npara Londrina', '  Maria  ');
  const url = buildWhatsAppUrl('5543984195925', text);
  assert.equal(new URL(url).searchParams.get('text'), text);
  assert.match(text, /^Olá, RCV! Aqui é Maria\.\n\nManda um alô 🎶\npara Londrina/);
});

test('nome é opcional', () => {
  assert.match(composeMessage('Oi'), /^Olá, RCV!\n\nOi/);
});

test('formata o número para exibição', () => {
  assert.equal(formatPhoneBR('5543984195925'), '+55 (43) 98419-5925');
});
