# HUD: coroas 0..4 nos 5 jogadores e relogio em varios valores -> tiles escritos em $7E5700
from ac import *
e = DEmu(); e.load(open(SCR + '/rom-arenas/pre_load01.bin', 'rb').read())
for k in range(5): e.w8(0x1F34 + 2 * k, k + 1 if k < 4 else 5)
e.run(430)
w = e.wram()
row = lambda r: ['%02X' % w[0x5700 + r * 64 + 2 * c] for c in range(32)]
for r in range(3): print(r, ' '.join(row(r)))
e.shot(OUT + '/shots/hud_coroas.png')
# relogio: le tiles das colunas 4-7 em varios instantes
seen = {}
for f in range(3700):
    e.run(1); w = e.wram()
    k = (w[0x1ED2], w[0x1ED0])
    if k not in seen: seen[k] = [[w[0x5700 + r * 64 + 2 * c] for c in range(4, 8)] for r in range(3)]
for k in sorted(seen)[:3] + sorted(seen)[-12:]:
    print('%d:%02d' % k, seen[k])
