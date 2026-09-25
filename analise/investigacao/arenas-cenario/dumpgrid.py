from ac import *
import sys
def grid(r, base, rows=15, cols=17):
    return [[r[base + y*0x40 + x*2] | (r[base + y*0x40 + x*2 + 1] << 8) for x in range(cols)] for y in range(rows)]
if __name__ == '__main__':
    n = int(sys.argv[1]); bases = [int(a, 16) for a in sys.argv[2:]] or [0x2000, 0x2800, 0x3800]
    st = open(EST + '/st_arena%02d.bin' % n, 'rb').read(); r = blocks(st)['RAM']
    for b in bases:
        print('--- $%04X' % b)
        for row in grid(r, b): print(' '.join('%04X' % v for v in row))
