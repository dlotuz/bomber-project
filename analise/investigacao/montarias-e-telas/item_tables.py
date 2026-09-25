import mt, collections
R=mt.ROM
T=[0xC37C30,0xC37E14,0xC37FF8,0xC38252,0xC383E2,0xC383E4,0xC38640,0xC38814,0xC388A8,0xC38A68]
NAMES={0x01:'bomba',0x03:'fogo',0x05:'patins',0x07:'luva',0x0D:'soco',0x0E:'chute',0x12:'P',0x21:'caveira',0x30:'OVO',0x04:'item04',0x0F:'item0F'}
for i,t in enumerate(T):
    o=t&0x3FFFFF; items=[]; fixed=0
    while True:
        c=R[o]|R[o+1]<<8
        if c==0xFFFF: break
        it=R[o+2]|R[o+3]<<8
        items.append((c,it)); o+=4
    cnt=collections.Counter(NAMES.get(it,hex(it)) for c,it in items)
    rnd=sum(1 for c,it in items if c==0x44)
    print(f'fase {i+1}: {len(items)} itens ({rnd} em casa aleatória) ', dict(cnt), 'fim em', hex(0xC00000+o))
