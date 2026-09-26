"""Gera tests/fixtures/rom/movement.json: cenários do t33 (st_arena01 semente 5, 60 tentativas, 6 bombas;
st_arena05 semente 6, 60 tentativas, 12 bombas). Cada tick lógico é gravado pelo movesim; a cada quadro o
emulador é conferido e qualquer divergência aborta (o fixture só sai com 0 divergências)."""
import sys, os, json, random
HERE = os.path.dirname(os.path.abspath(__file__))
MEC = os.path.normpath(os.path.join(HERE, '../../../../analise/investigacao/mecanicas'))
sys.path.insert(0, MEC); os.chdir(MEC)
from mec import *          # noqa
import movesim             # noqa

OUT_JSON = os.path.normpath(os.path.join(HERE, '../../../tests/fixtures/rom/movement.json'))
BTN = {'UP': 1, 'DOWN': 2, 'LEFT': 4, 'RIGHT': 8}          # BTN do core
COMBOS = [['UP'], ['DOWN'], ['LEFT'], ['RIGHT'], ['UP', 'LEFT'], ['UP', 'RIGHT'], ['DOWN', 'LEFT'], ['DOWN', 'RIGHT'], []]

def gridd(e):
    w = e.wram()
    return {r * 0x40 + c * 2: w[0x2800 + r * 0x40 + c * 2] | w[0x2801 + r * 0x40 + c * 2] << 8 for r in range(14) for c in range(17)}

def run(st, seed, trials, nbombs, stage):
    random.seed(seed)
    e = TDbg(st); e.run(1); base = e.save(); out = []
    for _ in range(trials):
        e.load(base); g = gridd(e)
        free = [(c, r) for r in range(1, 12) for c in range(2, 15) if g[r * 0x40 + c * 2] == 0]
        c, r = random.choice(free)
        for _ in range(nbombs):
            bc, br = random.choice(free)
            if (bc, br) != (c, r): e.w16(0x2800 + br * 0x40 + bc * 2, 0xC900)
        g = gridd(e)
        lvl = random.choice([1, 1, 2, 3, 4, 5, 0, 6, 7]); e.w8(0x340, lvl)
        X = (cx(c) + random.randint(-7, 8)) << 8; Y = (cy(r) + random.randint(-7, 8)) << 8
        if g.get(movesim.cell_of(X >> 8, Y >> 8), 1) != 0: continue
        e.w16(0x311, X & 0xFFFF); e.w8(0x313, X >> 16); e.w16(0x315, Y & 0xFFFF); e.w8(0x317, Y >> 16)
        e.run(1)
        X = e.r16(0x311) | e.r8(0x313) << 16; Y = e.r16(0x315) | e.r8(0x317) << 16
        x0, y0 = X, Y; seq = []
        for _ in range(13):
            cb = random.choice(COMBOS); seq += [cb] * random.randint(3, 25)
        inputs, d = [], []
        for cb in seq:
            dp = sum(movesim.BTN[b] for b in cb)
            k = e.step(p0=cb)
            for _ in range(k):
                nx, ny, _ = movesim.step(X, Y, dp, lvl, g)
                d += [nx - X, ny - Y]; X, Y = nx, ny
                mask = sum(BTN[b] for b in cb)
                if inputs and inputs[-1][0] == mask: inputs[-1][1] += 1
                else: inputs.append([mask, 1])
            EX = e.r16(0x311) | e.r8(0x313) << 16; EY = e.r16(0x315) | e.r8(0x317) << 16
            assert (EX, EY) == (X, Y), f'divergência em {st} tentativa com início {(c, r)}'
        grid17 = [g.get(lin * 0x40 + col * 2, 0) for lin in range(13) for col in range(17)]
        out.append({'stage': stage, 'grid': grid17, 'level': lvl, 'x0': x0, 'y0': y0, 'inputs': inputs, 'd': d})
    return out

if __name__ == '__main__':
    trials = run('st_arena01', 5, 60, 6, 1) + run('st_arena05', 6, 60, 12, 5)
    ticks = sum(n for t in trials for _, n in t['inputs'])
    json.dump({'source': 'scripts/rom-facts/core-fixtures/gen_movement.py (t33.py st_arena01 5 60 6 + st_arena05 6 60 12)',
               'romSha1': '38f4394986bd39fcbe32a722a3fe103ee6177d9b', 'ticks': ticks, 'trials': trials},
              open(OUT_JSON, 'w'), separators=(',', ':'))
    print('ok', ticks, 'ticks', OUT_JSON)
