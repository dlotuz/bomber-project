# resume log: chamadas com alvo, colapsa repeticoes; tambem mostra DMA e faixas de RR/WW
import sys
from ac import ROM, s2f
L = sys.argv[1]; fr0 = int(sys.argv[2]) if len(sys.argv) > 2 else 0; fr1 = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
prev = None; cnt = 0; rr = None
def flush():
    global prev, cnt
    if prev: print(prev + ('  x%d' % cnt if cnt > 1 else ''))
    prev = None; cnt = 0
for line in open(L):
    p = line.split(); fr = int(p[0])
    if fr < fr0 or fr > fr1: continue
    if p[1] == 'T':
        pc = int(p[2], 16); fo = s2f(pc); op = ROM[fo]
        if op == 0x22: tgt = '%06X' % int.from_bytes(ROM[fo+1:fo+4], 'little')
        elif op == 0x20: tgt = '%02X%04X' % (pc >> 16, int.from_bytes(ROM[fo+1:fo+3], 'little'))
        else: tgt = '(%04X,X) X=%s' % (int.from_bytes(ROM[fo+1:fo+3], 'little'), p[4])
        s = '%s CALL %s -> %s  %s' % (p[0], p[2], tgt, ' '.join(p[3:6]))
        key = s.split('  ')[0][len(p[0]):]
    elif p[1] in ('RR', 'WW'):
        s = '%s %s %s %s' % (p[0], p[1], p[2], p[3] + ' ' + p[4])
        key = '%s %s' % (p[1], p[2])
    else:
        s = line.strip(); key = s
    if prev is not None and prev.split(' ', 1)[1].split('  ')[0] == key.strip().split('  ')[0]:
        cnt += 1; continue
    flush(); prev = s; cnt = 1
flush()
