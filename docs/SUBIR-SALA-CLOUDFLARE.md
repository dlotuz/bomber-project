# Subir a sala online pelo Cloudflare (guia para um agente de IA)

> **Para o Claude (ou outro agente) que recebeu este arquivo:** o seu usuário quer hospedar uma sala do Crown Blast
> na máquina dele para os amigos jogarem pela internet. Siga os passos na ordem, rode os comandos você mesmo e só
> pare para pedir algo ao usuário onde estiver escrito **PEDIR AO USUÁRIO**. No fim, entregue a ele a URL
> `https://<algo>.trycloudflare.com` e diga que o terminal da sala precisa **ficar aberto** enquanto jogam.

## O que vai acontecer

- O jogo roda no navegador. A "sala" é um servidor Node pequeno (`web/server/sala.mjs`, porta 8787) que serve o jogo
  e troca os botões dos jogadores por WebSocket.
- A máquina do usuário vira o host. Para quem está fora da rede dele conseguir entrar, abrimos um **Cloudflare Quick
  Tunnel** (`cloudflared`): ele dá uma URL pública `https://….trycloudflare.com` que aponta para a porta 8787 local.
  **Não precisa de conta no Cloudflare, de domínio nem de abrir porta no roteador.**
- Um comando faz tudo: `npm run sala` (build do jogo + servidor + túnel). A URL muda a cada vez que sobe.
- Os jogadores **não instalam nada**: só abrem a URL no navegador (Chrome/Edge/Firefox).

## 1. Pré-requisitos

| Ferramenta | Versão | Conferir |
|---|---|---|
| Git | qualquer | `git --version` |
| Node.js | **22.12+** (ou 20.19+). O Vite 8 não roda em versão mais velha | `node -v` |
| cloudflared | qualquer recente | `cloudflared --version` |

Instale o que faltar:

**Windows** (PowerShell):
```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Cloudflare.cloudflared
```
Depois do `winget`, o terminal atual pode não enxergar os programas novos: abra um terminal novo (ou chame pelo caminho
completo, ex. `C:\Program Files (x86)\cloudflared\cloudflared.exe`). O `npm run sala` já procura o `cloudflared`
nas pastas do winget sozinho.

**macOS**:
```bash
brew install git node cloudflared
```

