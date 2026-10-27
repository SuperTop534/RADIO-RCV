# Como colocar o site da RCV no ar pelo GitHub (grátis)

No fim você terá um link assim: **https://SEU-USUARIO.github.io/rcv/**
Ele abre em qualquer navegador (Chrome, Safari…), no celular ou no computador, e pode ser instalado como app.

## Como funciona

- **GitHub Pages** guarda o site e dá o link. Não precisa de computador ligado.
- **GitHub Actions** é um robô que roda sozinho:
  - a cada 10 minutos: confere se você abriu uma live e se há vídeo novo no canal;
  - todo dia às 18h00 (Brasília): faz a verificação completa de live;
  - toda vez que você enviar arquivos novos: monta e publica o site de novo.
- O robô grava a lista num arquivo (`youtube.json`). O site lê esse arquivo e mostra:
  - **a live no topo**, com o selo AO VIVO, para assistir ali mesmo;
  - **os vídeos do mais novo para o mais antigo**, rolando a página para baixo.
  Tocar num vídeo começa a tocar dentro do site, sem ir para o YouTube.

## Passo 1 — Criar a conta
1. Entre em <https://github.com> → **Sign up** e crie a conta (e-mail, senha, nome de usuário).
   O nome de usuário aparece no link: escolha algo como `rcvestudioradio`.

## Passo 2 — Criar o repositório (a "pasta" do site)
1. No GitHub, clique no **+** (canto superior) → **New repository**.
2. **Repository name:** `rcv`
3. Marque **Public** (o GitHub Pages e o robô são gratuitos em repositórios públicos).
4. Clique em **Create repository**.

> Quer um link mais curto, sem o `/rcv/`? Dê ao repositório o nome **`SEU-USUARIO.github.io`**.
> Aí o link fica `https://SEU-USUARIO.github.io/`.

## Passo 3 — Enviar os arquivos
1. **Extraia o zip de novo numa pasta limpa** (não use a pasta onde você rodou `npm install`:
   ela tem a pasta `node_modules`, que é enorme e não deve ir para o GitHub).
2. Abra a pasta `rcv` extraída e confira que dentro dela estão: `.github`, `public`, `scripts`,
   `server`, `shared`, `src`, `tests`, `index.html`, `package.json`, `README.md`…
3. No GitHub, na página do repositório, clique em **uploading an existing file**
   (ou **Add file → Upload files**).
4. Selecione **tudo o que está dentro** da pasta `rcv` (Ctrl + A) e arraste para a página.
   Confira se a pasta **`.github`** foi junto — ela contém o robô.
5. Embaixo, clique em **Commit changes**.

> Se a pasta `.github` não subir: clique em **Add file → Create new file**, digite o nome
> `.github/workflows/site.yml`, cole o conteúdo do arquivo `site.yml` (abra com o Bloco de Notas)
> e clique em **Commit changes**.

## Passo 4 — Ligar o GitHub Pages
1. No repositório: **Settings** → menu da esquerda **Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.

## Passo 5 — Colocar a chave do YouTube (para detectar as lives)
Sem a chave o site funciona e mostra os vídeos, mas **não sabe quando você está ao vivo**.
1. Crie a chave seguindo a seção *"YouTube — configurar a API"* do README (é grátis).
2. No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
3. **Name:** `YOUTUBE_API_KEY` — **Secret:** cole a chave → **Add secret**.

A chave fica guardada em segredo no GitHub: ninguém que visita o site consegue vê-la.

## Passo 6 — Publicar pela primeira vez
1. Clique na aba **Actions** do repositório. Se aparecer um botão verde para ativar os workflows, clique nele.
2. À esquerda, clique em **Publicar site RCV** → **Run workflow** → **Run workflow**.
3. Espere a bolinha ficar verde (uns 2 minutos).
4. O link aparece em **Settings → Pages** ("Your site is live at…") e também dentro da execução, no passo *deploy*.

Pronto. A partir daí o robô trabalha sozinho.

## No dia a dia
- **Abriu uma live?** Ela aparece no site em até ~10–20 minutos (o GitHub às vezes atrasa o robô).
  Para aparecer na hora: celular ou computador → GitHub → **Actions → Publicar site RCV → Run workflow**.
- **Vídeo novo** aparece sozinho na próxima rodada do robô.
- **O ouvinte abre o site:** toca no play e ouve. Pode bloquear a tela ou trocar de app; pausa quando quiser
  pela tela bloqueada, pela notificação ou no próprio site.
- **Instalar como app:** Android (Chrome) → menu ⋮ → **Instalar app**. iPhone (Safari) → **Compartilhar →
  Adicionar à Tela de Início**.

## Aparecer na pesquisa do Google
O link funciona no Google Chrome desde o primeiro dia. Para o site **aparecer nas buscas do Google**:
1. Entre em <https://search.google.com/search-console> com sua conta Google.
2. **Adicionar propriedade → Prefixo do URL** → cole o link do site.
3. Escolha a verificação **Tag HTML**, me mande a tag que eu coloco no site (ou cole no `index.html`).
4. Depois de verificado, use **Inspeção de URL → Solicitar indexação**. O Google costuma levar alguns dias.

Um domínio próprio (ex.: `rcvestudioradio.com.br`, cerca de R$ 40/ano no registro.br) pode ser ligado em
**Settings → Pages → Custom domain**.

## Cuidados
- **Repositório inativo:** se ninguém mexer no repositório por 60 dias, o GitHub pausa o robô e manda um
  e-mail avisando. Basta abrir a aba **Actions** e reativar (ou editar qualquer arquivo).
- **Lives que só aparecem no YouTube:** se no YouTube Studio a live estiver com "Permitir incorporação"
  desligado, ou tiver restrição de idade, o YouTube não deixa tocar dentro de outros sites. Aí o site mostra
  o botão "Assistir no YouTube". Deixe a incorporação ligada nas suas lives.
- **Mudou algo no site?** Envie o arquivo alterado em **Add file → Upload files**. O robô republica sozinho.
