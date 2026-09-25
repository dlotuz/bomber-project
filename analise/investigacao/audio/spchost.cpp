// spchost: prova de conceito — toca música/SFX originais do SB4 SEM emular o 65816.
// Faz o papel da CPU: lê as tabelas da ROM e conversa com o SPC700 emulado (bapu do snes9x:
// SMP de byuu + SPC_DSP de blargg) pelas 4 portas, exatamente como as rotinas $C0:0226-$C0:072F.
//
// uso: spchost <rom.sfc> <saida.wav> <saida.spc|-> "<script>"
//   script: comandos separados por ';'
//     init            = boot do jogo ($C0:0376): blocos $31 (driver), $2E, $2F
//     blk XX          = $C3:4A16: para tudo ($C0:046E) e sobe o bloco XX ($C0:040C) (ex.: 2F sfx de batalha, 30 sfx de menu)
//     mus XX          = $C3:4A44: para tudo ($C0:046E) e toca a música XX ($C0:0394) (bloco + set de samples + comando)
//     sfx XX          = $C3:4A7F: efeito XX (comando $32+XX na porta 0, via tabela $C0:0787)
//     stream XX       = $C3:4AF9: sample "stream" XX (bloco $19+XX por $2141..$2143 e depois comando)
//     stop            = $C3:49F4 / $C0:046E (comando $13 na porta 1)
//     fade            = $C3:49ED / $C0:0445 (comando $18 na porta 1, parâmetro $7F)
//     rec / norec     = liga/desliga a gravação do WAV
//     frames N        = roda N frames de 60 Hz (17067 ciclos SMP cada), com a lógica de NMI ($C0:0573)
//     spc             = grava o .spc agora
//     loadspc arq.spc = carrega um .spc (para validar os arquivos gerados)
//     dsp             = imprime os 128 registradores do DSP
#include "snes9x.h"
#include "apu/bapu/snes/snes.hpp"
#include "apu/resampler.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <sstream>

struct SSettings Settings;
void S9xMSU1Generate(size_t) {}
namespace SNES { CPU cpu; }

static std::vector<uint8_t> R;
static Resampler rs(1 << 16);
static std::vector<int16_t> wavbuf;
static bool rec = false;
static long long smp_total = 0;
static const char *spc_path = nullptr;

static void drain() {
    int n = rs.space_filled();
    if (n <= 0) return;
    std::vector<int16_t> t(n);
    rs.pull(t.data(), n);
    if (rec) wavbuf.insert(wavbuf.end(), t.begin(), t.end());
}
static void run(int cyc) { SNES::smp.clock -= cyc; SNES::smp.enter(); SNES::dsp.synchronize(); smp_total += cyc; drain(); }
static uint8_t rd(int p) { return SNES::smp.port_read(p); }
static void wr(int p, uint8_t v) { SNES::cpu.port_write(p, v); }
static void waitport(int p, uint8_t v) {
    for (long k = 0; rd(p) != v; k++) { run(8); if (k > 4000000) { fprintf(stderr, "timeout port %d=%02X (tem %02X)\n", p, v, rd(p)); exit(2); } }
}

// ---- ROM (HiROM: $C0-$FF -> offset (banco-$C0)<<16) ----
static uint32_t off(uint32_t a) { return ((a >> 16) - 0xC0) << 16 | (a & 0xFFFF); }
static uint16_t w16(uint32_t o) { return R[o] | R[o + 1] << 8; }
static uint32_t l24(uint32_t o) { return R[o] | R[o + 1] << 8 | R[o + 2] << 16; }

// ---- estado do lado CPU (variáveis de página direta do jogo) ----
// O 65816 gasta tempo entre um handshake e a escrita seguinte. Sem essa folga o driver pode ler a porta 1
// antes de a CPU "real" escrevê-la (ver RELATORIO §1.4). 64 ciclos SMP ~ 220 ciclos de CPU a 3,58 MHz.
static const int CPU_SLACK = 64;
static uint8_t D3, E0, E2, E3, E9, EA;   // contador de kick, bit de alternância, SFX/stream pendentes
static uint32_t P;                       // ponteiro de leitura ($D0-$D2), já como offset de arquivo
static uint8_t nb() { return R[P++]; }   // $C0:0369

