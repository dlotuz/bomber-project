from mec import *
for s in ["st_title","st_rules","st_stage00","st_arena01","st_arena02","st_arena05","st_game","st_matchend","st_cpu5"]:
    e=Dbg(s); print(s, hex(e.r16(0x24A)), hex(e.r16(0x24C)), hex(e.r16(0x9A)), 'seed',hex(e.r16(0xAE)))
e=Dbg("st_title"); e.ww(0x24A,0x24B)
for i in range(600):
    e.run(1, p0=['START'] if i%40<3 else [])
L=e.log(); print(len(L)); 
for r in L[:10]: print(fmt(r))
