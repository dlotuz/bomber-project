"""(g) O que o jogador sente: cadeia em linha A(8,5) alcance 2 → B(10,5) alcance 6. O braço esquerdo de B para no
centro de A (col 8). P4 (slot 3) fica parado em (COL,5), sem invencibilidade; os outros ficam invencíveis.
Uso: victim.py COL [semA]   semA: sem a bomba A, B explode sozinha pelo pavio (controle: o braço chega)."""
from fh import *
COL = int(sys.argv[1]); semA = 'semA' in sys.argv
e = setup()
def inv3(e):
    for n in (0, 1, 2, 4): e.w16(0x396 + n * 0x100, 200)
if not semA: place(e, 0, 8, 5, rng=2, fuse=8)
place(e, 1, 10, 5, rng=6, fuse=10 if semA else 120, park=(2, 11))
tele(e, 3, COL, 5); e.w16(0x696, 0); e.run(1)
prev = None
for i in range(80):
    e.step(); inv3(e)
    s = (f'{rt(e,3):06X}', line(e, [(c, 5) for c in range(3, 12)]))
    if s != prev: print(e.ticks, s)
    prev = s
