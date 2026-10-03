# Contrato do implementador (Crown Blast, planos 5–11)

Você implementa **uma tarefa** de um plano. O brief (texto completo da tarefa) é o seu requisito: leia-o primeiro e
use os valores e o código dele literalmente. Quando o brief traz código "conferido/copie exatamente", transcreva.

- **Onde trabalhar:** só na worktree indicada no despacho (ex.: `.worktrees/p5-t3`, branch `p5/t3`). Ignore menções do
  plano a trabalhar em `.worktrees/fidelity`/`feat/fidelity` — a sua worktree já é uma cópia equivalente. `web/node_modules`
  é um link compartilhado: **nunca rode `npm install`/`npm i`** (o npm troca o link por uma pasta). Se a tarefa manda
  adicionar dependências, edite o `package.json` à mão e rode `npm install --package-lock-only` para atualizar só o
  lock; os pacotes já estão no `node_modules` compartilhado. Se faltar um pacote de verdade, reporte NEEDS_CONTEXT.
- **Não mexa** em arquivos fora da posse da sua tarefa (o brief lista "Files"/"Possui"). Se precisar, pare e reporte.
- ROM para testes: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"`.
  Os gráficos e o som da ROM vão no pacote embutido `web/public/rom-pack.dat`: se o código passar a ler faixas novas
  da ROM, regere-o (`web/scripts/rom-pack/build.mjs`). Não versione a ROM inteira nem estados do emulador.
- TDD quando o brief pedir. Rode o teste focado enquanto itera; antes do commit rode a suíte inteira
  (`cd web && npx vitest run` com e sem `SB4_ROM`) e `npx tsc --noEmit`.
- Commit(s) em PT-BR como o brief manda, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Árvore limpa no fim (`git status` sem pendências dentro de `web/` e `docs/`).
- **Você não dispara subagentes** (nem revisores). Autorrevise lendo o próprio diff.
- Se algo do brief estiver errado ou impossível: não invente um desvio grande. Faça a correção mínima óbvia e registre, ou
  reporte BLOCKED/NEEDS_CONTEXT dizendo exatamente o que falta.
- **Relatório:** escreva o relatório completo no arquivo indicado no despacho (o que fez, arquivos, comandos de teste e
  saída resumida, desvios e por quê). Sua mensagem final devolve só: status (DONE / DONE_WITH_CONCERNS / BLOCKED /
  NEEDS_CONTEXT), commits (hash + título), uma linha de testes, preocupações.
- Se for retomado com achados da revisão: corrija, rode os testes que cobrem a mudança, faça commit e **acrescente** um
  "Fix report" ao mesmo arquivo de relatório.
