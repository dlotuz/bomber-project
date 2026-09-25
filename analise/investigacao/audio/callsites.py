"""Lista estática dos call sites de JSL $C34A7F (SFX), $C34A44 (música), $C34AF9 (stream/voz), $C34A16 (bloco)
e o valor imediato carregado em A logo antes (LDA #imm)."""
import re, sys
ROM = open("/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc", "rb").read()
T = {0xC34A7F: 'SFX', 0xC34A44: 'MUS', 0xC34AF9: 'STR', 0xC34A16: 'BLK', 0xC349ED: 'C18', 0xC349F4: 'C13', 0xC3492F: 'S2F'}
def imm_before(o):
    # procura LDA #imm16 (A9 lo hi) ou LDA #imm8 nos 8 bytes anteriores
    for back in (3, 2):
        p = o - back
        if ROM[p] == 0xA9:
            return int.from_bytes(ROM[p+1:o], 'little')
    return None
out = []
for t, name in T.items():
    pat = b'\x22' + t.to_bytes(3, 'little')
    for m in re.finditer(re.escape(pat), ROM):
        o = m.start(); v = imm_before(o)
        out.append((name, v, '%02X:%04X' % (0xC0 + (o >> 16), o & 0xFFFF), o))
if __name__ == '__main__':
    for name, v, a, o in sorted(out, key=lambda r: (r[0], -1 if r[1] is None else r[1], r[3])):
        print(name, '--' if v is None else '%02X' % (v & 0xFF), a, 'ret=%06X' % (0xC00000 + o + 3))
