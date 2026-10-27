# RCV Estúdio Rádio — App/Site oficial

PWA (site instalável) com:

- **Início** — rádio ao vivo com player próprio, reconexão automática e controles na tela bloqueada.
- **Vídeos** — transmissão ao vivo do YouTube em destaque (quando houver) e vídeos do canal [@rcvestudioradio4570](https://www.youtube.com/@rcvestudioradio4570).
- **CHAT RCV** — o ouvinte escreve a mensagem e o WhatsApp oficial (+55 43 98419‑5925) abre com o texto pronto.

Visual: fundo de espuma acústica do estúdio, logo oficial em placa de vidro com profundidade 3D discreta, botões e painéis em estilo Liquid Glass, splash animada.

---

## Publicar de graça no GitHub (recomendado)

Siga o guia **[PUBLICAR-NO-GITHUB.md](PUBLICAR-NO-GITHUB.md)**. Resumo:

- `npm run build:static` gera só o site (sem servidor) para o **GitHub Pages**.
- O workflow `.github/workflows/site.yml` (GitHub Actions) roda a cada 10 min e às 18h00 de Brasília,
  busca a live e os vídeos do canal com `scripts/fetch-youtube.ts` e publica `youtube.json` junto com o site.
- A chave do YouTube fica no segredo `YOUTUBE_API_KEY` do repositório, nunca no site.
- O site usa caminhos relativos, então funciona em `usuario.github.io/rcv/` ou num domínio próprio.

As seções abaixo descrevem a versão com servidor Node.js (Render, VPS, Docker), que detecta lives mais rápido
(notificações instantâneas do YouTube) mas exige um servidor ligado.

---

## 1. Rodar localmente

Requisitos: **Node.js 20 ou mais recente**.

```bash
npm install
cp .env.example .env        # opcional: preencha a chave do YouTube
npm run build               # gera dist/ (app) e dist-server/ (servidor)
npm start                   # http://localhost:8080
```

Desenvolvimento (recompila ao salvar):

```bash
npm run dev                 # http://localhost:8080
```

Testes e checagem de tipos:

```bash
npm test                    # testes: player, agenda 18h, YouTube, WhatsApp, servidor
npm run typecheck
```

> **Windows (PowerShell):** os mesmos comandos funcionam. Se o `npm install` avisar que bloqueou o script do *esbuild* e o `npm run build` reclamar do esbuild, rode `npm install-scripts approve esbuild` e depois `npm install` de novo.

> Para testar no celular na mesma rede Wi‑Fi, acesse `http://IP-DO-COMPUTADOR:8080`.
> Recursos de PWA (instalação, service worker) exigem **HTTPS** — funcionam em produção.

---

## 2. Arquitetura

```
src/                      App (React + TypeScript, compilado com esbuild)
  components/
    SplashScreen.tsx      abertura com a logo (uma vez por abertura do app)
    Logo3D.tsx            logo oficial em placa de vidro com profundidade
    RadioPlayer.tsx       tela inicial + botão principal
    MiniPlayer.tsx        barra do rádio nas outras abas
    BottomNavigation.tsx  barra inferior (celular) / pílula no topo (computador)
    VideosSection.tsx     aba Vídeos
    LiveVideo.tsx         destaque: live ativa ou vídeo escolhido
    VideoList.tsx         lista de vídeos
    ChatRCV.tsx           formulário → WhatsApp
  services/
    radio.ts              controlador único do áudio (reconexão, Media Session)
    youtube.ts            cliente da API do servidor + consultas periódicas
    whatsapp.ts           montagem do link wa.me
    cache.ts              cache local
  styles/app.css          identidade visual
  sw.template.js          service worker (gerado no build)
server/                   Servidor Node sem dependências externas
  index.ts                inicia servidor + agendamentos
  app.ts                  rotas HTTP, arquivos estáticos, cabeçalhos de segurança
  services/youtube.ts     YouTube Data API v3 + feed público + cache
  services/websub.ts      notificações instantâneas do YouTube
  jobs/schedule.ts        agendamento diário com fuso horário
  jobs/checkNow.ts        verificação manual: npm run check:live
shared/types.ts           tipos usados pelo app e pelo servidor
public/                   logo, espuma, ícones, manifest
tests/                    testes (node:test)
```

**Por que um servidor?** A chave da API do YouTube não pode ficar no código do navegador, e a verificação das 18h00 precisa rodar mesmo com o app fechado. O servidor consulta o YouTube, guarda o resultado em cache e o app só lê esse cache (`GET /api/youtube`) — assim milhares de ouvintes não consomem cota.

### Rotas

| Rota | Função |
|---|---|
| `GET /api/youtube` | estado atual (live, vídeos, status da verificação). `?fresh=1` atualiza se o cache tiver mais de 5 min |
| `GET /api/config` | URL do streaming e número do WhatsApp |
| `GET/POST /api/youtube/websub` | notificações do YouTube (WebSub) |
| `POST /api/youtube/check` | gatilho para agendador externo (exige `CRON_SECRET`) |
| `GET /api/health` | monitoramento |

---

## 3. Rádio

- Fonte: `https://stm12.voxhd.com.br:13010/stream//` (configurável em `RADIO_STREAM_URL`, sem recompilar).
- **Um único `<audio>`** para o app inteiro: trocar de aba nunca cria outra conexão nem interrompe o som.
- Toques repetidos no botão são ignorados enquanto conecta.
- “Reproduzindo”/“AO VIVO” só aparecem depois que o navegador confirma que o áudio está tocando.
- Falhas: novas tentativas em 1s, 2s, 4s, 8s, 16s, 30s… (máx. 8). Sem internet, espera a rede voltar.
- Ao pausar, a conexão com o streaming é encerrada (economiza dados); ao retomar, volta ao ponto ao vivo.
- Volume: pelos botões do aparelho / sistema (sem controle deslizante, como pedido).
- O equalizador é **decorativo**: só se mexe com o áudio tocando, mas não analisa o sinal (o streaming é de outro servidor e não permite isso sem configurar CORS).

### Segundo plano e tela bloqueada — o que esperar

A Media Session API é usada para mostrar “RCV Estúdio Rádio — Ao vivo” com a logo e os botões play/pausa na tela bloqueada e na central de notificações.

| Ambiente | Comportamento |
|---|---|
| Android + Chrome (site ou PWA instalado) | Continua tocando com a tela bloqueada e em outros apps; controles na notificação. |
| iPhone + Safari (site) | Continua tocando com a tela bloqueada; controles na tela bloqueada. O iOS pode pausar se outro app usar o áudio. |
| iPhone — PWA na Tela de Início | Toca em segundo plano nas versões recentes do iOS; versões antigas podem pausar ao sair do app. |
| Computador | Toca normalmente com a aba em segundo plano; teclas de mídia funcionam. |

Uma página web **não consegue impedir** o sistema de encerrar o navegador para liberar memória ou bateria (economia de energia agressiva de alguns Android, por exemplo). Nesse caso, o ouvinte toca no play de novo. Para garantia máxima de segundo plano seria preciso um app nativo (ex.: empacotar com Capacitor e usar serviço de mídia em primeiro plano no Android).

Os navegadores exigem um **toque do usuário** para iniciar o áudio; por isso a rádio não começa sozinha ao abrir. Se o navegador bloquear, o app mostra “Toque para iniciar o áudio”.

---

## 4. YouTube — configurar a API

Sem chave, o app funciona: mostra os vídeos pelo feed público do canal e exibe o aviso discreto *“A verificação de transmissão ao vivo está temporariamente indisponível”* (nunca inventa uma live).

Para ativar a detecção de lives:

1. Acesse <https://console.cloud.google.com/> e crie um projeto (ex.: “RCV Rádio”).
2. **APIs e serviços → Biblioteca** → ative **YouTube Data API v3**.
3. **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
4. Clique na chave → **Restrições de API** → marque só *YouTube Data API v3*. (Não use restrição por site/HTTP referrer: a chave é usada pelo servidor.)
5. Coloque a chave em `YOUTUBE_API_KEY` no `.env` ou no painel da hospedagem.
6. Teste: `npm run build && npm run check:live`.

ID do canal configurado: `UCUhM7X3log3z56SWCoEWgSg` (`YOUTUBE_CHANNEL_ID`).

### Como as lives são detectadas

1. **Todos os dias às 18h00 (America/Sao_Paulo)** — verificação completa no servidor (`LIVE_DAILY_CHECK_TIME`, `TIMEZONE`). O cálculo usa o fuso de Brasília independentemente do fuso do servidor.
2. **A cada `LIVE_POLL_MINUTES` (padrão 10 min)** — verificação de segurança: uma live iniciada às 19h47, por exemplo, aparece em até 10 minutos.
3. **Notificações WebSub** — com `PUBLIC_URL` configurada (HTTPS), o YouTube avisa o servidor quando o canal publica/inicia vídeos e a verificação roda na hora.
4. **App aberto** — o app consulta o servidor a cada `CLIENT_POLL_SECONDS` (padrão 60s) e ao abrir a aba Vídeos, sem gastar cota do YouTube.

Cota: a cota gratuita é de 10.000 unidades/dia. Cada verificação periódica custa ~3 unidades (uploads + detalhes); a completa (18h00 e notificações) usa também `search.list` (+100). Com 10 min de intervalo: ~430 unidades/dia + 100 por verificação completa. Sobra bastante.

Se a cota acabar ou a API falhar, o app mostra o aviso e continua listando os vídeos pelo feed público.

Vídeos cuja incorporação foi desativada pelo dono aparecem com o botão **Abrir no YouTube**. Todo vídeo tem esse botão como alternativa.

---

## 5. CHAT RCV

- Link usado: `https://wa.me/5543984195925?text=<mensagem codificada>` (o link `http://wa.me//+55…` fornecido foi normalizado).
- No celular abre o app do WhatsApp; no computador (ou sem o app instalado) o `wa.me` leva ao WhatsApp Web / página de download.
- O app **não diz que a mensagem foi enviada**: mostra “Conclua o envio no WhatsApp”, porque só o ouvinte confirma o envio lá.
- O número pode ser trocado em `WHATSAPP_NUMBER`.

**Chat real dentro do app (futuro):** exigiria a WhatsApp Business Platform (Cloud API da Meta): número verificado, conta comercial, modelos de mensagem aprovados, um webhook no servidor para receber mensagens, banco de dados para as conversas, login dos ouvintes e um painel para a equipe responder. É um projeto separado, sujeito às políticas e custos da Meta.

---

## 6. Publicar

O servidor precisa ficar **ligado continuamente** para a verificação das 18h00. Opções:

### Render (mais simples)
1. Suba o projeto para um repositório no GitHub.
2. No Render: **New → Blueprint** e selecione o repositório (usa `render.yaml`).
3. Preencha `YOUTUBE_API_KEY` e `PUBLIC_URL` (ex.: `https://rcv-estudio-radio.onrender.com`).
4. Plano **Starter** recomendado. No plano gratuito o servidor “dorme”: configure em <https://cron-job.org> uma chamada diária às **18:00 (São Paulo)** para
   `POST https://SEU-DOMINIO/api/youtube/check` com o cabeçalho `Authorization: Bearer SEU_CRON_SECRET`.

### Railway / Fly.io / qualquer Docker
```bash
docker build -t rcv-radio .
docker run -d -p 8080:8080 --env-file .env -v rcv-data:/app/data --restart unless-stopped rcv-radio
```

### VPS (Ubuntu) com PM2 + Nginx
```bash
npm install && npm run build
npm i -g pm2
pm2 start dist-server/index.js --name rcv-radio
pm2 save && pm2 startup
```
Nginx (com HTTPS via Certbot):
```nginx
server {
  server_name app.seudominio.com.br;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> **Vercel/Netlify** (funções serverless) não mantêm o processo ligado; se usar, publique só o `dist/` e rode o servidor em outro lugar, ou adapte as rotas para funções + cron da plataforma.

**HTTPS é obrigatório** em produção: o streaming é HTTPS e a instalação como app (PWA) só funciona em HTTPS.

### Depois de publicar — checagem rápida
- [ ] Abrir no celular → splash → tocar em play → “Reproduzindo” e “AO VIVO”.
- [ ] Bloquear a tela → controles da RCV aparecem e o áudio continua.
- [ ] Trocar para Vídeos/CHAT → o áudio não para e o mini player aparece.
- [ ] `https://SEU-DOMINIO/api/youtube` → `"liveCheck": "ok"` (com chave).
- [ ] CHAT RCV → enviar → WhatsApp abre no número correto com o texto.
- [ ] Android: menu ⋮ → **Instalar app**. iPhone: Compartilhar → **Adicionar à Tela de Início**.
- [ ] Logs do servidor mostram a próxima verificação diária em 18:00.

---

## 7. Variáveis de ambiente

Veja `.env.example` — todas têm valor padrão, exceto as opcionais `YOUTUBE_API_KEY`, `PUBLIC_URL`, `WEBSUB_SECRET` e `CRON_SECRET`. Nenhum segredo vai para o navegador: o app só recebe a URL do streaming e o número do WhatsApp.

## 8. Arquivos da marca

- `public/assets/logo-rcv-900.webp|png` e `logo-rcv.webp` — logo oficial (fundo transparente, cores e proporções preservadas).
- `public/assets/espuma-acustica*.jpg` — foto de referência da espuma do estúdio.
- `public/icons/*` — ícones do app gerados a partir da logo.

Para trocar a logo, substitua esses arquivos mantendo os nomes e rode `npm run build`.
