"""Descompressor dos gráficos do Super Bomberman 4 (formato "tiles com elisão de tile vazio", aqui chamado ZTE).

Formato (medido nas rotinas $C4:09A5 e $C1:874D, que são equivalentes):
    byte 0  : Z = marcador de "tile zerado"
    byte 1  : E = marcador de fim
    depois, repetir:
        b = próximo byte (sem consumir)
        se b == Z : emite 32 bytes 0x00 e consome 1 byte
        se b == E : fim (consome 1 byte; o tamanho do bloco comprimido termina aqui)
        senão     : copia 32 bytes literais (o primeiro é o próprio b) e consome 32 bytes
    (Z é testado antes de E; se Z == E o bloco é só zeros até... nunca ocorre na ROM.)
Cada unidade tem 32 bytes = 1 tile 4bpp (ou 2 tiles 2bpp). A saída é o formato planar nativo da VRAM do SNES.
Endereços: a leitura é linear no espaço SNES (a rotina $C4:09A5 usa [ptr],Y com Y 16-bit, então atravessa bancos
HiROM contíguos); uso aqui offset de arquivo HiROM (banco-$C0)*$10000 + endereço.
"""
import sys
from rom import ROM, fo, r24, hx

def decode_zte(addr, rom=ROM, limit=0x10000):
    """addr: endereço SNES do cabeçalho. Retorna (dados, tamanho_comprimido)."""
    p = fo(addr)
    z, e = rom[p], rom[p + 1]
    i = p + 2
    out = bytearray()
    while True:
        b = rom[i]
        if b == z:
            out += bytes(32); i += 1
        elif b == e:
            i += 1; break
        else:
            out += rom[i:i + 32]; i += 32
        if len(out) > limit: raise ValueError('bloco ZTE sem fim em ' + hx(addr))
    return bytes(out), i - p

def encode_zte(data, z=None, e=None):
    """Codificador (para testes): escolhe marcadores que não sejam primeiro byte de nenhum tile literal."""
    assert len(data) % 32 == 0
    tiles = [data[k:k + 32] for k in range(0, len(data), 32)]
    firsts = {t[0] for t in tiles if any(t)}
    free = [v for v in range(256) if v not in firsts]
    z = free[0] if z is None else z; e = free[1] if e is None else e
    out = bytearray([z, e])
    for t in tiles:
        out += bytes([z]) if not any(t) else t
    out.append(e)
    return bytes(out)

if __name__ == '__main__':
    a = int(sys.argv[1].replace('$', '').replace(':', ''), 16)
    d, n = decode_zte(a)
    print(f'{hx(a)}: comprimido {n} bytes -> {len(d)} bytes ({len(d)//32} tiles 4bpp)')
    if len(sys.argv) > 2: open(sys.argv[2], 'wb').write(d)

def composite(buf, src, dst, ntiles):
    """Núcleo genérico de $C4:4C5C (usado por $C4:4BDD e pelas variantes $C3:2056/$C3:20D9).
    buf: buffer de tiles 4bpp (offsets relativos ao início do buffer $7F:8000).
    Para cada tile n de destino (0..ntiles-1, em dst + 32n), cada pixel de cor 0 recebe o pixel do tile de
    origem  src + 32*((n & 1) + 16*((n >> 4) & 1))  (ou seja, um bloco 16x16 no layout de 16 tiles/linha)."""
    buf = bytearray(buf)
    for n in range(ntiles):
        d = dst + 32 * n
        s = src + 32 * ((n & 1) + 16 * ((n >> 4) & 1))
        for r in range(8):
            b0, b1, b2, b3 = buf[d + 2*r], buf[d + 2*r + 1], buf[d + 16 + 2*r], buf[d + 17 + 2*r]
            m = ~(b0 | b1 | b2 | b3) & 0xFF
            buf[d + 2*r]      = (b0 & ~m & 0xFF) | (buf[s + 2*r] & m)
            buf[d + 2*r + 1]  = (b1 & ~m & 0xFF) | (buf[s + 2*r + 1] & m)
            buf[d + 16 + 2*r] = (b2 & ~m & 0xFF) | (buf[s + 16 + 2*r] & m)
            buf[d + 17 + 2*r] = (b3 & ~m & 0xFF) | (buf[s + 17 + 2*r] & m)
    return bytes(buf)