static void enter_loader() {             // $C0:029B
    for (long k = 0;; k++) {
        wr(1, 0x10); run(8);
        if (getenv("DBG")) { static uint32_t last = 0; uint32_t cur = rd(0) | rd(1) << 8 | SNES::cpu.port_read(0) << 16; if (cur != last) fprintf(stderr, "  loader k=%ld spc:%02X %02X cpu0:%02X pc=%04X\n", k, rd(0), rd(1), SNES::cpu.port_read(0), SNES::smp.regs.pc); last = cur; }
        if (rd(0) == 0xAA && rd(1) == 0xBB) break;
        if (k > 4000000) { fprintf(stderr, "timeout loader (portas %02X %02X %02X %02X, pc %04X)\n", rd(0), rd(1), rd(2), rd(3), SNES::smp.regs.pc); exit(2); }
    }
    D3 = 0xCC;
}
static void xfer(uint16_t dest, uint32_t n) { // corpo de $C0:0310-$C0:0360
    wr(1, 0xFF); wr(2, dest & 0xFF); wr(3, dest >> 8); wr(0, D3); waitport(0, D3);
    D3 = 0;
    for (uint32_t i = 0; i < n; i++) { wr(1, nb()); wr(0, D3); waitport(0, D3); D3++; }
    D3++; if (D3 == 0) D3++;
}
static void upload_stream() {            // $C0:02F0 com $F0=0: [len][dest][dados]... até len=0
    for (;;) { uint16_t n = nb(); n |= nb() << 8; if (!n) return; uint16_t d = nb(); d |= nb() << 8; xfer(d, n); }
}
static void end_upload() {               // $C0:02BD
    wr(1, 0); wr(2, nb()); wr(3, nb());
    if (D3 == 0xAA) D3++;
    wr(0, D3); waitport(0, D3);
    E0 = (D3 & 0x80) ^ 0x80;
    run(CPU_SLACK);                      // tempo do 65816 até a próxima escrita (o driver lê $F5 DEPOIS de ecoar $F4)
}
static void upload_block(int i) {        // $C0:0416
    P = off(l24(0x190 + 3 * i));
    enter_loader(); upload_stream(); end_upload();
}
static void sample_set(int k) {          // $C0:0226
    uint32_t desc = off(0xDA0000 | w16(off(0xDA17D2) + 2 * k));
    P = off(0xDA0000 | w16(desc));
    enter_loader(); upload_stream();
    uint16_t EE = w16(desc + 2);
    for (uint32_t y = desc + 4; R[y] != 0xFF; y++) {
        int s = R[y];
        uint16_t len = w16(off(0xDA2238) + 2 * s);
        P = off(l24(off(0xDA2118) + 3 * s));
        xfer(EE, len); EE += len;
    }
    end_upload();                        // lê 2 bytes após o último sample, como o jogo
}
static void send_cmd(uint8_t c) {        // $C0:071D (e fim de $C0:0394)
    uint8_t a = c | E0;
    for (long k = 0;; k++) { wr(0, a ^ 0x80); run(8); if (rd(0) == a) { run(8); if (rd(0) == a) break; }
        if (k > 4000000) { fprintf(stderr, "timeout cmd %02X (porta0 %02X)\n", c, rd(0)); exit(2); } }
    E0 ^= 0x80;
    run(CPU_SLACK);
}
static void music(int id) {              // $C0:0394
    uint8_t b0 = R[0x739 + 3 * id], b1 = R[0x73A + 3 * id], b2 = R[0x73B + 3 * id];
    upload_block(b0); if (getenv("DBG")) fprintf(stderr, " bloco ok\n");
    sample_set(b1); if (getenv("DBG")) fprintf(stderr, " samples ok\n");
    send_cmd(b2);
}
static void stop_all() {                 // $C0:046E
    waitport(2, 0xAA); wr(1, 0x13); waitport(1, 0x93); waitport(2, 0xAA);
    wr(1, 0x93); waitport(1, 0x13); waitport(2, 0xAA);
    E2 = E3 = E9 = EA = 0;
    run(CPU_SLACK);
}
static void fade() { wr(2, 0x7F); wr(1, 0x18); waitport(1, 0x98); waitport(2, 0xAA); } // $C0:0445

