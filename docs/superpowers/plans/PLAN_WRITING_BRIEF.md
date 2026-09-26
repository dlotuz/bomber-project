# Instruções comuns para escrever os planos 5–11 (Crown Blast, fidelidade)

- Worktree: `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity` (branch `feat/fidelity`). Código em `web/`
  (TS + Vite + Vitest). Estado atual: 238 testes verdes (`cd web && npx vitest run`), `npx tsc --noEmit` limpo.
- **Spec (autoridade):** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md`. Leia inteira, com foco
  nas seções do seu plano, na §2 (arquitetura/contratos), §10 (testes) e §11 (divisão, posse de arquivos, aceite).
  Fontes de verdade citadas pela spec: `analise/investigacao/*/RELATORIO.md` e os scripts/modelos Python validados
  dessas pastas (ex.: `mecanicas/movesim.py`, `mecanicas/itemsim.py`, `arenas-cenario/arena_rom.py`,
  `graficos-formato/decomp.py`). Quando o plano mandar portar um modelo Python, cite arquivo e função.
- ROM para testes locais: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"`.
  Testes que exigem a ROM usam `describe.skipIf(!ROM)`. Nunca versionar bytes da ROM, imagens extraídas, áudio.
- Emulador/Python para gerar fixtures (traços numéricos): `analise/ferramentas/emu.py`, Python
  `analise/extraido/cores/venv/bin/python`, cores instrumentados em `analise/extraido/cores/rom-*` (as frentes
  compilaram versões com trace). Savestates em `analise/estados/`.

## Formato do plano
- Siga o formato do skill superpowers:writing-plans (cabeçalho com Goal/Architecture/Tech Stack/Spec, Global
  Constraints, tarefas com Files/Interfaces/passos TDD com checkbox, comandos exatos, commit por tarefa).
- **Paralelismo é requisito:** agrupe as tarefas em **ondas**. Tarefas da mesma onda mexem em arquivos **disjuntos**
  (diga explicitamente "Possui: ...") e dependem só de ondas anteriores, para rodarem ao mesmo tempo em worktrees
  separadas e depois serem mescladas. A primeira onda costuma ser a "fundação" (tipos, contratos, esqueletos) — mantenha-a
  pequena para liberar o paralelismo cedo. Diga no topo quantas ondas e quais tarefas em cada.
- Cada tarefa ≈ um implementador por 30–120 min: nem micro nem gigante.
- **Testes completos no plano** (código de teste inteiro, com valores exatos da spec/relatórios). Código de produção:
  completo quando for curto ou traiçoeiro; para algoritmos grandes que já têm modelo Python validado, dê a assinatura
  TS, as regras exatas, as armadilhas e aponte o modelo a portar — o teste golden é quem garante a fidelidade.
- Sem placeholders ("TBD", "tratar erros", "similar à tarefa N"). Nomes e tipos consistentes com os contratos da §2.5.
- Commits em PT-BR no estilo `feat(core): ...`, terminando com a linha
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Termine o plano com a seção "Aceite do plano" (a lista da §11 da spec, com os comandos) e "Riscos".
- Não faça commit do plano (o controlador revisa e commita). Não dispare subagentes.
