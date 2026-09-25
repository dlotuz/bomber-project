import mt, collections
for n in ['st_cpu5b','st_arena01','st_arena02','st_arena03','st_arena04','st_arena05','st_arena06','st_arena07','st_arena08','st_arena09','st_arena10','st_cp00']:
    w=mt.blocks(open(mt.EST+n+'.bin','rb').read())['RAM']
    items=[]
    a=0x8000
    while True:
        c=w[a]|w[a+1]<<8
        if c==0xFFFF: break
        it=w[a+2]|w[a+3]<<8; items.append(it); a+=4
        if a>0x8400: break
    print(n, len(items), sorted(collections.Counter(hex(i) for i in items).items()))
