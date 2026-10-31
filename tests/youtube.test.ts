import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YouTubeMonitor, parseChannelFeed, uploadsPlaylistId, type FetchLike } from '../server/services/youtube.ts';

const CH = 'UCUhM7X3log3z56SWCoEWgSg';

const FEED = `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry><yt:videoId>vid1</yt:videoId><title>Programa &amp; Música — Ep. 1</title><published>2026-10-20T22:00:00+00:00</published>
    <media:group><media:thumbnail url="https://i.ytimg.com/vi/vid1/hqdefault.jpg" width="480" height="360"/></media:group></entry>
  <entry><yt:videoId>vid2</yt:videoId><title>Ao vivo de sábado</title><published>2026-10-18T22:00:00+00:00</published></entry>
</feed>`;

function res(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) };
}

function makeMonitor(apiKey: string, fetch: FetchLike) {
  return new YouTubeMonitor({
    apiKey, channelId: CH, channelUrl: 'https://www.youtube.com/@rcvestudioradio4570',
    maxVideos: 12, clientPollSeconds: 60, livePollMinutes: 10,
    fetch, nextDailyCheck: () => new Date('2026-10-28T21:00:00Z'), log: () => {},
  });
}

test('lê o feed público do canal', () => {
  const v = parseChannelFeed(FEED, 10);
  assert.equal(v.length, 2);
  assert.equal(v[0].title, 'Programa & Música — Ep. 1');
  assert.equal(v[0].url, 'https://www.youtube.com/watch?v=vid1');
  assert.equal(v[1].thumbnail, 'https://i.ytimg.com/vi/vid2/hqdefault.jpg');
  assert.equal(v[0].embeddable, null);
});

test('playlist de uploads derivada do ID do canal', () => {
  assert.equal(uploadsPlaylistId(CH), 'UUUhM7X3log3z56SWCoEWgSg');
});

