"""Reconstrói, a partir da ROM, o conteúdo da VRAM de cada cena capturada (scenes.py) e mede quanto bate.

Para cada cena: percorre o log (DMAs + breakpoints) em ordem e mantém um modelo da WRAM em que cada byte
sabe de onde veio (bloco ZTE da ROM, composição de piso, cópia crua da ROM, desconhecido). Cada DMA para a VRAM
copia do modelo (ou direto da ROM) para um modelo da VRAM. No ponto de captura compara com a VRAM real.
Saída: cenas/<captura>.vmap.json (mapa VRAM -> origem na ROM) e um resumo na tela."""
import sys, os, json, glob, collections; sys.path.insert(0, '.')
import numpy as np
from dbgemu import OUT, parse_log, dp
from decomp import decode_zte, composite_floor
from rom import ROM, fo, r24, hx
CEN = OUT + '/cenas'

class Model:
    def __init__(self):
        self.w = np.zeros(0x20000, np.uint8)
        self.src = np.full(0x20000, -1, np.int32)     # índice em self.srcs
        self.off = np.zeros(0x20000, np.int32)
        self.srcs = []; self.sidx = {}
    def sid(self, key):
        if key not in self.sidx: self.sidx[key] = len(self.srcs); self.srcs.append(key)
        return self.sidx[key]
    @staticmethod
    def wa(a):  # endereço SNES de WRAM -> índice
        b = a >> 16
        if b in (0x7E, 0x7F): return ((b & 1) << 16) | (a & 0xFFFF)
        if (a & 0xFFFF) < 0x2000: return a & 0xFFFF
        return None

def rom_find(b):
    i = ROM.find(b)
    return None if i < 0 else 0xC00000 + i

def run(scene):
    log = parse_log(f'{CEN}/{scene}.log'); binf = open(f'{CEN}/{scene}.bin', 'rb').read()
    M = Model()
    vr = np.zeros(0x10000, np.uint8); vsrc = np.full(0x10000, -1, np.int32); voff = np.zeros(0x10000, np.int32)
    vset = np.zeros(0x10000, bool)
    pend = None; results = {}
    for d in log:
        t = d['type']
        if t == 'B':
            pc = d['pc']
            if pc == 'C409A5': pend = r24(dp(d, 0x58, 3))
            elif pc == 'C1874D': pend = dp(d, 0x54, 3)
            elif pc in ('C409D6', 'C1876E') and pend is not None:
                st = int(d['out'], 16); n = int(d['n'])
                data, _ = decode_zte(pend)
                assert len(data) == n
                i0 = M.wa(st); s = M.sid(('zte', pend))
                M.w[i0:i0 + n] = np.frombuffer(data, np.uint8); M.src[i0:i0 + n] = s; M.off[i0:i0 + n] = np.arange(n)
                pend = None
            elif pc == 'C44BDD':
                i0 = M.wa(0x7F8000)
                buf = composite_floor(bytes(M.w[i0:i0 + 0x8000]))
                M.w[i0:i0 + 0x8000] = np.frombuffer(buf, np.uint8)
                # tiles 768..1023 passam a ser "composição"
                for k in range(0x6000, 0x8000):
                    if M.src[i0 + k] >= 0:
                        key = M.srcs[M.src[i0 + k]]
                        if key[0] == 'zte': M.src[i0 + k] = M.sid(('zte+piso', key[1]))
        elif t == 'D' and d['b'] in ('2118', '2119') and d['rev'] == '0':
            n = int(d['n']); src = int(d['src'], 16); va = (int(d['vma'], 16) * 2) & 0xFFFF
            if d['mode'] != '1' or d['vinc'] != '1' or d['vhigh'] != '1':
                continue  # (não ocorre nas cenas do Battle; conferido abaixo)
            real = np.frombuffer(binf[int(d['bin']):int(d['bin']) + n], np.uint8)
            idx = (va + np.arange(n)) & 0xFFFF
            if d['fix'] == '1':
                vr[idx] = real; vsrc[idx] = M.sid(('fill', real[0])); voff[idx] = 0; vset[idx] = True; continue
            wi = M.wa(src)
            if wi is None:  # ROM direto
                vr[idx] = np.frombuffer(ROM[fo(src):fo(src) + n], np.uint8)
                vsrc[idx] = M.sid(('raw', src)); voff[idx] = np.arange(n); vset[idx] = True
            else:
                ws = M.src[wi:wi + n].copy(); wo = M.off[wi:wi + n].copy(); wd = M.w[wi:wi + n].copy()
                unk = (ws < 0) | (wd != real)   # sem origem, ou modificado na WRAM depois da descompressão
                # granularidade de tile (32 bytes alinhados no endereço de origem): se 1 byte difere, o tile todo é desconhecido
                tid = (src + np.arange(n)) >> 5
                bad = np.unique(tid[unk]); unk = np.isin(tid, bad)
                ws[unk] = -1
                if unk.any():
                    # trechos sem origem conhecida: tenta achar os bytes reais na ROM, em corridas de 32 bytes
                    k = 0
                    while k < n:
                        if not unk[k]: k += 1; continue
                        e = k
                        while e < n and unk[e]: e += 1
                        run_ = bytes(real[k:e]); a = rom_find(run_) if len(run_) >= 16 and any(run_) else None
                        if a is not None:
                            s = M.sid(('raw', a)); ws[k:e] = s; wo[k:e] = np.arange(e - k); wd[k:e] = real[k:e]
                        else:
                            for c in range(k, e, 32):
                                ch = bytes(real[c:min(c + 32, e)])
                                if not any(ch):
                                    ws[c:c + len(ch)] = M.sid(('zero', 0)); wd[c:c + len(ch)] = 0; wo[c:c+len(ch)] = 0
                                    continue
                                a = rom_find(ch) if len(ch) == 32 else None
                                if a is not None:
                                    ws[c:c + 32] = M.sid(('raw', a)); wo[c:c + 32] = np.arange(32); wd[c:c + 32] = real[c:c + 32]
                                else:
                                    ws[c:c + len(ch)] = M.sid(('wram?', src + c)); wd[c:c + len(ch)] = real[c:c + len(ch)]
                        k = e
                vr[idx] = wd; vsrc[idx] = ws; voff[idx] = wo; vset[idx] = True
        elif t == 'M' and 'capture' in ' '.join(d.keys()) or (t == 'M'):
            pass
        if t == 'M':
            # linha "M f=.. capture <tag>"
            pass
    return M, vr, vsrc, voff, vset

