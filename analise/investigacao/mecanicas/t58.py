from mec import *
e=Dbg("st_stage00"); e.run(1)
e.tap('A', hold=2, after=0)
for i in range(505): e.run(1)
print('soft now', sum(1 for row in grid(e) for v in row if v==0xCC80))
e.bp(0xC4179C); e.bp(0xC417E2); e.bp(0xC41824); e.bp(0xC4121D); e.rw(0x42,0x43)
for i in range(20): e.run(1)
L=e.log()
for r in L:
    if r['t']=='EXEC' or (r['t'] in ('R16','R8') and r['pc'] in (0xC4179E,)): print(fmt(r))
print('soft now', sum(1 for row in grid(e) for v in row if v==0xCC80))
