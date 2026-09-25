"""Partidas só de CPU: conta ovos revelados, tipos, montarias e o contador $1ED4."""
import mt, sys, collections
st=sys.argv[1]; N=int(sys.argv[2])
e=mt.new(st)
eggs_seen={}; types=collections.Counter(); rides=collections.Counter(); max1ed4=0
prev_r=[0]*5; rounds=0; prev_alive=None; egg_now_max=0
for f in range(N):
    e.run(1)
    if f%2: continue
    w=e.wram()
    g=[w[0x2800+i*2]|w[0x2801+i*2]<<8 for i in range(14*32)]
    cur={i:v for i,v in enumerate(g) if (v&0xFFF0)==0x0970}
    for i,v in cur.items():
        if i not in eggs_seen or eggs_seen[i][1]!=v:
            eggs_seen[i]=(f,v); types[v&0xF]+=1
    for i in list(eggs_seen):
        if i not in cur: del eggs_seen[i]
    riding=0
    for p in range(5):
        r=w[0x35d+p*0x100]
        if r: riding+=1
        if r and not prev_r[p]: rides[w[0x35c+p*0x100]&0xF]+=1
        prev_r[p]=r
    egg_now_max=max(egg_now_max, len(cur)+riding)
    max1ed4=max(max1ed4,w[0x1ed4] if w[0x1ed4]<0x80 else 0)
print(st,'frames',N,'ovos revelados por tipo',dict(types),'montadas por tipo',dict(rides),'max(ovos no chão+montados) simultâneos',egg_now_max,'max $1ED4',max1ed4)
