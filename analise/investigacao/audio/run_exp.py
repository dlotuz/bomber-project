"""uso: run_exp.py <experimento>  (experimentos em exper.py)"""
import sys
from exper import *
def main():
    name = sys.argv[1]; st, fn = EXPS[name]
    e = AEmu(); e.hook(*HOOKS); e.state(st); e.run(1)
    L = D + f'exp_{name}.log'; e.log(L); marks = []
    def mark(t): e.flush(); marks.append((e.lib.aud_frame if False else e.nframes, t))
    base = e.nframes
    fn(e, mark); e.log(None); e.shot(D + f'exp_{name}.png')
    ev = []
    for li in open(L):
        if li.startswith('H'):
            p = li.split(); k = HOOKS[int(p[2], 16)]
            if k.startswith('drv') or k == 'SFXSEND(A)': continue
            ev.append((int(p[1]) - 1, k, p[3][-2:] if k != 'MUSIC(A)' else p[3], p[5], p[7]))
    # nframes conta frames desde que o processo começou; aud_frame idem (1-based)
    allv = sorted([(f, 0, 'MARK', t) for f, t in marks] + [(x[0], 1) + x[1:] for x in ev])
    for r in allv:
        if r[2] == 'MARK': print('%5d  ---- %s' % (r[0] - base, r[3]))
        else: print('%5d  %s %s %s %s' % (r[0] - base, r[2], r[3], r[4], r[5]))

main()
