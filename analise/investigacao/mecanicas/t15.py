from mec import *
import struct, collections
def rd24(fo): return ROM[fo]|ROM[fo+1]<<8|ROM[fo+2]<<16
def itemlist(p):
    fo=rom24(p); out=[]
    while True:
        c,v=struct.unpack_from('<HH',ROM,fo)
        if c==0xFFFF: break
        out.append((c,v)); fo+=4
    return out
recs=[]
a=0xC362DB
for k in range(16):
    fo=rom24(a+k*0x22)
    ptrs=[rd24(fo+3*i) for i in range(10)]
    il=ptrs[8]
    print(f"rec {k} @{a+k*0x22:06X}", ' '.join(f'{p:06X}' for p in ptrs), 'b30=',hex(ROM[fo+30]), 'p31=',hex(rd24(fo+31)))
    if 0xC37000<il<0xC38200:
        L=itemlist(il); print('   ', len(L), collections.Counter(f'{v:04X}' for c,v in L), [f'{c:04X}' for c,v in L if c!=0x44])
# WRAM tables from arena states
for n in range(1,11):
    e=Dbg(f"st_arena{n:02d}"); e.run(1); w=e.wram(); i=0x8000; L=[]
    while True:
        c=w[i]|w[i+1]<<8
        if c==0xFFFF: break
        L.append((c,w[i+2]|w[i+3]<<8)); i+=4
    print('arena',n,len(L),collections.Counter(f'{v:04X}' for c,v in L))
