# Plano: senha 0164 e montarias extras (1, 4, 5, 6, 9, B)

Tabela da senha `$C1:5D87` (ROM): 31 32 33 34 35 36 39 3a 3b 3c 3d 3e 3f (x2) ✅

- [x] Core snes9x (normal + debug) compilado no scratchpad
- [x] Estados: mx_title, mx_password, mx_after_0164, mx_tb, mx_arena01 (analise/estados/, fora do git)
- [x] 0164 liga `$7F:70BD` (1234 não) ✅
- [x] Sorteio: revelação `$C1:5DC0` e arena 8 `$C3:196F` usam rnd(26) em `$C1:5D87` com a flag ✅
- [x] Medir 1, 4, 5, 6, 9, B (ver RELATORIO.md)
- [x] Fatos de render (facts_extra.py; tipo 2 de controle bate com o facts.ts) ✅
- [x] RELATORIO.md
- [x] Web: Rules.allMounts + Options.allMounts; sorteio 13 tipos (revelação e arena 8)
- [x] Web: abilities 1, 4, 5, 6, 9, B + testes
- [x] Web: facts.ts / MOUNT_PAL_ADDR / fallback art dos 6 tipos
- [x] Web: tela SENHA (Opções → Jogabilidade → SENHA; 0164 liga e desliga)
- [x] IA: dicas das montarias novas (ao menos não quebrar)
- [x] Testes (com ROM), build e verificação visual no app (scratchpad/verify.mjs)
- [x] Apagar entrada de docs/PENDENCIAS.md