const pageHtml = (data: unknown) => `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
const VIDEOS_PAGE = pageHtml({ contents: { tabs: [{ richGridRenderer: { contents: [
  { richItemRenderer: { content: { videoRenderer: { videoId: 'v1aaaaaaaaa', title: { runs: [{ text: 'Programa "especial" {1}' }] }, publishedTimeText: { simpleText: 'há 2 dias' } } } } },
  { richItemRenderer: { content: { lockupViewModel: { contentId: 'v2bbbbbbbbb', contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    metadata: { lockupMetadataViewModel: { title: { content: 'Entrevista no estúdio' },
      metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: '120 visualizações' } }, { text: { content: '3 weeks ago' } }] }] } } } } } } } },
] } }] } });
const STREAMS_PAGE = pageHtml({ items: [
  { videoRenderer: { videoId: 'live1xxxxxx', title: { runs: [{ text: 'RCV AO VIVO' }] }, badges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }] } },
  { videoRenderer: { videoId: 'next1xxxxxx', title: { runs: [{ text: 'Agendada' }] }, upcomingEventData: { startTime: '1' } } },
  { videoRenderer: { videoId: 'old1xxxxxxx', title: { runs: [{ text: 'Live de sábado' }] }, publishedTimeText: { simpleText: 'Transmitido há 5 dias' } } },
] });

test('sem chave: lê a página do canal, detecta a live e ordena do mais novo', async () => {
  const yt = makeMonitor('', async (url) => {
    if (url.endsWith('/streams')) return res(200, STREAMS_PAGE);
    if (url.endsWith('/videos')) return res(200, VIDEOS_PAGE);
    throw new Error('não deveria precisar do feed');
  });
  const s = await yt.refresh({ force: true });
  assert.equal(s.videosSource, 'page');
  assert.equal(s.liveCheck, 'ok');
  assert.equal(s.live?.id, 'live1xxxxxx');
  assert.deepEqual(s.videos.map((v) => v.id), ['v1aaaaaaaaa', 'old1xxxxxxx', 'v2bbbbbbbbb']);
  assert.equal(s.videos[0].title, 'Programa "especial" {1}');
  assert.ok(!s.videos.some((v) => v.id === 'next1xxxxxx'), 'live agendada não entra');
});

test('catálogos separados: aba Vídeos e aba Ao vivo, cada uma na ordem do YouTube', async () => {
  const yt = makeMonitor('', async (url) => res(200, url.endsWith('/streams') ? STREAMS_PAGE : VIDEOS_PAGE));
  const s = await yt.refresh({ force: true });
  assert.deepEqual(s.catalogs?.videos.map((v) => v.id), ['v1aaaaaaaaa', 'v2bbbbbbbbb']);
  assert.deepEqual(s.catalogs?.streams.map((v) => v.id), ['old1xxxxxxx'], 'sem a live atual e sem a agendada');
});

test('live que aparece só na aba Vídeos também vai para o topo', async () => {
  const VIDEOS_WITH_LIVE = pageHtml({ items: [
    { videoRenderer: { videoId: 'livevid0001', title: { runs: [{ text: 'Culto ao vivo' }] }, badges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }] } },
    { videoRenderer: { videoId: 'v1aaaaaaaaa', title: { runs: [{ text: 'Vídeo' }] }, publishedTimeText: { simpleText: 'há 1 dia' } } },
  ] });
  const yt = makeMonitor('', async (url) => res(200, url.endsWith('/streams') ? pageHtml({}) : VIDEOS_WITH_LIVE));
  const s = await yt.refresh({ force: true });
  assert.equal(s.live?.id, 'livevid0001');
  assert.equal(s.liveCheck, 'ok');
  assert.deepEqual(s.catalogs?.videos.map((v) => v.id), ['v1aaaaaaaaa'], 'a live não se repete na lista');
});

test('uma aba fora do ar: a outra aparece, mas a live não é dada como verificada', async () => {
  const yt = makeMonitor('', async (url) => (url.endsWith('/streams') ? res(500, 'erro') : res(200, VIDEOS_PAGE)));
  const s = await yt.refresh({ force: true });
  assert.equal(s.catalogs?.videos.length, 2);
  assert.equal(s.catalogs?.streams.length, 0);
  assert.equal(s.liveCheck, 'unconfigured');
});

test('sem chave e sem live na página: live fica vazia', async () => {
  const yt = makeMonitor('', async (url) => res(200, url.endsWith('/streams') ? pageHtml({}) : VIDEOS_PAGE));
  const s = await yt.refresh({ force: true });
  assert.equal(s.live, null);
  assert.equal(s.videos.length, 2);
});

test('página do canal fora do ar: usa o feed e NÃO inventa live', async () => {
  const yt = makeMonitor('', async (url) => (url.includes('feeds/videos.xml') ? res(200, FEED) : res(500, 'erro')));
  const s = await yt.refresh({ force: true });
  assert.equal(s.liveCheck, 'unconfigured');
  assert.equal(s.live, null);
  assert.equal(s.videos.length, 2);
  assert.equal(s.videosSource, 'rss');
});

test('com chave: live ativa vira destaque e sai da lista de vídeos', async () => {
  const calls: string[] = [];
  const yt = makeMonitor('KEY', async (url) => {
    calls.push(url);
    if (url.includes('/playlistItems')) return res(200, { items: [{ contentDetails: { videoId: 'live1' } }, { contentDetails: { videoId: 'old1' } }, { contentDetails: { videoId: 'next1' } }] });
    if (url.includes('/search')) return res(200, { items: [{ id: { videoId: 'live1' } }] });
    if (url.includes('/videos')) return res(200, { items: [
      { id: 'live1', snippet: { title: 'RCV AO VIVO', publishedAt: '2026-10-27T21:00:00Z', liveBroadcastContent: 'live', thumbnails: { high: { url: 'https://i.ytimg.com/vi/live1/hq.jpg' } } },
        liveStreamingDetails: { actualStartTime: '2026-10-27T21:02:00Z', concurrentViewers: '57' }, status: { embeddable: true, privacyStatus: 'public' } },
      { id: 'old1', snippet: { title: 'Vídeo antigo', publishedAt: '2026-10-01T10:00:00Z', liveBroadcastContent: 'none' }, status: { embeddable: false, privacyStatus: 'public' } },
      { id: 'next1', snippet: { title: 'Agendada', publishedAt: '2026-10-26T10:00:00Z', liveBroadcastContent: 'upcoming' }, status: { embeddable: true, privacyStatus: 'public' } },
    ] });
    throw new Error('URL inesperada ' + url);
  });
  const s = await yt.refresh({ full: true, force: true });
  assert.equal(s.liveCheck, 'ok');
  assert.equal(s.live?.id, 'live1');
  assert.equal(s.live?.concurrentViewers, 57);
  assert.deepEqual(s.videos.map((v) => v.id), ['old1']);
  assert.deepEqual(s.catalogs?.videos.map((v) => v.id), ['old1'], 'vídeo comum vai para o catálogo Vídeos');
  assert.deepEqual(s.catalogs?.streams, []);
  assert.equal(s.videos[0].embeddable, false);
  assert.ok(calls.every((u) => !u.includes('key=') || u.includes('key=KEY')));
  assert.ok(calls.some((u) => u.includes('eventType=live')), 'verificação completa usa search.list');
});

test('verificação periódica (barata) não usa search.list', async () => {
  const calls: string[] = [];
  const yt = makeMonitor('KEY', async (url) => {
    calls.push(url);
    if (url.includes('/playlistItems')) return res(200, { items: [] });
    if (url.includes('/videos')) return res(200, { items: [] });
    return res(500, {});
  });
  const s = await yt.refresh({ force: true });
  assert.equal(s.live, null);
  assert.equal(s.liveCheck, 'ok');
  assert.ok(!calls.some((u) => u.includes('/search')));
});

test('falha da API (cota): avisa, usa o feed e não inventa live', async () => {
  const yt = makeMonitor('KEY', async (url) => {
    if (url.includes('googleapis')) return res(403, { error: { errors: [{ reason: 'quotaExceeded' }] } });
    return res(200, FEED);
  });
  const s = await yt.refresh({ force: true });
  assert.equal(s.liveCheck, 'error');
  assert.equal(s.live, null);
  assert.equal(s.videos.length, 2);
  assert.match(s.message ?? '', /Limite diário/);
});

test('tudo fora do ar: não lança erro', async () => {
  const yt = makeMonitor('', async () => { throw new Error('offline'); });
  const s = await yt.refresh({ force: true });
  assert.equal(s.live, null);
  assert.ok(s.message);
});

test('consultas simultâneas viram uma só', async () => {
  let n = 0;
  const yt = makeMonitor('', async (url) => { n++; await new Promise((r) => setTimeout(r, 20)); return res(200, url.endsWith('/streams') ? STREAMS_PAGE : VIDEOS_PAGE); });
  await Promise.all([yt.refresh({ force: true }), yt.refresh({ force: true }), yt.ensureFresh(0)]);
  assert.equal(n, 2, 'uma rodada = abas Vídeos + Ao vivo');
});

test('com chave: transmissão encerrada vai para "Ao vivo", vídeo comum para "Vídeos"', async () => {
  const yt = makeMonitor('KEY', async (url) => {
    if (url.includes('/playlistItems')) return res(200, { items: [{ contentDetails: { videoId: 'past1' } }, { contentDetails: { videoId: 'vid1' } }] });
    if (url.includes('/videos')) return res(200, { items: [
      { id: 'past1', snippet: { title: 'Live de domingo', publishedAt: '2026-10-26T21:00:00Z', liveBroadcastContent: 'none' },
        liveStreamingDetails: { actualStartTime: '2026-10-26T21:00:00Z', actualEndTime: '2026-10-26T23:00:00Z' }, status: { privacyStatus: 'public', embeddable: true } },
      { id: 'vid1', snippet: { title: 'Clipe', publishedAt: '2026-10-20T10:00:00Z', liveBroadcastContent: 'none' }, status: { privacyStatus: 'public', embeddable: true } },
    ] });
    return res(500, {});
  });
  const s = await yt.refresh({ force: true });
  assert.deepEqual(s.catalogs?.streams.map((v) => v.id), ['past1']);
  assert.deepEqual(s.catalogs?.videos.map((v) => v.id), ['vid1']);
  assert.deepEqual(s.videos.map((v) => v.id), ['past1', 'vid1']);
});
