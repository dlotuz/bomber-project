from mec import *
e=Dbg("st_rules"); e.run(5)
e.shot(OUT+'rules_before.png')
def diff(a,b):
    return [(hex(i),a[i],b[i]) for i in range(0x20000) if a[i]!=b[i] and not (0x100<=i<0x200) and i not in (0x68,0x69,0x6a,0xc2,0xc4,0xe0,0x2f6,0x2f9,0x6c) and not (0x2000<=i<0x2c00) and not (0x10000<=i<0x20000 and False)]
for item in range(6):
    s0=e.wram()
    e.tap('RIGHT',hold=2,after=10)
    s1=e.wram()
    d=diff(s0,s1)
    print('item',item, [x for x in d if int(x[0],16)>=0x12000 or 0x1e00<=int(x[0],16)<0x2000])
    e.shot(OUT+f'rules_{item}.png')
    e.tap('DOWN',hold=2,after=10)
