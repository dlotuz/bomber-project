import mt, sys, mount_lib as M
from PIL import Image
t=int(sys.argv[1],16)
e=mt.new()
seq=M.mount(e,t)
prev=None
for i,p in enumerate(seq):
    k=(hex(p['rt']),p['r5d'],p['t5c'],p['f51'],p['f32'])
    if k!=prev: print(i,k,p['x'],p['y']); prev=k
print('frames to ride:',len(seq))
e.shot(mt.OUT+f'mount_{t:X}.png')
