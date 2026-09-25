"""Per-frame recorder of player animation state."""
from anims import *

def pstate(w, p):
    o = 0x300 + 0x100*p
    ap = (w[o+8] | w[o+9] << 8 | w[o+10] << 16)
    return dict(rt=w[o] | w[o+1] << 8 | w[o+2] << 16, anim=(ap - 1) & 0xFFFFFF, n=w[o+0xB], idx=w[o+0xC], tmr=w[o+0xD],
                x=w[o+0x12] | w[o+0x13] << 8, y=w[o+0x16] | w[o+0x17] << 8, dir=w[o+0x62], st60=w[o+0x60], pal=w[o+0xE],
                src=w[o+0x28] | w[o+0x29] << 8 | w[o+0x2A] << 16, f5d=w[o+0x5D])

def run(e, n, held=None, each=None, players=range(5)):
    """held: dict or callable(frame)->dict of held buttons. returns list of per-frame dict p->state"""
    out = []
    for k in range(n):
        h = held(k) if callable(held) else (held or {})
        e.run(1, **h)
        if each: each(e, k)
        w = e.wram()
        out.append({p: pstate(w, p) for p in players})
    return out

def changes(log, p, keys=('anim', 'idx')):
    """list of (frame, state) where anim or idx changed"""
    res = []; last = None
    for k, fr in enumerate(log):
        s = fr[p]; t = tuple(s[x] for x in keys)
        if t != last: res.append((k, s)); last = t
    return res

def summarize(log, p):
    """collapse into runs of anims: [(start_frame, anim, [(idx, frames_shown)...])]"""
    runs = []
    for k, fr in enumerate(log):
        s = fr[p]
        if not runs or runs[-1][1] != s['anim']:
            runs.append([k, s['anim'], []])
        seq = runs[-1][2]
        if seq and seq[-1][0] == s['idx']: seq[-1][1] += 1
        else: seq.append([s['idx'], 1])
    return runs

def print_runs(log, p, label=''):
    for st, a, seq in summarize(log, p):
        print(f'{label} f{st:4d} anim {a:06X} ' + ' '.join(f'{i}x{n}' for i, n in seq))
