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
tA=rom24(0xC36233)
names={1:'Bomba+',3:'Fogo+',5:'Patins',0x0E:'Chute',0x12:'P (soco em jogador)',7:'Luva',0x0D:'Soco',0x21:'Caveira',0x30:'Cápsula (montaria)',4:'Fogo total',0x0F:'Montaria aleatória',2:'Bomba tipo 2',0x0A:'Atravessa bloco'}
for st in range(10):
    rec=rd24(tA+3*st); il=rd24(rom24(rec)+24)
    L=itemlist(il) if il else []
    c=collections.Counter(v for _,v in L)
    e=Dbg(f"st_arena{st+1:02d}"); e.run(1); w=e.wram(); i=0x8000; W=[]
    while True:
        cc=w[i]|w[i+1]<<8
        if cc==0xFFFF: break
        W.append((cc,w[i+2]|w[i+3]<<8)); i+=4
    cw=collections.Counter(v for _,v in W)
    fixed=[hex(x) for x,_ in L if x!=0x44]
    print(f"fase {st+1}: rec {rec:06X} lista {il:06X} total {len(L)} fixos {fixed} | {', '.join(f'{names.get(k,hex(k))}={n}' for k,n in sorted(c.items()))} | WRAM igual: {c==cw} ({len(W)})")
