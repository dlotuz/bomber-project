"""Minimal 65816 disassembler for HiROM SNES images (with M/X flag tracking via REP/SEP)."""
import sys

ROM = open("/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc", "rb").read()

# mode: imp, acc, immM, immX, imm8, dp, dpx, dpy, ind, indx, indy, indl, indly, sr, sry,
#       abs, absx, absy, absl, abslx, absind, absindx, absindl, rel, rell, bm, jabs
OPS = {}
def op(code, mn, mode): OPS[code] = (mn, mode)
tbl = """
00 BRK imm8|01 ORA indx|02 COP imm8|03 ORA sr|04 TSB dp|05 ORA dp|06 ASL dp|07 ORA indl|08 PHP imp|09 ORA immM|0A ASL acc|0B PHD imp|0C TSB abs|0D ORA abs|0E ASL abs|0F ORA absl
10 BPL rel|11 ORA indy|12 ORA ind|13 ORA sry|14 TRB dp|15 ORA dpx|16 ASL dpx|17 ORA indly|18 CLC imp|19 ORA absy|1A INC acc|1B TCS imp|1C TRB abs|1D ORA absx|1E ASL absx|1F ORA abslx
20 JSR jabs|21 AND indx|22 JSL absl|23 AND sr|24 BIT dp|25 AND dp|26 ROL dp|27 AND indl|28 PLP imp|29 AND immM|2A ROL acc|2B PLD imp|2C BIT abs|2D AND abs|2E ROL abs|2F AND absl
30 BMI rel|31 AND indy|32 AND ind|33 AND sry|34 BIT dpx|35 AND dpx|36 ROL dpx|37 AND indly|38 SEC imp|39 AND absy|3A DEC acc|3B TSC imp|3C BIT absx|3D AND absx|3E ROL absx|3F AND abslx
40 RTI imp|41 EOR indx|42 WDM imm8|43 EOR sr|44 MVP bm|45 EOR dp|46 LSR dp|47 EOR indl|48 PHA imp|49 EOR immM|4A LSR acc|4B PHK imp|4C JMP jabs|4D EOR abs|4E LSR abs|4F EOR absl
50 BVC rel|51 EOR indy|52 EOR ind|53 EOR sry|54 MVN bm|55 EOR dpx|56 LSR dpx|57 EOR indly|58 CLI imp|59 EOR absy|5A PHY imp|5B TCD imp|5C JML absl|5D EOR absx|5E LSR absx|5F EOR abslx
60 RTS imp|61 ADC indx|62 PER rell|63 ADC sr|64 STZ dp|65 ADC dp|66 ROR dp|67 ADC indl|68 PLA imp|69 ADC immM|6A ROR acc|6B RTL imp|6C JMP absind|6D ADC abs|6E ROR abs|6F ADC absl
70 BVS rel|71 ADC indy|72 ADC ind|73 ADC sry|74 STZ dpx|75 ADC dpx|76 ROR dpx|77 ADC indly|78 SEI imp|79 ADC absy|7A PLY imp|7B TDC imp|7C JMP absindx|7D ADC absx|7E ROR absx|7F ADC abslx
80 BRA rel|81 STA indx|82 BRL rell|83 STA sr|84 STY dp|85 STA dp|86 STX dp|87 STA indl|88 DEY imp|89 BIT immM|8A TXA imp|8B PHB imp|8C STY abs|8D STA abs|8E STX abs|8F STA absl
90 BCC rel|91 STA indy|92 STA ind|93 STA sry|94 STY dpx|95 STA dpx|96 STX dpy|97 STA indly|98 TYA imp|99 STA absy|9A TXS imp|9B TXY imp|9C STZ abs|9D STA absx|9E STZ absx|9F STA abslx
A0 LDY immX|A1 LDA indx|A2 LDX immX|A3 LDA sr|A4 LDY dp|A5 LDA dp|A6 LDX dp|A7 LDA indl|A8 TAY imp|A9 LDA immM|AA TAX imp|AB PLB imp|AC LDY abs|AD LDA abs|AE LDX abs|AF LDA absl
B0 BCS rel|B1 LDA indy|B2 LDA ind|B3 LDA sry|B4 LDY dpx|B5 LDA dpx|B6 LDX dpy|B7 LDA indly|B8 CLV imp|B9 LDA absy|BA TSX imp|BB TYX imp|BC LDY absx|BD LDA absx|BE LDX absy|BF LDA abslx
C0 CPY immX|C1 CMP indx|C2 REP imm8|C3 CMP sr|C4 CPY dp|C5 CMP dp|C6 DEC dp|C7 CMP indl|C8 INY imp|C9 CMP immM|CA DEX imp|CB WAI imp|CC CPY abs|CD CMP abs|CE DEC abs|CF CMP absl
D0 BNE rel|D1 CMP indy|D2 CMP ind|D3 CMP sry|D4 PEI dp|D5 CMP dpx|D6 DEC dpx|D7 CMP indly|D8 CLD imp|D9 CMP absy|DA PHX imp|DB STP imp|DC JML absindl|DD CMP absx|DE DEC absx|DF CMP abslx
E0 CPX immX|E1 SBC indx|E2 SEP imm8|E3 SBC sr|E4 CPX dp|E5 SBC dp|E6 INC dp|E7 SBC indl|E8 INX imp|E9 SBC immM|EA NOP imp|EB XBA imp|EC CPX abs|ED SBC abs|EE INC abs|EF SBC absl
F0 BEQ rel|F1 SBC indy|F2 SBC ind|F3 SBC sry|F4 PEA abs|F5 SBC dpx|F6 INC dpx|F7 SBC indly|F8 SED imp|F9 SBC absy|FA PLX imp|FB XCE imp|FC JSR absindx|FD SBC absx|FE INC absx|FF SBC abslx
"""
for line in tbl.strip().splitlines():
    for ent in line.split("|"):
        c, mn, mode = ent.split()
        op(int(c, 16), mn, mode)

