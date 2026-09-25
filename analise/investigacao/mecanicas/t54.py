from mec import *
import itemsim
e=Dbg("st_stage00"); e.run(1)
e.tap('A', hold=2, after=0)
e.bp(0xC4121D)
for i in range(700):
    e.run(1)
    if any(r['pc']==0xC4121D for r in e.log()): break
print('frame', e.nframes)
g=grid(e)
print('\n'.join(' '.join(f'{v:04X}' for v in row) for row in g[:13]))
soft={r*0x40+c*2 for r in range(14) for c in range(16) if g[r][c]==0xCC80}
print(len(soft))
