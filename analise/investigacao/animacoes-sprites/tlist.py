"""Trace listing: run a savestate with CPU trace on and print every executed instruction
(disassembled with the real M/X flags), exec count, a sample of registers and the ROM/WRAM
addresses it read/wrote.
usage: tlist.py STATE NFRAMES_SKIP NFRAMES_TRACE [lo_pc hi_pc] [--in P0BUTTONS]"""
import sys, collections
sys.path.insert(0, "/Users/dlotuz/Projetos Claude/Bomber Project/analise/ferramentas")
from st import *
import dis65816 as D

def one(pc, m, x):
    t = D.disasm(pc, 1, m, x, stop_on_ret=False, out=1).splitlines()[0]
    return t

def trace(e, nframes, logpath, held=None, lo=0, hi=0xFFFFFF, rom=True, ram=True):
    e.lib.dbg_enable(1); e.dbg_open(logpath); e.lib.dbg_set_trace(1)
    e.lib.dbg_set_ranges(0 if ram else 1, 0x20000 if ram else 0, 0 if rom else 1, 0x400000 if rom else 0, 0 if ram else 1, 0x20000 if ram else 0)
    e.run(nframes, **(held or {}))
    e.lib.dbg_set_trace(0); e.lib.dbg_close(); e.lib.dbg_set_ranges(1, 0, 1, 0, 1, 0)

def parse(logpath, lo=0, hi=0xFFFFFF):
    ex = collections.OrderedDict(); cnt = collections.Counter(); regs = {}
    rd = collections.defaultdict(set); wr = collections.defaultdict(set); rr = collections.defaultdict(set)
    for ln in open(logpath):
        p = ln.split()
        if p[0] == 'X':
            pc = int(p[2], 16)
            if not (lo <= pc < hi): continue
            P = int(p[8][2:], 16)
            ex.setdefault(pc, set()).add(P & 0x30); cnt[pc] += 1
            if pc not in regs: regs[pc] = ' '.join(p[3:8])
        elif p[0] in 'RWr':
            pc = int(p[2], 16)
            if not (lo <= pc < hi): continue
            a = int(p[3], 16)
            (rd if p[0] == 'R' else wr if p[0] == 'W' else rr)[pc].add(a)
    return ex, cnt, regs, rd, wr, rr

def rng(s):
    s = sorted(s)
    if not s: return ''
    out = []; a = b = s[0]
    for v in s[1:]:
        if v <= b + 2: b = v
        else: out.append((a, b)); a = b = v
    out.append((a, b))
    txt = ','.join(f'{a:X}' if a == b else f'{a:X}-{b:X}' for a, b in out[:6])
    return txt + ('...' if len(out) > 6 else '')

def listing(logpath, lo=0, hi=0xFFFFFF):
    ex, cnt, regs, rd, wr, rr = parse(logpath, lo, hi)
    lines = []
    for pc in sorted(ex):
        fl = sorted(ex[pc])[0]
        t = one(pc, 1 if fl & 0x20 else 0, 1 if fl & 0x10 else 0)
        extra = ''
        if rd[pc]: extra += ' ROM[' + rng(rd[pc]) + ']'
        if rr[pc]: extra += ' rd[' + rng(rr[pc]) + ']'
        if wr[pc]: extra += ' wr[' + rng(wr[pc]) + ']'
        lines.append(f'{t:<44} n={cnt[pc]:<5} {regs[pc]}{extra}')
    return '\n'.join(lines)

if __name__ == '__main__':
    st = sys.argv[1]; skip = int(sys.argv[2]); n = int(sys.argv[3])
    lo = int(sys.argv[4], 16) if len(sys.argv) > 4 else 0
    hi = int(sys.argv[5], 16) if len(sys.argv) > 5 else 0xFFFFFF
    e = emu(True, st); e.run(skip)
    lp = '/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/rom-animacoes/trace.log'
    trace(e, n, lp)
    print(listing(lp, lo, hi))
