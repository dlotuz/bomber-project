# disassemble entire code banks linearly into files (heuristic; M/X flags tracked via REP/SEP only)
from mec import *
import sys
for bank in sys.argv[1:]:
    b=int(bank,16)
    txt=dis65816.disasm((b<<16)|0x0000, 40000, 0, 0, stop_on_ret=False, out=True)
    open(f"dis_bank{bank}.txt","w").write(txt)
