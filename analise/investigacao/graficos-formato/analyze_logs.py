"""Resume os logs de DMA: agrupa transferências por (rotina, origem, destino) e lista escritores da WRAM."""
import sys, re, collections
sys.path.insert(0,'.')
from dbgemu import OUT
PER = {('C40D3E','7E5000'),('C419DE','7E8E00'),('C18BF6','7F0000'),('C188E2','C188E6')}
STREAM = {'C18949','C18976','C189A3','C189D0','C189FD','C18A2A','C18A57','C18A84','C40AB3','C40AE3'}
def parse(path):
    for ln in open(path):
        if ln[0] != 'D': continue
        d = dict(kv.split('=',1) for kv in ln.split()[1:] if '=' in kv)
        yield d
def summarize(names):
    groups = collections.OrderedDict(); stream = collections.defaultdict(set)
    for nm in names:
        for d in parse(f'{OUT}/{nm}.log'):
            if (d['pc'], d['src']) in PER: continue
            if d['pc'] in STREAM:
                stream[d['src'][:2]].add(int(d['src'],16)); continue
            key = (d['pc'], d['src'], d['n'], d['b'], d['vma'] if d['b'] in ('2118','2119') else d['cg'])
            g = groups.setdefault(key, [nm, int(d['f']), 0, set()])
            g[2] += 1
            if 'writers' in d: g[3].update(d['writers'].split(','))
    for k, g in groups.items():
        print(f"{g[0]:8s} f={g[1]:6d} x{g[2]:<4d} pc={k[0]} src={k[1]} n={int(k[2]):6d} B=21{k[3]} dst={k[4]}  {' '.join(sorted(g[3]))}")
    print('stream banks:', {b: (hex(min(v)), hex(max(v)), len(v)) for b, v in stream.items()})
summarize(sys.argv[1:])
