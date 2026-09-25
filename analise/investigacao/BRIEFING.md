# Investigação da ROM — briefing comum a todos os agentes

Objetivo do projeto: o jogo web "Crown Blast" (em `.worktrees/cpu-ai/web`, TypeScript) precisa ficar **idêntico** ao
Battle Mode do Super Bomberman 4 (USA) em mecânicas, gráficos e usabilidade. Os gráficos (e depois o som) serão
**extraídos da ROM do próprio usuário em tempo de execução, no navegador** — então tudo o que você descobrir sobre
formato de dados precisa ser reimplementável em TypeScript puro (sem emulador no navegador).

## Recursos

- ROM: `/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc` (HiROM, 1,5 MB+; tem um hack/tradução
  com código novo em `$E0–$E2`). **Nunca copie a ROM nem dados extraídos para dentro do repositório versionado.**
- Análise anterior: `analise/ANALISE_COMPLETA.md` (mapa de RAM, itens, regras, fluxo de menus). Leia as seções
  relevantes para a sua frente. `analise/layouts_arenas.txt`, `analise/telas/*.png`, `analise/arenas/*.png`.
- Emulador headless: `analise/ferramentas/emu.py` (classe `Emu`: `run(n, p0=['A'])`, `tap`, `wram()`, `r8/r16/w8/w16`,
  `save()/load()` de savestate, `shot(path)`), core `analise/ferramentas/snes9x_libretro.dylib`.
  Python com PIL: `/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/venv/bin/python`
  (rode a partir de `analise/ferramentas` ou ponha ela no `sys.path`).
  - `retro_get_memory_data/size(3)` = VRAM (64 KB). CGRAM (paleta) e OAM não são expostos pela API: leia do
    savestate (`e.save()` → formato snes9x `#!s9xsnp`, blocos `NAM:`, `CPU:`, `REG:`, `PPU:`, `DMA:`, `VRA:`, `RAM:`, …;
    CGRAM e OAM estão no bloco `PPU` — descubra os offsets no código fonte do snes9x em
    `/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/snes9x/`
    (`snapshot.cpp`).
  - O fonte do snes9x está nesse diretório. Se precisar de rastreio (log de DMA, breakpoints de leitura/escrita,
    trace de CPU), compile **uma cópia própria** do core num diretório seu (ex.: `scratchpad/rom-<frente>/`) e aponte
    `SNES9X_CORE` para ela. Não sobrescreva o dylib compartilhado.
  - Disassembler 65816 simples: `analise/ferramentas/dis65816.py`.
  - Várias instâncias `Emu` no mesmo processo compartilham o estado do core: use **um processo por emulador**.
- Savestates prontos em `analise/estados/*.bin` (nomes indicam o momento: `st_title`, `st_rules`, `st_stage00..11`
  seleção de fase, `st_arena01..10` partida em cada arena, `st_allcom`/`st_cpu5` partidas só de CPU, `st_matchend`,
  etc.). Carregue com `e.load(open(p,'rb').read())` e tire um `shot` para confirmar o que cada um é.
- Controles: porta 1 = P1, multitap nas portas 2–5. Botões: `B, Y, SELECT, START, UP, DOWN, LEFT, RIGHT, A, X, L, R`.

## Regras de trabalho

- Trabalhe **só** na sua pasta: `analise/investigacao/<frente>/` (scripts, notas, `RELATORIO.md`) e, para imagens e
  dados extraídos da ROM, `analise/extraido/<frente>/` (fora do git). Não edite `emu.py`, `web/`, nem arquivos de
  outras frentes. Não faça commits.
- Não chame nenhum serviço externo com dados do usuário. Não use internet para baixar a ROM ou assets.
- Meça, não chute. Marque cada afirmação no relatório como ✅ medido/confirmado, 🟡 provável, ❌ não encontrado.
- Números exatos: frames, pixels, subpixels, endereços de ROM (`$BB:AAAA` e offset de arquivo), tabelas.
- Relatório em PT-BR, direto, com tabelas. Inclua **como reproduzir** (comando/script) cada medição.
- Você não dispara subagentes.
- Sua mensagem final: 10–20 linhas resumindo o que foi confirmado, o que ficou em aberto e o caminho do relatório.
