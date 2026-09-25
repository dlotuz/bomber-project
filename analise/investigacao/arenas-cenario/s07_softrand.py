# testa se o layout de soft blocks muda com o tempo de espera antes de iniciar a fase; registra a semente $AE
from ac import *
e = DEmu()
res = {}
for wait in (0, 1, 7, 60, 333):
    e.loadst('st_stage00'); e.run(1 + wait)
    ae0 = e.r16(0xAE)
    e.tap('A'); e.run(700)
    g = e.wram()[0x2800:0x2800 + 13 * 64]
    n = sum(1 for i in range(0, len(g), 2) if g[i] == 0x80 and g[i+1] == 0xCC)
    res[wait] = g
    print('wait', wait, 'AE before=%04X' % ae0, 'soft', n, 'hash', hash(g) & 0xFFFF)
