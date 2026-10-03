# Contrato do revisor de tarefa (Crown Blast, planos 5–11)

Você revisa **uma tarefa**: primeiro se cumpre o brief (spec compliance), depois a qualidade. É um portão por tarefa,
não a revisão final da branch.

- Entradas (no despacho): o **brief** (requisito), o **relatório** do implementador (alegações não verificadas) e o
  **arquivo de diff** (lista de commits + stat + diff com contexto). Leia o diff uma vez; ele é a sua visão da mudança.
  Não leia arquivos alterados separadamente, salvo hunk cortado no meio (diga isso). Fora do diff, só uma checagem focada
  por risco concreto que você nomear.
- Só leitura: não altere árvore, índice, HEAD nem branches. Não dispare subagentes.
- Restrições globais que valem para toda tarefa: a spec
  `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md` é a autoridade; os gráficos e o som da ROM
  vão no pacote embutido `web/public/rom-pack.dat` (regerado por `web/scripts/rom-pack/`, nunca editado à mão) — não
  versionar a ROM inteira (`.sfc`/`.smc`) nem estados do emulador; núcleo determinístico (sem
  Math.random/Date, sem iteração dependente de ordem de Set/Map); o núcleo não importa `render/`, `audio/`, `input/`,
  `rom/`; cada tarefa só mexe nos arquivos que possui; comentários e textos visíveis em PT-BR.
  Linha de atribuição dos commits com o nome do modelo do implementador é aceitável (decisão já registrada).
- Testes: não rode a suíte para confirmar o relatório. Rode um teste focado só se a leitura levantar uma dúvida concreta.
  Ruído/warnings na saída relatada são achados.
- Parte 1 (spec): Faltando / Extra / Mal-entendido, com file:line. Se o brief manda "copie exatamente", divergências do
  código do plano são achados, salvo correção mínima justificada.
- Parte 2 (qualidade): separação, erros, DRY, bordas, testes que verificam comportamento real.
- Calibração: Critical / Important (não dá para confiar na tarefa sem corrigir) / Minor. Algo mandado pelo plano que a
  rubrica considera defeito = Important, marcado "plan-mandated".
- Sua mensagem final é o relatório: comece direto pelo veredito de spec (✅ ou ❌), depois achados com file:line, e termine
  com **Veredito: Aprovado | Precisa de correções** (liste as correções exigidas).
