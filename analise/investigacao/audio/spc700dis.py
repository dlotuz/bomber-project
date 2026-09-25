"""Disassembler SPC700 mínimo (para ler o driver Hudson carregado do bloco $31)."""
T = {}
def d(op, mn, fmt): T[op] = (mn, fmt)
# fmt: tokens: d=dp, a=abs, i=imm, r=rel, b=bit-abs (13-bit+3), u=upage(0xFFxx)
rows = """
00 NOP|01 TCALL 0|02 SET1 d.0|03 BBS d.0,r|04 OR A,d|05 OR A,a|06 OR A,(X)|07 OR A,[d+X]|08 OR A,#i|09 OR d,d|0A OR1 C,b|0B ASL d|0C ASL a|0D PUSH PSW|0E TSET1 a|0F BRK
10 BPL r|11 TCALL 1|12 CLR1 d.0|13 BBC d.0,r|14 OR A,d+X|15 OR A,a+X|16 OR A,a+Y|17 OR A,[d]+Y|18 OR d,#i|19 OR (X),(Y)|1A DECW d|1B ASL d+X|1C ASL A|1D DEC X|1E CMP X,a|1F JMP [a+X]
20 CLRP|21 TCALL 2|22 SET1 d.1|23 BBS d.1,r|24 AND A,d|25 AND A,a|26 AND A,(X)|27 AND A,[d+X]|28 AND A,#i|29 AND d,d|2A OR1 C,/b|2B ROL d|2C ROL a|2D PUSH A|2E CBNE d,r|2F BRA r
30 BMI r|31 TCALL 3|32 CLR1 d.1|33 BBC d.1,r|34 AND A,d+X|35 AND A,a+X|36 AND A,a+Y|37 AND A,[d]+Y|38 AND d,#i|39 AND (X),(Y)|3A INCW d|3B ROL d+X|3C ROL A|3D INC X|3E CMP X,d|3F CALL a
40 SETP|41 TCALL 4|42 SET1 d.2|43 BBS d.2,r|44 EOR A,d|45 EOR A,a|46 EOR A,(X)|47 EOR A,[d+X]|48 EOR A,#i|49 EOR d,d|4A AND1 C,b|4B LSR d|4C LSR a|4D PUSH X|4E TCLR1 a|4F PCALL u
50 BVC r|51 TCALL 5|52 CLR1 d.2|53 BBC d.2,r|54 EOR A,d+X|55 EOR A,a+X|56 EOR A,a+Y|57 EOR A,[d]+Y|58 EOR d,#i|59 EOR (X),(Y)|5A CMPW YA,d|5B LSR d+X|5C LSR A|5D MOV X,A|5E CMP Y,a|5F JMP a
60 CLRC|61 TCALL 6|62 SET1 d.3|63 BBS d.3,r|64 CMP A,d|65 CMP A,a|66 CMP A,(X)|67 CMP A,[d+X]|68 CMP A,#i|69 CMP d,d|6A AND1 C,/b|6B ROR d|6C ROR a|6D PUSH Y|6E DBNZ d,r|6F RET
70 BVS r|71 TCALL 7|72 CLR1 d.3|73 BBC d.3,r|74 CMP A,d+X|75 CMP A,a+X|76 CMP A,a+Y|77 CMP A,[d]+Y|78 CMP d,#i|79 CMP (X),(Y)|7A ADDW YA,d|7B ROR d+X|7C ROR A|7D MOV A,X|7E CMP Y,d|7F RETI
80 SETC|81 TCALL 8|82 SET1 d.4|83 BBS d.4,r|84 ADC A,d|85 ADC A,a|86 ADC A,(X)|87 ADC A,[d+X]|88 ADC A,#i|89 ADC d,d|8A EOR1 C,b|8B DEC d|8C DEC a|8D MOV Y,#i|8E POP PSW|8F MOV d,#i
90 BCC r|91 TCALL 9|92 CLR1 d.4|93 BBC d.4,r|94 ADC A,d+X|95 ADC A,a+X|96 ADC A,a+Y|97 ADC A,[d]+Y|98 ADC d,#i|99 ADC (X),(Y)|9A SUBW YA,d|9B DEC d+X|9C DEC A|9D MOV X,SP|9E DIV YA,X|9F XCN A
A0 EI|A1 TCALL 10|A2 SET1 d.5|A3 BBS d.5,r|A4 SBC A,d|A5 SBC A,a|A6 SBC A,(X)|A7 SBC A,[d+X]|A8 SBC A,#i|A9 SBC d,d|AA MOV1 C,b|AB INC d|AC INC a|AD CMP Y,#i|AE POP A|AF MOV (X)+,A
B0 BCS r|B1 TCALL 11|B2 CLR1 d.5|B3 BBC d.5,r|B4 SBC A,d+X|B5 SBC A,a+X|B6 SBC A,a+Y|B7 SBC A,[d]+Y|B8 SBC d,#i|B9 SBC (X),(Y)|BA MOVW YA,d|BB INC d+X|BC INC A|BD MOV SP,X|BE DAS A|BF MOV A,(X)+
C0 DI|C1 TCALL 12|C2 SET1 d.6|C3 BBS d.6,r|C4 MOV d,A|C5 MOV a,A|C6 MOV (X),A|C7 MOV [d+X],A|C8 CMP X,#i|C9 MOV a,X|CA MOV1 b,C|CB MOV d,Y|CC MOV a,Y|CD MOV X,#i|CE POP X|CF MUL YA
D0 BNE r|D1 TCALL 13|D2 CLR1 d.6|D3 BBC d.6,r|D4 MOV d+X,A|D5 MOV a+X,A|D6 MOV a+Y,A|D7 MOV [d]+Y,A|D8 MOV d,X|D9 MOV d+Y,X|DA MOVW d,YA|DB MOV d+X,Y|DC DEC Y|DD MOV A,Y|DE CBNE d+X,r|DF DAA A
E0 CLRV|E1 TCALL 14|E2 SET1 d.7|E3 BBS d.7,r|E4 MOV A,d|E5 MOV A,a|E6 MOV A,(X)|E7 MOV A,[d+X]|E8 MOV A,#i|E9 MOV X,a|EA NOT1 b|EB MOV Y,d|EC MOV Y,a|ED NOTC|EE POP Y|EF SLEEP
F0 BEQ r|F1 TCALL 15|F2 CLR1 d.7|F3 BBC d.7,r|F4 MOV A,d+X|F5 MOV A,a+X|F6 MOV A,a+Y|F7 MOV A,[d]+Y|F8 MOV X,d|F9 MOV X,d+Y|FA MOV d,d|FB MOV Y,d+X|FC INC Y|FD MOV Y,A|FE DBNZ Y,r|FF STOP
"""
for line in rows.strip().splitlines():
    for ent in line.split('|'):
        op, rest = ent.split(' ', 1); parts = rest.split(' ', 1)
        d(int(op, 16), parts[0], parts[1] if len(parts) > 1 else '')
