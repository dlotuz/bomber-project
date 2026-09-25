"""Compara o WAV do spchost (sem 65816) com o áudio do jogo rodando no snes9x completo.
Grava 30 s do jogo a partir do pedido da música $14 (st_stage00 -> A) e compara envelopes de RMS (janelas de 20 ms)."""
import array, math, wave, sys
from aemu import *
X = '/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/audio/'
e = AEmu(); e.hook(*HOOKS); e.state('st_stage00'); e.run(1)
L = SCR + '/rom-audio/cmp.log'; e.log(L); e.tap('A', hold=3, after=0)
# roda até a música $14 ser pedida
while True:
    e.run(1); e.flush()
    if any('A=0014' in l for l in open(L)): break
e.capture = True; e.run(60 * 32); e.capture = False; e.log(None)
ev = [l.split() for l in open(L) if l.startswith("H")]; f0 = int([x for x in ev if x[2] == "C00394" and x[3].endswith("14")][0][1])
print("eventos de som durante a captura:", [(int(x[1]) - f0, HOOKS[int(x[2], 16)], x[3]) for x in ev if int(x[1]) > f0 and not HOOKS[int(x[2], 16)].startswith("drv")])
e.wav(X + 'jogo_battle_14.wav', 32040)
def env(a, rate, win=0.02):
    n = int(rate * win) * 2; return [math.sqrt(sum(v * v for v in a[i:i + n]) / n) for i in range(0, len(a) - n, n)]
g = array.array('h', bytes(e.audio)); h = array.array('h', wave.open(X + 'battle_14.wav').readframes(10**8))
eg, eh = env(g, 32040), env(h, 32000)
best = None
for lag in range(0, 150):                                  # o jogo só começa a tocar depois do upload (~1,1 s)
    a = eg[lag:lag + 1200]; b = eh[:1200]
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    c = sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    if best is None or c > best[0]: best = (c, lag)
print('melhor correlação do envelope RMS (24 s): r=%.4f com atraso de %d ms' % (best[0], best[1] * 20))
print('RMS médio jogo=%.0f host=%.0f' % (sum(eg) / len(eg), sum(eh[:len(eg)]) / len(eg)))
