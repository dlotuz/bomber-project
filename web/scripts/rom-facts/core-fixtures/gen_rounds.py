"""Gera tests/fixtures/rom/rounds.json: soft blocks, itens escondidos e sementes das 10 fases (5 jogadores, boot),
mais a sequência de 207 chamadas de RNG do t52. Roda no core instrumentado da frente mecanicas."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
MEC = os.path.normpath(os.path.join(HERE, '../../../../analise/investigacao/mecanicas'))
sys.path.insert(0, MEC); os.chdir(MEC)
from mec import *          # noqa: E402,F401  (Dbg, grid, OUT)
import itemsim             # noqa: E402

OUT_JSON = os.path.normpath(os.path.join(HERE, '../../../tests/fixtures/rom/rounds.json'))

def rng_calls():
    e = Dbg("st_stage00"); e.run(1)
    seed0 = e.r16(0xAE)
    e.tap('A', hold=2, after=0)
    e.bp(0xC354B3); e.bp(0xC354F3)
    for _ in range(700): e.run(1)
    calls, cur = [], None
    for r in e.log():
        if r['t'] != 'EXEC': continue
        if r['pc'] == 0xC354B3: cur = r['y']
        elif r['pc'] == 0xC354F3 and cur is not None: calls.append([cur, r['a']]); cur = None
    s = seed0
    for n, v in calls:
        s, m = itemsim.rng(s, n)
        assert m == v, 'modelo do RNG divergiu'
    return {'start': seed0, 'calls': calls, 'final': s}

def stage(s):
    base = json.load(open(OUT + 'layouts_base.json'))
    e = Dbg(f"st_stage{s:02d}"); e.run(1)
    e.tap('A', hold=2, after=0)
    e.bp(0xC4179C); e.bp(0xC4121D)
    seedR = seedI = None
    for _ in range(900):
        st = e.save(); n0 = e.lib.dbg_count()
        e.run(1)
        new = [r for r in e.log()[n0:] if r['t'] == 'EXEC']
        if seedR is None and any(r['pc'] == 0xC4179C for r in new):
            e.load(st); seedR = e.r16(0xAE); e.run(1)
        if any(r['pc'] == 0xC4121D for r in new):
            e.load(st); e.run(1)
            for _ in range(10): e.run(1)
            break
    rows = base[str(s + 1)]['base']
    soft = {(r + 1) * 64 + (c + 2) * 2 for r in range(11) for c in range(13) if rows[r][c] == 'x'}
    soft = itemsim.carve(soft)
    soft, after_remove = itemsim.remove_random(soft, base[str(s + 1)]['remove'], seedR)
    g = grid(e)
    real = {r * 64 + c * 2 for r in range(14) for c in range(16) if g[r][c] == 0xCC80}
    assert soft == real, f'fase {s+1}: layout do modelo ≠ emulador'
    w = e.wram(); i = 0x8000; items = []
    while True:
        cc = w[i] | w[i + 1] << 8
        if cc == 0xFFFF: break
        items.append([cc, w[i + 2] | w[i + 3] << 8]); i += 4
    seed = after_remove
    if s + 1 == 6: seed, _ = itemsim.rng(seed, 64)       # arena 6: 64 + rnd(64) antes dos itens
    tab, after_items = itemsim.build(real, itemsim.stage_list(s + 1), seed)
    assert [list(t) for t in tab] == items, f'fase {s+1}: itens do modelo ≠ emulador'
    return {'soft': sorted(real), 'items': items, 'afterRemove': after_remove, 'afterItems': after_items}

if __name__ == '__main__':
    out = {'source': 'scripts/rom-facts/core-fixtures/gen_rounds.py (t61.py nas 10 fases + t52.py)',
           'romSha1': '38f4394986bd39fcbe32a722a3fe103ee6177d9b', 'rng': rng_calls(),
           'stages': {str(s + 1): stage(s) for s in range(10)}}
    json.dump(out, open(OUT_JSON, 'w'), separators=(',', ':'))
    print('ok', OUT_JSON)
