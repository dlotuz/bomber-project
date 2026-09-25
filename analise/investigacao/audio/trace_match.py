"""Roda uma partida a partir de um savestate, registrando pedidos de som + screenshots periódicos.
uso: trace_match.py <estado> <frames> [shot_every] [botões p0 por frame: 'none'|'mash']"""
import sys, collections
from aemu import *
st, N = sys.argv[1], int(sys.argv[2]); every = int(sys.argv[3]) if len(sys.argv) > 3 else 0
D = SCR + '/rom-audio/'; L = D + f'match_{st}.log'
e = AEmu(); e.hook(*HOOKS); e.state(st); e.log(L)
for f in range(N):
    e.run(1)
    if every and f % every == 0: e.shot(D + f'm_{st}_{f:05d}.png')
e.log(None)
cnt = collections.Counter(); first = {}
for l in open(L):
    if l.startswith('H'):
        p = l.split(); k = (HOOKS[int(p[2], 16)], p[3][-2:] if 'SFX' in HOOKS[int(p[2],16)] or 'STREAM' in HOOKS[int(p[2],16)] else p[3], p[7])
        cnt[k] += 1; first.setdefault(k, int(p[1]))
for k, v in sorted(cnt.items(), key=lambda kv: first[kv[0]]): print(first[k], v, *k)