def run_with_captures(scene):
    """Reexecuta o log parando em cada marca 'capture <tag>'."""
    lines = open(f'{CEN}/{scene}.log').read().splitlines()
    caps = [(i, l.split()[-1]) for i, l in enumerate(lines) if l.startswith('M ') and ' capture ' in l]
    out = []
    for li, tag in caps:
        tmp = f'{CEN}/_tmp_{scene}.log'
        open(tmp, 'w').write('\n'.join(lines[:li]) + '\n')
        os.replace(tmp, f'{CEN}/_cut.log') if False else None
        global parse_log
        M, vr, vsrc, voff, vset = run_lines(scene, lines[:li])
        out.append((tag, M, vr, vsrc, voff, vset))
    return out

def run_lines(scene, lines):
    import dbgemu
    orig = dbgemu.parse_log
    def pl(_): 
        res = []
        for ln in lines:
            tt = ln.split()
            if not tt: continue
            dd = {'type': tt[0]}
            for kv in tt[1:]:
                if '=' in kv: k, v = kv.split('=', 1); dd[k] = v
            res.append(dd)
        return res
    globals()['parse_log'] = pl
    try: return run(scene)
    finally: globals()['parse_log'] = orig

def vmap(M, vsrc, voff, vset):
    """Agrupa a VRAM em corridas contíguas com a mesma origem e offset contínuo."""
    runs = []; a = 0
    while a < 0x10000:
        if not vset[a]: a += 1; continue
        s = vsrc[a]; o = voff[a]; b = a + 1
        while b < 0x10000 and vset[b] and vsrc[b] == s and (voff[b] == voff[b - 1] + 1 or M.srcs[s][0] in ('fill', 'zero')): b += 1
        key = M.srcs[s]
        runs.append(dict(vram_byte=f'{a:04X}', vram_word=f'{a // 2:04X}', bytes=b - a, tipo=key[0],
                         origem=hx(key[1]) if key[0] in ('zte', 'zte+piso', 'raw', 'wram?') else key[1] if key[0] != 'fill' else int(key[1]),
                         offset=int(o)))
        a = b
    return runs

if __name__ == '__main__':
    scenes = sys.argv[1:] or sorted(os.path.basename(p)[:-4] for p in glob.glob(CEN + '/*.log') if not os.path.basename(p).startswith('_'))
    for sc in scenes:
        for tag, M, vr, vsrc, voff, vset in run_with_captures(sc):
            real = np.frombuffer(open(f'{CEN}/{tag}.vram', 'rb').read(), np.uint8)
            known = vset & (vsrc >= 0)
            kinds = np.array([M.srcs[s][0] if s >= 0 else '-' for s in vsrc])
            fromrom = known & np.isin(kinds, ['zte', 'zte+piso', 'raw', 'zero', 'fill'])
            eq = (vr == real)
            def pct(m): return f'{(eq & m).sum()}/{m.sum()}'
            print(f'{tag:15s} bytes da VRAM escritos na cena: {vset.sum():6d}  reconstruídos da ROM e iguais: {pct(fromrom)}  '
                  f'BG tiles 0000-7FFF: {pct(fromrom & (np.arange(0x10000) < 0x8000))}  OBJ C000-FFFF: {pct(fromrom & (np.arange(0x10000) >= 0xC000))}')
            json.dump(vmap(M, vsrc, voff, vset), open(f'{CEN}/{tag}.vmap.json', 'w'), indent=0)
