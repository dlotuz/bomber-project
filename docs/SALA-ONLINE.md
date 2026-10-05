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

Na partida, o nome de cada jogador humano aparece em cima da cabeça, na cor dele.

As regras extras vêm das Opções do anfitrião: soltar da luva, arremesso de jogador, soneca, montarias e spawns. Por enquanto a sala online é só Todos contra Todos.

Cada um joga com o seu **CONTROLE ONLINE**. START pausa para todos. SELECT+START segurado encerra a partida para todos. Quando a partida acaba, todo mundo volta para a sala.

## Como funciona

A sincronia é por lockstep:

- Cada navegador roda o mesmo núcleo determinístico, e só os botões de cada tick trafegam (`src/net/lockstep.ts` e `src/net/online.ts`).
- O botão apertado no tick T vale no tick T + atraso. O servidor escolhe o atraso no início da partida, pelo ping de cada jogador: entre 4 e 20 ticks, normalmente de 5 a 10 (80 a 170 ms). `SALA_DELAY=<n>` fixa o valor.
- Se a rede de alguém engasga, todos esperam. Aparece "Aguardando <nome>…".
- A cada 120 ticks os navegadores comparam o estado da partida (hash). Se der diferença, aparece o aviso de dessincronização.
- Quem sai no meio da partida vira CPU, no mesmo tick em todos os navegadores.

Os gráficos e o som originais vêm embutidos em `web/public/rom-pack.dat` (veja `web/scripts/rom-pack/`). Ninguém precisa da ROM.

## Testes

- `npx vitest run tests/net`: o lockstep. Inclui 3 navegadores simulados com latência variável e o estado conferido tick a tick.
- `node scripts/sala-e2e.mjs`: ponta a ponta em navegadores reais (Chrome). Um jogador cria a sala, outro entra, os dois jogam e o estado é conferido; depois um sai e o outro continua.
  - `SALA_URL=<url>` testa uma sala já no ar, inclusive pelo túnel.
  - Precisa do `web/dist`, gerado por `npm run build`.
