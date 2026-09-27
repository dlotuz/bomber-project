"""M1 do plano 11: tempos de áudio e de tela do fim de rodada — vitória (calibração), EMPATE por TIME UP e
EMPATE com todos mortos. Frames a partir do FADE ($C3:49ED, CMD18); o brilho é a média de pixels do quadro
exibido (fica 1 frame atrás do INIDISP: na vitória o fade-in aparece em FADE+64 para o over+63 do plano 10).
uso: <venv>/bin/python empates.py            (um processo por cenário, como o aemu pede)
"""
import sys, subprocess
from aemu import *
P = lambda k: 0x300 + 0x100 * k

def run(kind):
    e = AEmu(); e.hook(*HOOKS); e.state('st_arena01'); e.run(1)
    sp = [(e.r16(P(k) + 0x12), e.r16(P(k) + 0x16)) for k in range(5)]
    x0, y0 = sp[0]
    far = max(sp, key=lambda p: abs(p[0] - x0) + abs(p[1] - y0))
    if kind == 'tempo': e.w8(0x1ED2, 0); e.w8(0x1ED0, 2)          # relógio em 0:02
    L = SCR + f'/rom-audio/empates_{kind}.log'; e.log(L); base = e.nframes
    if kind != 'tempo': e.run(4, p0=['A'])                        # P1 põe a bomba no spawn
    lum = []
    for f in range(1400):
        if kind != 'tempo' and f < 200:
            for k in range(1, 5): e.w16(P(k) + 0x12, x0); e.w16(P(k) + 0x16, y0)    # os outros em cima da bomba
            if kind == 'vitoria': e.w16(P(0) + 0x12, far[0]); e.w16(P(0) + 0x16, far[1])  # P1 longe
        e.run(1)
        d = e.frame[0][::997]; lum.append((e.nframes - base, sum(d) / len(d)))
    e.log(None)
    ev = []
    for li in open(L):
        if li.startswith('H'):
            p = li.split(); k = HOOKS[int(p[2], 16)]
            if k in ('CMD18', 'CMD13', 'LOADBLK(A)', 'MUSIC(A)') or (k == 'STREAM(A)' and p[3].endswith('0E')):
                ev.append((int(p[1]) - 1 - base, k, p[3][-2:]))
    fade = next(f for f, k, _ in ev if k == 'CMD18')
    black = next(f - 1 for f, v in lum if f - 1 > fade and v == 0)
    fin = next(f - 1 for f, v in lum if f - 1 > black and v > 0)
    print(f'{kind}: ' + ', '.join(f'{k} {a} {"%+d" % (f - fade)}' for f, k, a in ev)
          + f' | preto (exibido) FADE{black - fade:+d}, fade-in (exibido) FADE{fin - fade:+d}')

if len(sys.argv) > 1: run(sys.argv[1])
else:
    for k in ('vitoria', 'tempo', 'mortos'): subprocess.run([sys.executable, __file__, k])
