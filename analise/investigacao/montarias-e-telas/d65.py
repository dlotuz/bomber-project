"""Disassembler com flags M/X vindos da cobertura (arquivo .cov = 16 MB, bit0 executado, bit1 X, bit2 M)."""
import sys, os
sys.path.insert(0, "/Users/dlotuz/Projetos Claude/Bomber Project/analise/ferramentas")
import dis65816 as D
COVF = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/montarias-e-telas/cov"
_cov = {}
def covs():
    if not _cov:
        for f in sorted(os.listdir(COVF)) if os.path.isdir(COVF) else []:
            if f.endswith('.cov'): _cov[f[:-4]] = open(os.path.join(COVF, f), 'rb').read()
    return _cov

def dis(addr, count=40, m=None, x=None):
    cv = covs()
    pc = addr; out = []
    mm = 1 if m is None else m; xx = 1 if x is None else x
    for _ in range(count):
        fo = D.snes2file(pc)
        if fo is None: break
        tags = ''.join(k[0] if v[pc] & 1 else '.' for k, v in cv.items())
        for v in cv.values():
            if v[pc] & 1:
                mm = 1 if v[pc] & 4 else 0; xx = 1 if v[pc] & 2 else 0; break
        line = D.disasm(pc, 1, mm, xx, stop_on_ret=False, out=1).split('\n')[0]
        out.append(f"{tags} {line}")
        b = D.ROM[fo]; mn, mode = D.OPS[b]; n = D.SIZE[mode]
        if mode == 'immM': n = 1 if mm else 2
        if mode == 'immX': n = 1 if xx else 2
        arg = int.from_bytes(D.ROM[fo+1:fo+1+n], 'little')
        if mn == 'REP':
            if arg & 0x20: mm = 0
            if arg & 0x10: xx = 0
        if mn == 'SEP':
            if arg & 0x20: mm = 1
            if arg & 0x10: xx = 1
        pc = (pc & 0xFF0000) | ((pc + 1 + n) & 0xFFFF)
    print("\n".join(out))

if __name__ == '__main__':
    a = int(sys.argv[1].replace('$','').replace(':',''), 16)
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    dis(a, n)
