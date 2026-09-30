# Pendências

Coisas combinadas para implementar depois. Ao fechar uma, apague a entrada (o histórico fica no git).

## Todas as montarias (código 0164)

**Pedido:** no Super Bomberman 4 original, uma senha (lembrada como **0164**) libera todos os tipos de ovo no Battle.
Aqui isso não existe: o Battle só sorteia os 7 tipos padrão.

**Estado atual**
- Tipos sorteados hoje: **2, 3, A, C, D, E, F** (tabela da cápsula `$C1:5DA4`, `web/src/core/tables/misc.ts`).
- A análise da ROM achou a tabela de **13 tipos de ovo** ligada por senha (`$7F:70BD`), mas **não** confirmou qual
  senha a liga (`analise/investigacao/montarias-e-telas/RELATORIO.md`, pendência 🟡).
- Os 6 tipos a mais que completam os 13 saem de **0, 1, 4–9 e B** (9 candidatos; conferir quais estão na tabela).
  Nenhum deles tem poder nem gráficos no código (`web/src/core/mounts/abilities.ts`: "Os demais (0, 1, 4–9, B) ficam
  fora do escopo").
- O modo senha ficou fora do projeto (spec `docs/superpowers/specs/2026-09-25-crown-blast-web-design.md`).

**Proposta**
- Opção em **Opções → Jogabilidade**: "TODAS AS MONTARIAS", padrão NÃO. Ligada, o sorteio usa a tabela de 13 tipos.
- Para cada tipo novo: poder (`web/src/core/mounts/abilities/typeX.ts`), gráficos de montaria/montado
  (`web/src/render/rom/mounts/facts.ts`) e classe do ovo (máquina × normal, `isMachine` em
  `web/src/core/mounts/types.ts`).

**Falta saber antes de começar**
- O que cada tipo novo faz no original (medir no emulador ou descrição de quem jogou).
- Se 0164 é mesmo a senha e quais são os 13 tipos da tabela `$7F:70BD`.
