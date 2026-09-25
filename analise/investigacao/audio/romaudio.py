"""Leitura das tabelas de áudio do SB4 direto da ROM (reimplementável em TS)."""
ROMP = "/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"
R = open(ROMP, 'rb').read()
def f(a): return ((a >> 16) - 0xC0) << 16 | (a & 0xFFFF)          # HiROM $C0-$FF -> offset
def w(o): return R[o] | R[o + 1] << 8
def l(o): return R[o] | R[o + 1] << 8 | R[o + 2] << 16
BLOCK_TAB = 0x000190; NBLOCKS = 0x32                                 # $C0:0190, 3 bytes/entrada
MUSIC_TAB = 0x000739; SFX_TAB = 0x000787; STREAM_TAB = 0x0007B9
SET_TAB = f(0xDA17D2); SMP_PTR = f(0xDA2118); SMP_LEN = f(0xDA2238); NSAMPLES = 0x60

def block(i):
    """-> lista de (dest, bytes) e o ponteiro final. Formato IPL: [len16][dest16][data]... len=0 termina."""
    p = l(BLOCK_TAB + 3 * i); o = f(p); out = []
    while True:
        n = w(o)
        if n == 0: return out, w(o + 2)
        d = w(o + 2); out.append((d, R[o + 4:o + 4 + n])); o += 4 + n

def music(i):  return tuple(R[MUSIC_TAB + 3 * i:MUSIC_TAB + 3 * i + 3])   # (bloco, set de samples, comando)
def sfx_cmd(i): return R[SFX_TAB + i]                                       # id SFX -> comando $2140
def stream(i): return R[STREAM_TAB + 2 * i], R[STREAM_TAB + 2 * i + 1]    # (bloco, comando)
def sample(s): return R[f(l(SMP_PTR + 3 * s)):f(l(SMP_PTR + 3 * s)) + w(SMP_LEN + 2 * s)]

def sample_set(k):
    """-> (upload inicial [(dest,bytes)], dest dos samples, [ids de samples])"""
    d = f(0xDA0000 | w(SET_TAB + 2 * k)); up = f(0xDA0000 | w(d)); dest = w(d + 2)
    ids = []; q = d + 4
    while R[q] != 0xFF: ids.append(R[q]); q += 1
    first = []
    while True:
        n = w(up)
        if n == 0: break
        first.append((w(up + 2), R[up + 4:up + 4 + n])); up += 4 + n
    return first, dest, ids

def identify(ram):
    """Qual bloco de música/stream está carregado na RAM do APU (compara bytes)."""
    hits = []
    for i in range(1, NBLOCKS):
        try: segs, _ = block(i)
        except Exception: continue
        if segs and all(ram[d:d + len(b)] == b for d, b in segs if d + len(b) <= 0x10000 and d < 0xFF00):
            hits.append(i)
    return hits
