from mec import *
e=Dbg("st_stage00"); e.run(1)
e.tap('A', hold=2, after=0)
e.bp(0xC41824)
for i in range(600):
    st=e.save()
    e.run(1)
    if any(r['pc']==0xC41824 for r in e.log() if r['t']=='EXEC'): break
e.load(st)
print('frame before', e.nframes-1)
g=grid(e)
print('\n'.join(' '.join(f'{v:04X}' for v in row) for row in g[:13]))
print(sum(1 for row in g for v in row if v==0xCC80))
