"""Confere a forma e os números conhecidos dos fixtures (valores medidos no emulador para o plano 6)."""
import json, os, sys
D = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests/fixtures/rom'))
m = json.load(open(os.path.join(D, 'movement.json')))
assert m['romSha1'] == '38f4394986bd39fcbe32a722a3fe103ee6177d9b'
assert m['ticks'] >= 20000, m['ticks']
assert os.path.getsize(os.path.join(D, 'movement.json')) < 400 * 1024
n = 0
for t in m['trials']:
    assert len(t['grid']) == 221 and t['stage'] in (1, 5)
    k = sum(c for _, c in t['inputs']); assert len(t['d']) == 2 * k; n += k
assert n == m['ticks']
r = json.load(open(os.path.join(D, 'rounds.json')))
assert r['rng']['start'] == 0x12 and len(r['rng']['calls']) == 207 and r['rng']['final'] == 0x5e71
st = [r['stages'][str(k)] for k in range(1, 11)]
assert [len(s['soft']) for s in st] == [80, 80, 80, 70, 0, 80, 62, 0, 78, 80]
assert [len(s['items']) for s in st] == [30, 31, 35, 26, 0, 34, 35, 0, 32, 33]
assert [s['afterRemove'] for s in st] == [0x5191, 0x5191, 0x25d9, 0x1fc9, 0x9401, 0x5191, 0x1fc9, 0xc689, 0xe4c1, 0x5191]
assert [s['afterItems'] for s in st] == [0x5e71, 0x3bc1, 0xc9b1, 0xcfd9, 0x9401, 0x61b3, 0x4219, 0xc689, 0x0d41, 0xc9b1]
print('fixtures ok', m['ticks'], 'ticks')
