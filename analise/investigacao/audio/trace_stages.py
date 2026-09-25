"""Para cada st_stageNN: confirma a fase (A) e registra os pedidos de música/bloco/stream até a partida começar."""
import sys, subprocess
from aemu import *
if len(sys.argv) > 1:
    n = sys.argv[1]; e = AEmu(); e.hook(*HOOKS); D = SCR + '/rom-audio/'
    e.state(f'st_stage{n}'); e.run(2); e.shot(D + f'stage{n}_sel.png'); L = D + f'stage{n}.log'; e.log(L)
    e.tap('A'); e.run(700); e.shot(D + f'stage{n}_play.png'); e.log(None)
    for l in open(L):
        if l.startswith('H') and any(k in l for k in ('C34A44', 'C34A16', 'C34AF9', 'C34A7F', 'C349ED')):
            p = l.split(); print(n, p[1], HOOKS[int(p[2], 16)], p[3], p[7])
else:
    for i in range(12):
        subprocess.run([sys.executable, __file__, '%02d' % i])