NAMES = {0xF0: 'TEST', 0xF1: 'CONTROL', 0xF2: 'DSPADDR', 0xF3: 'DSPDATA', 0xF4: 'CPUIO0', 0xF5: 'CPUIO1', 0xF6: 'CPUIO2', 0xF7: 'CPUIO3', 0xFA: 'T0', 0xFB: 'T1', 0xFC: 'T2', 0xFD: 'T0OUT', 0xFE: 'T1OUT', 0xFF: 'T2OUT'}
def dis(ram, pc, n=40):
    out = []
    for _ in range(n):
        op = ram[pc]; mn, fmt = T[op]; p = pc + 1; args = []
        toks = fmt.replace(',', ' , ').replace('#i', '#i').split(' ')
        s = ''
        # operandos na ordem da codificação: para 'd,d' (dest,src) os bytes vêm src,dest; para 'd,#i' vêm imm,dest
        f = fmt
        if f in ('d,d',):
            src, dst = ram[p], ram[p + 1]; p += 2; s = '$%02X,$%02X' % (dst, src)
        elif f == 'd,#i':
            im, dst = ram[p], ram[p + 1]; p += 2; s = '$%02X,#$%02X' % (dst, im)
        elif 'd.' in f and ',r' in f:
            dp, rel = ram[p], ram[p + 1]; p += 2; t = (p + (rel - 256 if rel > 127 else rel)) & 0xFFFF
            s = f.replace('d', '$%02X' % dp, 1).replace('r', '$%04X' % t)
        elif f in ('d,r', 'd+X,r'):
            dp, rel = ram[p], ram[p + 1]; p += 2; t = (p + (rel - 256 if rel > 127 else rel)) & 0xFFFF
            s = f.replace('d', '$%02X' % dp, 1).replace(',r', ',$%04X' % t)
        else:
            for tok in ('a', 'b', 'd', 'i', 'r', 'u'):
                pass
            s = f
            if 'a' in f.replace('A', '').replace('YA', ''):
                v = ram[p] | ram[p + 1] << 8; p += 2; s = s.replace('a', '$%04X' % v, 1) if 'a' in s else s
            if 'b' in s:
                v = ram[p] | ram[p + 1] << 8; p += 2; s = s.replace('b', '$%04X.%d' % (v & 0x1FFF, v >> 13))
            if 'd' in s:
                v = ram[p]; p += 1; s = s.replace('d', '$%02X' % v + ('<%s>' % NAMES[v] if v in NAMES else ''), 1)
            if '#i' in s:
                v = ram[p]; p += 1; s = s.replace('#i', '#$%02X' % v)
            if 'u' in s:
                v = ram[p]; p += 1; s = s.replace('u', '$FF%02X' % v)
            if s.endswith('r') or s == 'r':
                rel = ram[p]; p += 1; t = (p + (rel - 256 if rel > 127 else rel)) & 0xFFFF; s = s[:-1] + '$%04X' % t
        out.append('%04X  %-9s %-6s %s' % (pc, ' '.join('%02X' % ram[x] for x in range(pc, p)), mn, s))
        pc = p
    return '\n'.join(out)
