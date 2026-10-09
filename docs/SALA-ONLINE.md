# Sala online

Até 5 jogadores em máquinas diferentes, numa sala hospedada na máquina de quem abre.

## Abrir a sala

Dentro de `web/`:

```
npm run sala
```

O comando faz três coisas:

1. Gera o build do jogo em `web/dist`.
2. Sobe o servidor da sala em `server/sala.mjs`, na porta 8787.
3. Abre um túnel público do Cloudflare (`cloudflared`, sem conta) e mostra a URL, no formato `https://<nome>.trycloudflare.com`.

Mande essa URL para quem vai jogar. A URL muda cada vez que a sala sobe. Ctrl+C encerra tudo.

Passo a passo completo para outra pessoa (ou o agente de IA dela) baixar o projeto e hospedar a sala: [`SUBIR-SALA-CLOUDFLARE.md`](SUBIR-SALA-CLOUDFLARE.md).

- Para jogar só na rede local, sem túnel, use `SALA_NO_BUILD=1` (aproveita o `web/dist` existente) ou `SALA_NO_TUNNEL=1`. A sala fica em `http://<seu-ip>:8787`.
- O `cloudflared` instala com `winget install Cloudflare.cloudflared`.

## Jogar

A sala é uma tela do jogo: **SALA ONLINE**, na tela inicial (`screens/online.ts`, no layout HD das Opções).

1. Em **NOME**, aperte A, digite e aperte Enter.
2. Escolha **CRIAR SALA**.
3. Na linha **CÓDIGO XXXX**, A copia o link de convite (o link com `?sala=<código>`). Também dá para mandar só o código de 4 letras.
4. Quem recebe o link cai direto na tela da sala com o código preenchido: põe o nome e escolhe **ENTRAR NA SALA**. Quem tem só o código entra em SALA ONLINE e digita em **CÓDIGO**.

Na sala:

- Cada um troca o próprio personagem com ←/→ na própria vaga.
- O anfitrião escolhe, com ←/→:
  - em cada vaga sem jogador, CPU (com cada personagem) ou NENHUM;
  - a fase, as coroas, o tempo, a força da CPU, a morte súbita e o Bomber Vingador.
- O anfitrião começa em **INICIAR PARTIDA**.
- B leva o cursor até **SAIR DA SALA**, para ninguém sair sem querer.

**CONTROLE ONLINE**, que aparece fora e dentro da sala, configura o controle usado nas partidas online: dispositivo (teclado ou controle), teclas e botões. É um perfil só do online (`Settings.online`), separado dos controles dos 5 jogadores do jogo local, e começa igual ao do jogador 1. Na partida online, cada um joga só com esse perfil.

Na partida, o nome de cada jogador humano aparece em cima da cabeça, na cor dele. No canto de cima da tela fica o contador de FPS e de ping até a sala (`src/app/stats.ts`).

As regras extras vêm das Opções do anfitrião: soltar da luva, arremesso de jogador, soneca, montarias e spawns. Por enquanto a sala online é só Todos contra Todos.

Cada um joga com o seu **CONTROLE ONLINE**, inclusive com a tecla própria do P, se tiver configurado uma: cada um avisa a sala e a partida monta com a regra de cada vaga. Na sala online ninguém pausa: o START de todos, inclusive o do anfitrião, não vale na batalha. Para largar no meio, é só sair da sala; a CPU assume a vaga. Quem troca de aba ou de janela (alt+tab) continua no jogo, parado e sem apertar nada: o navegador dele segue rodando os ticks em segundo plano e os outros não ficam esperando. Quando a partida acaba, todo mundo volta para a sala.

## Como funciona

A sincronia é por lockstep:

- Cada navegador roda o mesmo núcleo determinístico, e só os botões de cada tick trafegam (`src/net/lockstep.ts` e `src/net/online.ts`).
- O botão apertado no tick T vale no tick T + atraso. Cada jogador tem o próprio atraso: meio ping dele até a sala mais meio ping do mais lento dos outros, mais 2 ticks de folga (entre 4 e 20, `server/delay.mjs`). Quem tem ping baixo, como o anfitrião jogando em `http://localhost:8787/`, responde mais rápido. `SALA_DELAY=<n>` fixa o mesmo valor para todos.
- O ping de cada um é a mediana das últimas 9 medidas (uma por segundo), então um pico isolado não muda o atraso. A cada 2 s o servidor manda o ping de todos e o atraso de cada um; na partida, cada navegador anda 1 tick por vez até o novo atraso. O contador do topo mostra o ping de todos na sala (`1P 3 · 2P 81`), para ver quem está puxando o atraso.
- Se a rede de alguém engasga, todos esperam. Aparece "Aguardando <nome>…".
- A cada 120 ticks os navegadores comparam o estado da partida (hash). Se der diferença, aparece o aviso de dessincronização.
- Quem sai no meio da partida vira CPU, no mesmo tick em todos os navegadores.

Os gráficos e o som originais vêm embutidos em `web/public/rom-pack.dat` (veja `web/scripts/rom-pack/`). Ninguém precisa da ROM.

## Testes

- `npx vitest run tests/net`: o lockstep. Inclui 3 navegadores simulados com latência variável e o estado conferido tick a tick.
- `node scripts/sala-e2e.mjs`: ponta a ponta em navegadores reais (Chrome). Um jogador cria a sala, outro entra, os dois jogam e o estado é conferido; depois um sai e o outro continua.
  - `SALA_URL=<url>` testa uma sala já no ar, inclusive pelo túnel.
  - Precisa do `web/dist`, gerado por `npm run build`.
