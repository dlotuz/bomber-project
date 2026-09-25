# procura referencias absolutas a um endereco de WRAM (abs 16 bits e long $7E/$00) na ROM
import sys
from ac import ROM
def refs(addr):
    lo, hi = addr & 0xFF, (addr >> 8) & 0xFF
    out = []
    for op in (0xAD, 0xAE, 0xAC, 0x8D, 0x8E, 0x8C, 0x9C, 0xCD, 0xEC, 0xCC, 0x2D, 0x0D, 0xEE, 0xCE, 0x6D, 0xED, 0x2C, 0xBD, 0xB9, 0x9D, 0x99, 0x0C, 0x1C):
        pat = bytes([op, lo, hi]); i = ROM.find(pat)
        while 0 <= i < 0x230000:
            out.append((0xC00000 + i, '%02X abs' % op)); i = ROM.find(pat, i + 1)
    for op in (0xAF, 0x8F, 0xCF, 0x2F, 0x0F, 0x6F, 0xEF, 0xBF, 0x9F):
        for bank in (0x00, 0x7E):
            pat = bytes([op, lo, hi, bank]); i = ROM.find(pat)
            while 0 <= i < 0x230000:
                out.append((0xC00000 + i, '%02X long' % op)); i = ROM.find(pat, i + 1)
    return sorted(out)
if __name__ == '__main__':
    for a in sys.argv[1:]:
        print(a, ['%06X %s' % x for x in refs(int(a, 16))])
