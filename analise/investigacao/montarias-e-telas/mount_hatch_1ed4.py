"""$1ED4 durante o choco (revisão final do plano 9, I5): tick em que o montador entra em $C2:261E e tick em que
o $1ED4 cai (fim da explosão $D8:D327 do ovo pisado, $C1:5FD9). Uso: python mount_hatch_1ed4.py N estado...
Resultado (26/09): st_ride_pre 41, 44, 45, 43, 42, 42; st_cpu5 44 (7 casos; a ROM chega a $1ED4 = 3)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mt
N = int(sys.argv[1])
for st in sys.argv[2:]:
    path = mt.EST + st + '.bin' if os.path.exists(mt.EST + st + '.bin') else mt.OUT + st
    e = mt.new(path)
    rt = lambda w, p: w[0x302+p*0x100]<<16|w[0x301+p*0x100]<<8|w[0x300+p*0x100]
    prevrt = [0]*5; prev1 = None; start = {}
    res = []
    for f in range(N):
        e.run(1); w = e.wram()
        v = w[0x1ED4]
        for p in range(5):
            r = rt(w, p)
            if r == 0xc2261e and prevrt[p] != 0xc2261e:
                start[p] = (f, prev1, v)
            if r != 0xc2261e and prevrt[p] == 0xc2261e and p in start:
                start[p] = start[p] + (('end', f),)
            prevrt[p] = r
        if prev1 is not None and v < prev1:
            for p, s0 in list(start.items()):
                if f - s0[0] < 60: res.append((st, p, 'mount f', s0[0], '1ED4', s0[1], '->', s0[2], 'drop at k=', f - s0[0], s0[3:] ))
                del start[p]
        prev1 = v
    for r in res: print(r)
    print(st, 'done')
