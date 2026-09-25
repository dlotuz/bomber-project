from mec import *
e=Dbg("st_stage00"); e.run(1)
e.tap('A', hold=2, after=0)
for i in range(600): e.run(1)
e.bp(0xC354F3); e.bp(0xC4126B); e.bp(0xC41299); e.bp(0xC4123E); e.bp(0xC4122E)
e.run(30)
L=[r for r in e.log() if r['t']=='EXEC']
for r in L[:40]: print(fmt(r))