// ---- stream de sample durante o jogo ($C0:0573/$C0:05F3), 1 pedaço de até $40 bytes por frame ----
static uint8_t E1; static uint32_t E5, strm_left; static uint16_t E7; static bool streaming = false;
static void stream_start(int id) {       // $C0:03E1
    if (E9) return;                      // ocupado: o jogo troca o gancho de NMI; aqui só ignora
    EA = R[0x7B9 + 2 * id]; E9 = R[0x7BA + 2 * id];
}
static void nmi() {                      // $C0:0573 + $C0:0704 (1x por frame)
    if (EA && !streaming) {
        send_cmd(0x32);                  // $C0:0588: comando $32 antes de começar
        P = off(l24(0x190 + 3 * EA)); EA = 0;
        streaming = true;
        uint16_t n = nb(); n |= nb() << 8; strm_left = (n + 1) & 0xFFFE; E7 = nb(); E7 |= nb() << 8;
    }
    // $C0:05F3 com orçamento ($ED != 0 durante a partida): medido no jogo = 1 pedaço de 64 bytes por frame
    // e 4 pedaços a cada 4º frame (ver RELATORIO §1.5). Cada pedaço: 2 bytes por handshake em $2142/$2143.
    static unsigned fc = 0; int chunks = (fc++ & 3) == 0 ? 4 : 1;
    while (streaming && chunks-- > 0) {
        uint32_t n = strm_left < 0x40 ? strm_left : 0x40;
        wr(2, E7 & 0xFF); wr(3, E7 >> 8);
        uint8_t a = 0x31 | E1; wr(1, a);
        waitport(1, a ^ 0x80);
        D3 = 0; strm_left -= n; E7 += n;
        for (uint32_t i = 0; i < n; i += 2) { wr(2, nb()); wr(3, nb()); wr(1, D3); uint8_t d = D3; D3 += 2; waitport(1, d); }
        bool done = false;
        if (!strm_left) {
            uint16_t m = nb(); m |= nb() << 8;
            if (!m) done = true; else { strm_left = (m + 1) & 0xFFFE; E7 = nb(); E7 |= nb() << 8; }
        }
        wr(1, D3 + 1); waitport(2, 0xAA); wr(1, 0x7F); E1 ^= 0x80; run(CPU_SLACK);
        if (done) { streaming = false; E3 = E9; E9 = 0; }
    }
    if (E2) send_cmd(E2);
    if (E3) send_cmd(E3);
    E2 = E3 = 0;
}

static void load_spc(const char *path) {   // carregador .spc mínimo (formato v0.30), para validar os .spc gerados
    std::vector<uint8_t> b(66048); FILE *f = fopen(path, "rb"); if (!f || fread(b.data(), 1, b.size(), f) != b.size()) { fprintf(stderr, "spc?\n"); exit(1); } fclose(f);
    uint8_t *ram = b.data() + 0x100, *dsp = b.data() + 0x10100;
    SNES::smp.power(); SNES::dsp.power();
    memcpy(SNES::smp.apuram, ram, 65536);
    SNES::smp.regs.pc = b[0x25] | b[0x26] << 8; SNES::smp.regs.B.a = b[0x27]; SNES::smp.regs.x = b[0x28];
    SNES::smp.regs.B.y = b[0x29]; SNES::smp.regs.p = b[0x2A]; SNES::smp.regs.sp = b[0x2B];
    for (int i = 0; i < 128; i++) if (i != 0x4C && i != 0x5C) SNES::dsp.write(i, dsp[i]);
    SNES::dsp.write(0x5C, 0); SNES::dsp.write(0x4C, dsp[0x4C]);
    SNES::smp.mmio_write(0xF1, ram[0xF1] & 0x87); SNES::smp.status.dsp_addr = ram[0xF2];
    SNES::smp.timer0.target = ram[0xFA]; SNES::smp.timer1.target = ram[0xFB]; SNES::smp.timer2.target = ram[0xFC];
    for (int p = 0; p < 4; p++) SNES::cpu.port_write(p, ram[0xF4 + p]);
}
static void write_spc(const char *path) {
    std::vector<uint8_t> buf(66048);
    SNES::smp.save_spc(buf.data());
    FILE *f = fopen(path, "wb"); fwrite(buf.data(), 1, buf.size(), f); fclose(f);
}
static void write_wav(const char *path) {
    FILE *f = fopen(path, "wb"); uint32_t n = wavbuf.size() * 2, rate = 32000, br = rate * 4;
    fwrite("RIFF", 1, 4, f); uint32_t x = 36 + n; fwrite(&x, 4, 1, f); fwrite("WAVEfmt ", 1, 8, f);
    x = 16; fwrite(&x, 4, 1, f); uint16_t h = 1; fwrite(&h, 2, 1, f); h = 2; fwrite(&h, 2, 1, f);
    fwrite(&rate, 4, 1, f); fwrite(&br, 4, 1, f); h = 4; fwrite(&h, 2, 1, f); h = 16; fwrite(&h, 2, 1, f);
    fwrite("data", 1, 4, f); fwrite(&n, 4, 1, f); fwrite(wavbuf.data(), 2, wavbuf.size(), f); fclose(f);
}

