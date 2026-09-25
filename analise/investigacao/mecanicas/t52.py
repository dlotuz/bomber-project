from mec import *
import struct
e=Dbg("st_stage00"); e.run(1)
seed0=e.r16(0xAE); print('seed0',hex(seed0))
e.tap('A', hold=2, after=0)
e.bp(0xC354B3); e.bp(0xC354F3); e.bp(0xC4121D); e.bp(0xC412D8)
for i in range(700): e.run(1)
L=[r for r in e.log() if r['t']=='EXEC']
calls=[]
cur=None
for r in L:
    if r['pc']==0xC354B3: cur=[r['y'], r['f']]
    elif r['pc']==0xC354F3 and cur: calls.append((cur[0], r['a'], cur[1])); cur=None
    elif r['pc'] in (0xC4121D,0xC412D8): calls.append(('MARK',hex(r['pc']),r['f']))
print(len(calls)); print(calls[:12])
# model
def rng(seed, n):
    s=((seed|1)*0x383)&0xFFFF
    return s, (s*(n&0xFF))>>16
s=seed0; ok=0; bad=0
for c in calls:
    if c[0]=='MARK': continue
    s,v=rng(s,c[0])
    if v==c[1]: ok+=1
    else: bad+=1
print('rng model ok',ok,'bad',bad, 'final seed model',hex(s),'emu',hex(e.r16(0xAE)))
from collections import Counter
print(Counter(c[2] for c in calls if c[0]!='MARK'))
print([c for c in calls if c[0]=='MARK'])
