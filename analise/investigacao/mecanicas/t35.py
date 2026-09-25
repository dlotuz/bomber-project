from mec import *
for n in range(1,11):
    e=Dbg(f"st_arena{n:02d}"); e.run(1); print(n, '$9C=',hex(e.r16(0x9C)), '$1A4=',e.r16(0x1A4), 'players', [pos(e,k) for k in range(5)])
