import mt, collections
e = mt.new('st_cpu5b')
states=[]
mt.watch(e, wlo=0x2800, whi=0x2bff)
t=0; found=None
while t<6000 and not found:
    states.append(e.save()); 
    if len(states)>200: states.pop(0)
    e.run(1); t+=1
    lg=mt.log(e); e.lib.mt_reset_log()
    for i,(pc,kd,a,v) in enumerate(lg):
        if pc==0xC15D0A and a&1 and v==9: found=(t,a-1,lg[i-1][3]); break
print('reveal', found)
# volta 200 frames e observa escritas em +$20 de todos os objetos $0800-$1fff com valor = item
t0=t-len(states)
e.load(states[0])
mt.watch(e, wlo=0x800, whi=0x1fff)
item=found[2]&0x3f
res=[]
for k in range(len(states)):
    e.run(1)
    for pc,kd,a,v in mt.log(e):
        if v==item or v==(found[2]): res.append((t0+k+1,hex(pc),hex(a),hex(v)))
    e.lib.mt_reset_log()
for r in res[-30:]: print(r)