SIZE = {"imp": 0, "acc": 0, "imm8": 1, "immM": 1, "immX": 1, "dp": 1, "dpx": 1, "dpy": 1, "ind": 1, "indx": 1, "indy": 1,
        "indl": 1, "indly": 1, "sr": 1, "sry": 1, "abs": 2, "absx": 2, "absy": 2, "absl": 3, "abslx": 3,
        "absind": 2, "absindx": 2, "absindl": 2, "rel": 1, "rell": 2, "bm": 2, "jabs": 2}

def snes2file(addr):
    """HiROM mapping ($C0-$FF full banks, $00-$3F/$80-$BF upper halves)."""
    bank, off = addr >> 16, addr & 0xFFFF
    if bank >= 0xC0: return ((bank - 0xC0) << 16) | off
    if 0x40 <= bank < 0x7E: return ((bank - 0x40) << 16) | off
    if (bank < 0x40 or 0x80 <= bank < 0xC0) and off >= 0x8000: return ((bank & 0x3F) << 16) | off
    return None

def disasm(addr, count=60, m=1, x=1, stop_on_ret=True, out=None):
    lines = []
    pc = addr
    for _ in range(count):
        fo = snes2file(pc)
        if fo is None: break
        b = ROM[fo]
        mn, mode = OPS[b]
        n = SIZE[mode]
        if mode == "immM": n = 1 if m else 2
        if mode == "immX": n = 1 if x else 2
        arg = int.from_bytes(ROM[fo + 1:fo + 1 + n], "little") if n else 0
        raw = ROM[fo:fo + 1 + n].hex().upper()
        bank = pc & 0xFF0000
        if mode in ("imp",): s = ""
        elif mode == "acc": s = "A"
        elif mode in ("immM", "immX", "imm8"): s = f"#${arg:0{2*n}X}"
        elif mode == "dp": s = f"${arg:02X}"
        elif mode == "dpx": s = f"${arg:02X},X"
        elif mode == "dpy": s = f"${arg:02X},Y"
        elif mode == "ind": s = f"(${arg:02X})"
        elif mode == "indx": s = f"(${arg:02X},X)"
        elif mode == "indy": s = f"(${arg:02X}),Y"
        elif mode == "indl": s = f"[${arg:02X}]"
        elif mode == "indly": s = f"[${arg:02X}],Y"
        elif mode == "sr": s = f"${arg:02X},S"
        elif mode == "sry": s = f"(${arg:02X},S),Y"
        elif mode in ("abs", "jabs"): s = f"${arg:04X}"
        elif mode == "absx": s = f"${arg:04X},X"
        elif mode == "absy": s = f"${arg:04X},Y"
        elif mode == "absl": s = f"${arg:06X}"
        elif mode == "abslx": s = f"${arg:06X},X"
        elif mode == "absind": s = f"(${arg:04X})"
        elif mode == "absindx": s = f"(${arg:04X},X)"
        elif mode == "absindl": s = f"[${arg:04X}]"
        elif mode == "rel":
            t = (pc + 2 + (arg - 256 if arg > 127 else arg)) & 0xFFFF | bank; s = f"${t:06X}"
        elif mode == "rell":
            t = (pc + 3 + (arg - 65536 if arg > 32767 else arg)) & 0xFFFF | bank; s = f"${t:06X}"
        elif mode == "bm": s = f"${arg & 0xFF:02X},${arg >> 8:02X}"
        flags = f"{'m' if m else 'M'}{'x' if x else 'X'}"
        lines.append(f"{pc:06X} {flags} {raw:<10} {mn} {s}")
        if mn == "REP":
            if arg & 0x20: m = 0
            if arg & 0x10: x = 0
        if mn == "SEP":
            if arg & 0x20: m = 1
            if arg & 0x10: x = 1
        pc = bank | ((pc + 1 + n) & 0xFFFF)
        if stop_on_ret and mn in ("RTS", "RTL", "RTI", "JMP", "JML", "BRA", "BRL", "STP"):
            lines.append("-" * 30)
            if mn in ("RTS", "RTL", "RTI", "STP"): break
    text = "\n".join(lines)
    if out is None: print(text)
    return text

if __name__ == "__main__":
    a = int(sys.argv[1], 16)
    cnt = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    m = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    x = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    disasm(a, cnt, m, x, stop_on_ret=False)