int main(int argc, char **argv) {
    if (argc < 5) { fprintf(stderr, "uso: spchost rom wav spc|- script\n"); return 1; }
    FILE *f = fopen(argv[1], "rb"); fseek(f, 0, SEEK_END); R.resize(ftell(f)); fseek(f, 0, SEEK_SET);
    if (fread(R.data(), 1, R.size(), f) != R.size()) return 1; fclose(f);
    spc_path = strcmp(argv[3], "-") ? argv[3] : nullptr;
    memset(&Settings, 0, sizeof(Settings));
    Settings.InterpolationMethod = 2; // gaussiana (DSP_INTERPOLATION_GAUSSIAN)
    SNES::smp.power(); SNES::dsp.power(); SNES::cpu.reset();
    SNES::dsp.spc_dsp.set_output(&rs);
    std::stringstream ss(argv[4]); std::string cmd;
    while (std::getline(ss, cmd, ';')) {
        std::stringstream c(cmd); std::string op; unsigned v = 0; c >> op >> std::hex >> v;
        long long t0 = smp_total;
        if (op == "init") { E0 = 0; upload_block(0x31); upload_block(0x2E); upload_block(0x2F); }
        else if (op == "blk") { stop_all(); upload_block(v); }          // $C3:4A16 = $C0:046E + $C0:040C
        else if (op == "mus") { stop_all(); music(v & 0x7F); }         // $C3:4A44 = $C0:046E + $C0:0394
        else if (op == "sfx") E2 = R[0x787 + v];
        else if (op == "stream") stream_start(v);
        else if (op == "stop") stop_all();
        else if (op == "fade") fade();
        else if (op == "rec") rec = true;
        else if (op == "norec") rec = false;
        else if (op == "frames") { unsigned n = strtoul(cmd.c_str() + cmd.find("frames") + 6, 0, 10); for (unsigned i = 0; i < n; i++) { run(17067); nmi(); } }
        else if (op == "loadspc") { std::string p; std::stringstream c2(cmd); c2 >> op >> p; load_spc(p.c_str()); }
        else if (op == "dsp") { for (int i = 0; i < 128; i++) fprintf(stderr, "%02X%s", SNES::dsp.read(i), (i & 15) == 15 ? "\n" : " "); }
        else if (op == "spc") { if (spc_path) write_spc(spc_path); }
        else if (!op.empty()) { fprintf(stderr, "comando? %s\n", op.c_str()); return 1; }
        if (!op.empty() && op != "frames") fprintf(stderr, "%-8s %02X  %8lld ciclos SMP (%.1f ms)\n", op.c_str(), v, smp_total - t0, (smp_total - t0) / 1024.0);
    }
    write_wav(argv[2]);
    FILE *m = fopen((std::string(argv[2]) + ".apuram").c_str(), "wb"); fwrite(SNES::smp.apuram, 1, 65536, m); fclose(m);
    fprintf(stderr, "WAV: %zu amostras estéreo (%.1f s)\n", wavbuf.size() / 2, wavbuf.size() / 2 / 32000.0);
    return 0;
}
