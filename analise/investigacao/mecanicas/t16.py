from mec import *
import struct, collections
def rd24(fo): return ROM[fo]|ROM[fo+1]<<8|ROM[fo+2]<<16
def itemlist(p):
    fo=rom24(p); out=[]
    while True:
        c,v=struct.unpack_from('<HH',ROM,fo)
        if c==0xFFFF: break
        out.append((c,v)); fo+=4
        if len(out)>80: return None
    return out
arena={}
for n in range(1,11):
    e=Dbg(f"st_arena{n:02d}"); e.run(1); w=e.wram(); i=0x8000; L=[]
    while True:
        c=w[i]|w[i+1]<<8
        if c==0xFFFF: break
        L.append((c,w[i+2]|w[i+3]<<8)); i+=4
    arena[n]=collections.Counter(v for c,v in L)
# all records: scan bank C3 for 0x22-byte records with ptr8 in C37xxx-C38xxx
for k in range(-40,60):
    a=0xC362DB+k*0x22; fo=rom24(a)
    il=rd24(fo+24)
    if not (0xC37000<il<0xC38800): continue
    L=itemlist(il)
    if L is None: continue
    c=collections.Counter(v for _,v in L)
    m=[n for n in arena if arena[n]==c and n not in (5,8)]
    print(f"rec{k:3d} @{a:06X} list {il:06X} n={len(L)} fixed={[hex(x) for x,_ in L if x!=0x44]} match={m}")