**Linux (Debian/Ubuntu)**: Node 22 pelo [nodesource](https://github.com/nodesource/distributions) ou `nvm`, e o
`cloudflared` pelo pacote `.deb`:
```bash
curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

> **Armadilha comum:** máquinas com `nvm`/`nvm-windows` podem ter um Node antigo ativo (12, 14, 16). Se `node -v`
> der menos de 20.19, troque com `nvm install 22 && nvm use 22` (no Windows, `nvm use` pode pedir terminal de
> administrador — **PEDIR AO USUÁRIO** se precisar).

## 2. Baixar o projeto

O repositório é público:

```bash
git clone https://github.com/dlotuz/bomber-project.git
cd bomber-project/web
npm ci
```

Se já estiver clonado, atualize antes de subir (todos os jogadores usam o jogo servido pelo host, então basta o host
estar em dia):

```bash
cd bomber-project
git pull
cd web
npm ci
```

## 3. Subir a sala com o túnel

Dentro de `bomber-project/web`:

```bash
npm run sala
```

Esse comando **não termina**: ele fica rodando enquanto a sala existir. Rode-o em segundo plano / num terminal
separado e acompanhe a saída. Em uns 20–60 s aparece:

```
==============================================================
 Sala online: https://palavras-aleatorias-aqui.trycloudflare.com
 Mande esse link; no jogo, escolha SALA ONLINE na tela inicial.
 Você também pode abrir em http://localhost:8787/
==============================================================
```

**Entregue essa URL ao usuário** e explique:

- Ele manda o link para os amigos (WhatsApp, Discord etc.).
- O terminal com `npm run sala` precisa continuar aberto e o PC ligado (sem hibernar) durante a jogatina.
  Ctrl+C encerra a sala e o túnel.
- Da próxima vez que subir, o link será outro.

Variáveis úteis (opcionais):

- `SALA_NO_BUILD=1` — pula o build e usa o `web/dist` que já existe (sobe mais rápido na segunda vez).
- `SALA_NO_TUNNEL=1` — sem túnel, só rede local (`http://<ip-da-máquina>:8787`).
- `PORT=<n>` — outra porta, se a 8787 estiver ocupada.
- `SALA_DELAY=<n>` — fixa o atraso do lockstep em ticks (normalmente o servidor escolhe pelo ping; não mexa sem motivo).

No PowerShell, variável vai assim: `$env:SALA_NO_BUILD=1; npm run sala`.

## 4. Conferir que o túnel funciona (opcional, recomendado)

Com a sala no ar, num **segundo** terminal, dentro de `web/`:

```bash
SALA_URL=https://<a-url>.trycloudflare.com node scripts/sala-e2e.mjs
```

(PowerShell: `$env:SALA_URL="https://<a-url>.trycloudflare.com"; node scripts/sala-e2e.mjs`)

Ele abre dois Chromes (precisa do Google Chrome instalado), cria uma sala pela URL pública, entra com um segundo
jogador, joga uns segundos e confere que os dois ficaram sincronizados. Termina com `sala-e2e: ok`.

Sem Chrome, basta abrir a URL no navegador e ver a tela título carregar.

## 5. Como os jogadores entram

Passe isto ao usuário:

1. Todo mundo abre a URL.
2. Na tela inicial: **SALA ONLINE**.
3. Em **NOME**: aperta A (tecla J), digita o nome e Enter.
4. Um cria: **CRIAR SALA**. Na linha do código, A copia o link de convite (`…?sala=ABCD`) — ou mande só o código.
5. Os outros abrem o link de convite (já cai com o código preenchido), põem o nome e **ENTRAR NA SALA**.
6. Quem criou escolhe fase/regras/CPUs e aperta **INICIAR PARTIDA**.

Até 5 jogadores. Teclas padrão: WASD move, J/K/L ações, Enter START. **CONTROLE ONLINE** troca teclas/controle.
No canto de cima da tela aparecem o FPS e o ping até a sala (ex.: `60 FPS · 45 ms`).

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `cloudflared não encontrado` | Instale (passo 1) e abra um terminal novo. No Windows confira `C:\Program Files (x86)\cloudflared\`. |
| `o túnel saiu (…) antes de dar a URL` | Rede/firewall corporativo bloqueando o Cloudflare. Tente outra rede, ou rode `cloudflared tunnel --url http://localhost:8787` à mão para ver o erro. |
| `Vite requires Node.js version 20.19+ or 22.12+` / erro de sintaxe no build | Node velho — veja a armadilha do `nvm` no passo 1. |
| `EADDRINUSE` na porta 8787 | Já tem uma sala rodando (feche o outro terminal) ou use `PORT=8788`. |
| Amigos ficam em "Aguardando <nome>…" | A conexão de alguém engasgou; todos esperam por ele. Ping alto (veja o contador no topo) deixa o jogo mais lento para todos. |
| Aviso de dessincronização | Avise o dono do projeto (abra issue com o que estavam fazendo). Sair e criar a sala de novo resolve na hora. |
| Link `trycloudflare.com` parou de abrir | O túnel caiu ou o `npm run sala` foi fechado. Suba de novo e mande o link novo. |

## Para ir além (só se o usuário pedir)

O Quick Tunnel é temporário e sem garantia de disponibilidade — perfeito para jogar com amigos. Para um endereço fixo
(ex. `bomber.dominio-dele.com`) é preciso conta no Cloudflare e um domínio: `cloudflared tunnel login`,
`cloudflared tunnel create bomber`, `cloudflared tunnel route dns bomber bomber.dominio.com` e rodar com
`cloudflared tunnel run --url http://localhost:8787 bomber`, subindo o servidor com `SALA_NO_TUNNEL=1 npm run sala`.

Detalhes de como a sala funciona por dentro: [`SALA-ONLINE.md`](SALA-ONLINE.md).
