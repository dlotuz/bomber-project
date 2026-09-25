# Arena 6: comprimento da chama por direcao em varias explosoes (campo limpo em volta)
from harness import *
for trial in range(6):
    e = fresh(6); e.run(1 + trial * 7)
    # limpa linha 5 e coluna 8 inteiras (sem soft)
    clear_row(e, 5); clear_col(e, 8)
    for k in range(1, 5): setpos(e, k, 32 + 16 * k, 208)  # tira os outros do caminho (linha 11)
    setpos(e, 0, 128, 112); e.run(2)
    e.run(3, p0=['A']); e.run(1)
    setpos(e, 0, 224, 48)
    mx = {}
    seen = set(); tiles = {}
    for f in range(200):
        e.run(1)
        for c in range(2, 15):
            if logic(e, 5, c) & 0x1000: seen.add((5, c)); tiles.setdefault((5, c), set()).add('%04X' % bg2(e, 5, c))
        for r in range(1, 12):
            if logic(e, r, 8) & 0x1000: seen.add((r, 8)); tiles.setdefault((r, 8), set()).add('%04X' % bg2(e, r, 8))
    left = sum(1 for (r, c) in seen if r == 5 and c < 8); right = sum(1 for (r, c) in seen if r == 5 and c > 8)
    up = sum(1 for (r, c) in seen if c == 8 and r < 5); down = sum(1 for (r, c) in seen if c == 8 and r > 5)
    print('teste %d: esq %d dir %d cima %d baixo %d  seeds 1EAE..1EB4=%s' % (trial, left, right, up, down, [e.r16(a) for a in (0x1EAE, 0x1EB0, 0x1EB2, 0x1EB4)]))