def arena9_post(buf):
    """Pós-processamento da arena 9 ($C3:215C -> $C3:1FC9, $C3:20D9, $C3:2056), feito no início da partida
    antes de reenviar os 32 KB para a VRAM. Offsets relativos a $7F:8000."""
    buf = bytearray(buf)
    buf[0x2C00:0x3000] = buf[0x2000:0x2400]      # $7F:A000 -> $7F:AC00, $400 bytes
    buf[0x2400:0x2C00] = buf[0x3800:0x4000]      # $7F:B800 -> $7F:A400, $800 bytes
    buf[0x3000:0x3800] = buf[0x3800:0x4000]      # $7F:B800 -> $7F:B000, $800 bytes
    buf = composite(buf, 0x1D80, 0x2000, 96)     # $C3:20D9: piso de $7F:9D80 sob $7F:A000..ABFF
    buf = composite(buf, 0x1C80, 0x2C00, 96)     # $C3:2056: piso de $7F:9C80 sob $7F:AC00..B7FF
    return bytes(buf)

def composite_floor(buf):
    """Replica $C4:4BDD (cenário das arenas): nos tiles 768..1023 do buffer de 32 KB (bytes $6000-$7FFF,
    tiles 4bpp), todo pixel de cor 0 recebe o pixel correspondente do tile de piso 8/9/24/25
    (bloco 16x16 no layout de 16 tiles por linha): src = 8 + (n & 1) + 16 * ((n >> 4) & 1), n = tile - 768."""
    return composite(buf, 0x0100, 0x6000, 256)

def arena_bg_palettes(script):
    """8 paletas de BG (CGRAM 0..127) de uma arena: 8 ponteiros em script+24 (rotina $C4:0A05, 32 bytes cada),
    seguido de $C4:4E2F: cores 13..15 da paleta 7 são copiadas para as cores 13..15 das paletas 2 e 3."""
    from rom import rd
    pal = bytearray(b''.join(rd(r24(script + 24 + 3 * i), 32) for i in range(8)))
    pal[2*16*2 + 26:2*16*2 + 32] = pal[7*32 + 26:7*32 + 32]
    pal[3*32 + 26:3*32 + 32] = pal[7*32 + 26:7*32 + 32]
    return bytes(pal)

def decode_m7rle(pix_addr, map_addr, words=0x4000):
    """RLE duplo do Modo 7 ($C4:6201): gera `words` palavras de VRAM (padrão 16384 = 32 KB).
    Byte baixo de cada palavra = mapa do Modo 7, vindo do fluxo em map_addr ($5C);
    byte alto = pixel (CHR 8bpp do Modo 7), vindo do fluxo em pix_addr ($58).
    Fluxo de pixels: b < $80 -> literal (1 byte);  b >= $80 -> valor b&$7F repetido N vezes (N = byte seguinte).
    Fluxo de mapa:   b != $01 -> literal (1 byte);  b == $01 -> N = byte seguinte, valor = byte depois; repete N vezes.
    (N == 0 equivale a 256 repetições pelo DEC de 8 bits; não ocorre nos dados conferidos.)
    Retorna (bytes, consumidos_pix, consumidos_map)."""
    p, m = fo(pix_addr), fo(map_addr)
    p0, m0 = p, m
    out = bytearray()
    cp = cm = 0; vp = vm = 0
    for _ in range(words):
        if cp: cp -= 1
        else:
            b = ROM[p]
            if b & 0x80:
                vp = b & 0x7F; cp = (ROM[p + 1] - 1) & 0xFF; p += 2
            else:
                vp = b; p += 1
        if cm: cm -= 1
        else:
            b = ROM[m]
            if b == 0x01:
                cm = (ROM[m + 1] - 1) & 0xFF; vm = ROM[m + 2]; m += 3
            else:
                vm = b; m += 1
        out += bytes([vm, vp])
    return bytes(out), p - p0, m - m0
