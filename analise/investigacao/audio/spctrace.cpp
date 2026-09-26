// spctrace: gerador dos goldens de áudio do plano 11 (Crown Blast).
// Referência = SMP + DSP do snes9x (apu/bapu: SMP do byuu + SPC_DSP do blargg), com DUAS diferenças
// em relação ao spchost.cpp da investigação:
//   1. instruções atômicas: o host só escreve nas portas entre instruções (run() executa instruções
//      inteiras enquanto o saldo de ciclos for negativo) — é o modelo do SMP em TypeScript;
//   2. host robusto: (a) antes de entrar no loader, com o driver já no ar, espera as portas 2 e 3 = $AA
//      (o driver, ao reiniciar depois de cada upload, espera as 4 portas de entrada zeradas em $0965);
//      (b) 64 ciclos de folga depois do eco do "kick" de cada bloco (o loader lê a porta 1 logo depois
//      do eco, em $1037–$103A). Sem essas regras o modelo atômico trava (medido no plano 11).
// Uso:
//   spctrace bus <psw>                        stdout: "OP ciclos padrão" (1 instrução por opcode)
//   spctrace cases <casos.bin> <saida.bin>    1 instrução por caso (formato em tests/audio/gen/inputs.ts)
//   spctrace dsp <cena.bin> <saida.pcm>       DSP sozinho com escritas carimbadas por ciclo
//   spctrace prog <imagem.bin> <passos> <dir> programa SPC sintético; a cada passo: portas CPU, run(1000)
//   spctrace host <rom> "<script>" <dir>      host completo (init/blk/mus/sfx/stream/stop/fade/frames/rec)
// Saídas em <dir>: pcm.raw (int16 LE estéreo), apuram.bin, mmio.bin (registros de 8 bytes:
// u32 ciclo, u8 tipo 'r'/'w', u8 endereço & $FF, u8 valor, u8 0), ops.txt ("op arg ciclos").
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
namespace SNES { CPU cpu; extern void (*bus_hook)(char, unsigned, unsigned); }

// ---------------- ganchos ----------------
static uint32_t g_cyc = 0;                          // ciclos do SMP desde o power-on (1 por evento de barramento)
static std::vector<uint8_t> g_mmio;                 // registros de 8 bytes
static bool g_log_mmio = false;
static uint32_t g_fnv = 2166136261u;                // hash do barramento (modo cases)
static bool g_fnv_on = false;
static std::string g_pat; static bool g_pat_on = false;
static void fnv(uint8_t b) { g_fnv ^= b; g_fnv *= 16777619u; }
static void hook(char k, unsigned addr, unsigned data) {
    g_cyc++;
    if (g_fnv_on) { fnv(k == 'r' ? 1 : k == 'w' ? 2 : 3); fnv(addr & 0xFF); fnv(addr >> 8); fnv(data & 0xFF); }
    if (g_pat_on) { char t[16]; if (k == 'i') snprintf(t, 16, " i"); else snprintf(t, 16, " %c%04X", k, addr); g_pat += t; }
    if (g_log_mmio && k != 'i' && (addr & 0xFFF0) == 0x00F0) {
        uint8_t r[8] = { uint8_t(g_cyc), uint8_t(g_cyc >> 8), uint8_t(g_cyc >> 16), uint8_t(g_cyc >> 24), uint8_t(k), uint8_t(addr), uint8_t(data), 0 };
        g_mmio.insert(g_mmio.end(), r, r + 8);
    }
}

// ---------------- núcleo: instrução atômica ----------------
static void step_instr() {                          // executa exatamente uma instrução
    int32 save = SNES::smp.clock; uint32_t c0 = g_cyc;
    SNES::smp.clock = -1; SNES::smp.enter();        // cada enter() com clock = -1 roda uma etapa
    while (SNES::smp.opcode_cycle != 0) { SNES::smp.clock = -1; SNES::smp.enter(); }
    SNES::smp.clock = save + int32(g_cyc - c0);
}

static Resampler rs(1 << 16);
static std::vector<int16_t> pcm; static bool rec = false;
static void drain() {
    int n = rs.space_filled(); if (n <= 0) return;
    std::vector<int16_t> t(n); rs.pull(t.data(), n);
    if (rec) pcm.insert(pcm.end(), t.begin(), t.end());
}
static void run(int cyc) {                          // igual ao Smp.run() do TS
    SNES::smp.clock -= cyc;
    while (SNES::smp.clock < 0) step_instr();
    SNES::dsp.synchronize(); drain();
}
static void power_all() {
    SNES::smp.power(); SNES::dsp.power(); SNES::cpu.reset();
    SNES::dsp.spc_dsp.set_output(&rs); rs.clear();
    g_cyc = 0; SNES::bus_hook = hook;
}
static std::vector<uint8_t> load(const char *p) {
    FILE *f = fopen(p, "rb"); if (!f) { fprintf(stderr, "não abre %s\n", p); exit(1); }
    fseek(f, 0, SEEK_END); std::vector<uint8_t> b(ftell(f)); fseek(f, 0, SEEK_SET);
    if (fread(b.data(), 1, b.size(), f) != b.size()) exit(1); fclose(f); return b;
}
static void save(const std::string &p, const void *d, size_t n) { FILE *f = fopen(p.c_str(), "wb"); fwrite(d, 1, n, f); fclose(f); }
static uint32_t rd32(const uint8_t *p) { return p[0] | p[1] << 8 | p[2] << 16 | uint32_t(p[3]) << 24; }

// ---------------- modo bus ----------------
static int mode_bus(int psw) {
    for (int op = 0; op < 256; op++) {
        if (op == 0xEF || op == 0xFF) continue;
        power_all(); SNES::smp.status.iplrom_enable = false;
        uint8_t *R = SNES::smp.apuram;
        for (int i = 0x200; i < 0x10000; i++) R[i] = 0x55;
        for (int i = 0; i < 0xF0; i++) R[i] = 0x30 + (i & 0x0F);
        R[0x40] = 0x34; R[0x41] = 0x12; R[0x50] = 0x78; R[0x51] = 0x56;
        R[0x0400] = op; R[0x0401] = 0x40; R[0x0402] = 0x12;
        SNES::smp.regs.pc = 0x0400; SNES::smp.regs.x = 0x10; SNES::smp.regs.B.y = 0x20; SNES::smp.regs.B.a = 0x05;
        SNES::smp.regs.sp = 0xEF; SNES::smp.regs.p = psw;
        g_pat.clear(); g_pat_on = true; uint32_t c0 = g_cyc; step_instr(); g_pat_on = false;
        printf("%02X %2u%s\n", op, g_cyc - c0, g_pat.c_str());
    }
    return 0;
}

// ---------------- modo cases ----------------
// casos.bin: "SPCC" u32 n, imagem[65536], n × {u16 pc, a, x, y, sp, psw, op, b1, b2, 0, 0} (12 bytes)
// saida.bin: n × {u16 pc, a, x, y, sp, psw, ciclos, u32 fnv} (12 bytes)
static int mode_cases(const char *in, const char *out) {
    std::vector<uint8_t> b = load(in);
    if (memcmp(b.data(), "SPCC", 4)) { fprintf(stderr, "casos.bin?\n"); return 1; }
    uint32_t n = rd32(&b[4]); const uint8_t *img = &b[8]; const uint8_t *c = img + 65536;
    std::vector<uint8_t> o;
    for (uint32_t i = 0; i < n; i++, c += 12) {
        power_all(); SNES::smp.status.iplrom_enable = false;
        memcpy(SNES::smp.apuram, img, 65536);
        uint16_t pc = c[0] | c[1] << 8;
        SNES::smp.apuram[pc] = c[7]; SNES::smp.apuram[uint16_t(pc + 1)] = c[8]; SNES::smp.apuram[uint16_t(pc + 2)] = c[9];
        SNES::smp.regs.pc = pc; SNES::smp.regs.B.a = c[2]; SNES::smp.regs.x = c[3]; SNES::smp.regs.B.y = c[4];
        SNES::smp.regs.sp = c[5]; SNES::smp.regs.p = c[6];
        g_fnv = 2166136261u; g_fnv_on = true; uint32_t c0 = g_cyc; step_instr(); g_fnv_on = false;
        uint16_t npc = SNES::smp.regs.pc;
        uint8_t r[12] = { uint8_t(npc), uint8_t(npc >> 8), SNES::smp.regs.B.a, SNES::smp.regs.x, SNES::smp.regs.B.y,
                          SNES::smp.regs.sp, uint8_t((unsigned) SNES::smp.regs.p), uint8_t(g_cyc - c0),
                          uint8_t(g_fnv), uint8_t(g_fnv >> 8), uint8_t(g_fnv >> 16), uint8_t(g_fnv >> 24) };
        o.insert(o.end(), r, r + 12);
    }
    save(out, o.data(), o.size());
    return 0;
}

// ---------------- modo dsp ----------------
// cena.bin: "SPCD" u32 nEscritas, u32 ciclosTotais, ram[65536], n × {u32 ciclo, u8 reg, u8 valor, u16 0}
static int mode_dsp(const char *in, const char *out) {
    std::vector<uint8_t> b = load(in);
    if (memcmp(b.data(), "SPCD", 4)) { fprintf(stderr, "cena.bin?\n"); return 1; }
    uint32_t n = rd32(&b[4]), total = rd32(&b[8]);
    power_all(); SNES::bus_hook = 0;
    memcpy(SNES::smp.apuram, &b[12], 65536);
    SNES::dsp.power(); SNES::dsp.spc_dsp.set_output(&rs); rs.clear();
    rec = true; uint32_t now = 0; const uint8_t *w = &b[12 + 65536];
    for (uint32_t i = 0; i < n; i++, w += 8) {
        uint32_t t = rd32(w);
        SNES::dsp.clock += int32(t - now); now = t;
        SNES::dsp.write(w[4], w[5]); drain();
    }
    SNES::dsp.clock += int32(total - now); SNES::dsp.synchronize(); drain();
    save(out, pcm.data(), pcm.size() * 2);
    return 0;
}

// ---------------- modo prog ----------------
// imagem.bin: 65536 bytes; PC inicial = $0200. A cada passo k: portas CPU 0/1/2 = k, k·7, k>>1; run(1000).
static int mode_prog(const char *img, int steps, const std::string &dir) {
    std::vector<uint8_t> b = load(img);
    power_all(); memcpy(SNES::smp.apuram, b.data(), 65536); SNES::smp.regs.pc = 0x0200;
    g_log_mmio = true; rec = true;
    for (int k = 0; k < steps; k++) {
        SNES::cpu.port_write(0, k & 0xFF); SNES::cpu.port_write(1, (k * 7) & 0xFF); SNES::cpu.port_write(2, (k >> 1) & 0xFF);
        run(1000);
    }
    save(dir + "/mmio.bin", g_mmio.data(), g_mmio.size());
    save(dir + "/apuram.bin", SNES::smp.apuram, 65536);
    save(dir + "/pcm.raw", pcm.data(), pcm.size() * 2);
    FILE *f = fopen((dir + "/regs.txt").c_str(), "w");
    fprintf(f, "%u %u %u %u %u %u %u\n", SNES::smp.regs.pc, SNES::smp.regs.B.a, SNES::smp.regs.x, SNES::smp.regs.B.y,
            SNES::smp.regs.sp, (unsigned) SNES::smp.regs.p, g_cyc);
    fclose(f);
    return 0;
}

// ---------------- modo host (spchost.cpp + regras do plano 11) ----------------
static std::vector<uint8_t> R;
static uint32_t off(uint32_t a) { return ((a >> 16) - 0xC0) << 16 | (a & 0xFFFF); }
static uint16_t w16(uint32_t o) { return R[o] | R[o + 1] << 8; }
static uint32_t l24(uint32_t o) { return R[o] | R[o + 1] << 8 | R[o + 2] << 16; }
static uint8_t rdp(int p) { return SNES::smp.port_read(p); }
static void wrp(int p, uint8_t v) { SNES::cpu.port_write(p, v); }
static void waitport(int p, uint8_t v) {
    for (long k = 0; rdp(p) != v; k++) { run(8); if (k > 4000000) { fprintf(stderr, "timeout porta %d=%02X (tem %02X)\n", p, v, rdp(p)); exit(2); } }
}
static const int CPU_SLACK = 64;
static uint8_t D3, E0, E1, E2, E3, E9, EA; static uint32_t P; static bool driver_up = false;
static uint8_t nb() { return R[P++]; }
static void enter_loader() {
    if (driver_up) { waitport(2, 0xAA); waitport(3, 0xAA); }          // regra (a)
    for (long k = 0;; k++) {
        wrp(1, 0x10); run(8);
        if (rdp(0) == 0xAA && rdp(1) == 0xBB) break;
        if (k > 4000000) { fprintf(stderr, "timeout loader\n"); exit(2); }
    }
    D3 = 0xCC;
}
static void xfer(uint16_t dest, uint32_t n) {
    wrp(1, 0xFF); wrp(2, dest & 0xFF); wrp(3, dest >> 8); wrp(0, D3); waitport(0, D3);
    run(CPU_SLACK);                                                    // regra (b)
    D3 = 0;
    for (uint32_t i = 0; i < n; i++) { wrp(1, nb()); wrp(0, D3); waitport(0, D3); D3++; }
    D3++; if (D3 == 0) D3++;
}
static void upload_stream() { for (;;) { uint16_t n = nb(); n |= nb() << 8; if (!n) return; uint16_t d = nb(); d |= nb() << 8; xfer(d, n); } }
static void end_upload() {
    wrp(1, 0); wrp(2, nb()); wrp(3, nb());
    if (D3 == 0xAA) D3++;
    wrp(0, D3); waitport(0, D3);
    E0 = (D3 & 0x80) ^ 0x80;
    run(CPU_SLACK);
}
static void upload_block(int i) { P = off(l24(0x190 + 3 * i)); enter_loader(); upload_stream(); end_upload(); driver_up = true; }
static void sample_set(int k) {
    uint32_t desc = off(0xDA0000 | w16(off(0xDA17D2) + 2 * k));
    P = off(0xDA0000 | w16(desc));
    enter_loader(); upload_stream();
    uint16_t EE = w16(desc + 2);
    for (uint32_t y = desc + 4; R[y] != 0xFF; y++) {
        int s = R[y]; uint16_t len = w16(off(0xDA2238) + 2 * s);
        P = off(l24(off(0xDA2118) + 3 * s)); xfer(EE, len); EE += len;
    }
    end_upload();
}
static void send_cmd(uint8_t c) {
    uint8_t a = c | E0;
    for (long k = 0;; k++) { wrp(0, a ^ 0x80); run(8); if (rdp(0) == a) { run(8); if (rdp(0) == a) break; }
        if (k > 4000000) { fprintf(stderr, "timeout cmd %02X\n", c); exit(2); } }
    E0 ^= 0x80; run(CPU_SLACK);
}
static void music(int id) { uint8_t b0 = R[0x739 + 3 * id], b1 = R[0x73A + 3 * id], b2 = R[0x73B + 3 * id]; upload_block(b0); sample_set(b1); send_cmd(b2); }
static void stop_all() {
    waitport(2, 0xAA); wrp(1, 0x13); waitport(1, 0x93); waitport(2, 0xAA);
    wrp(1, 0x93); waitport(1, 0x13); waitport(2, 0xAA);
    E2 = E3 = E9 = EA = 0; run(CPU_SLACK);
}
static void fade() { wrp(2, 0x7F); wrp(1, 0x18); waitport(1, 0x98); waitport(2, 0xAA); }
static uint32_t E5, strm_left; static uint16_t E7; static bool streaming = false; static unsigned fc = 0;
static void stream_start(int id) { if (E9) return; EA = R[0x7B9 + 2 * id]; E9 = R[0x7BA + 2 * id]; }
static void nmi() {
    if (EA && !streaming) {
        send_cmd(0x32);
        P = off(l24(0x190 + 3 * EA)); EA = 0; streaming = true;
        uint16_t n = nb(); n |= nb() << 8; strm_left = (n + 1) & 0xFFFE; E7 = nb(); E7 |= nb() << 8;
    }
    int chunks = (fc++ & 3) == 0 ? 4 : 1;
    while (streaming && chunks-- > 0) {
        uint32_t n = strm_left < 0x40 ? strm_left : 0x40;
        wrp(2, E7 & 0xFF); wrp(3, E7 >> 8);
        uint8_t a = 0x31 | E1; wrp(1, a); waitport(1, a ^ 0x80);
        D3 = 0; strm_left -= n; E7 += n;
        for (uint32_t i = 0; i < n; i += 2) { wrp(2, nb()); wrp(3, nb()); wrp(1, D3); uint8_t d = D3; D3 += 2; waitport(1, d); }
        bool done = false;
        if (!strm_left) { uint16_t m = nb(); m |= nb() << 8; if (!m) done = true; else { strm_left = (m + 1) & 0xFFFE; E7 = nb(); E7 |= nb() << 8; } }
        wrp(1, D3 + 1); waitport(2, 0xAA); wrp(1, 0x7F); E1 ^= 0x80; run(CPU_SLACK);
        if (done) { streaming = false; E3 = E9; E9 = 0; }
    }
    if (E2) send_cmd(E2);
    if (E3) send_cmd(E3);
    E2 = E3 = 0;
}
static int mode_host(const char *rom, const char *script, const std::string &dir) {
    R = load(rom);
    if (R.size() % 0x8000 == 512) R.erase(R.begin(), R.begin() + 512);
    power_all(); g_log_mmio = true;
    std::string ops; std::stringstream ss(script); std::string cmd;
    while (std::getline(ss, cmd, ';')) {
        std::stringstream c(cmd); std::string op; unsigned v = 0; c >> op >> std::hex >> v;
        uint32_t t0 = g_cyc;
        if (op == "init") { E0 = 0; upload_block(0x31); upload_block(0x2E); upload_block(0x2F); }
        else if (op == "blk") { stop_all(); upload_block(v); }
        else if (op == "mus") { stop_all(); music(v & 0x7F); }
        else if (op == "sfx") E2 = R[0x787 + v];
        else if (op == "stream") stream_start(v);
        else if (op == "stop") stop_all();
        else if (op == "fade") fade();
        else if (op == "rec") rec = true;
        else if (op == "norec") rec = false;
        else if (op == "frames") { unsigned n = strtoul(cmd.c_str() + cmd.find("frames") + 6, 0, 10); for (unsigned i = 0; i < n; i++) { run(17067); nmi(); } }
        else if (!op.empty()) { fprintf(stderr, "comando? %s\n", op.c_str()); return 1; }
        if (!op.empty()) { char t[64]; snprintf(t, 64, "%s %02X %u\n", op.c_str(), v, g_cyc - t0); ops += t; }
    }
    save(dir + "/pcm.raw", pcm.data(), pcm.size() * 2);
    save(dir + "/apuram.bin", SNES::smp.apuram, 65536);
    save(dir + "/mmio.bin", g_mmio.data(), g_mmio.size());
    save(dir + "/ops.txt", ops.data(), ops.size());
    return 0;
}

int main(int argc, char **argv) {
    memset(&Settings, 0, sizeof Settings);
    Settings.InterpolationMethod = 2;                 // gaussiana (a do hardware)
    std::string m = argc > 1 ? argv[1] : "";
    if (m == "bus" && argc == 3) return mode_bus(atoi(argv[2]));
    if (m == "cases" && argc == 4) return mode_cases(argv[2], argv[3]);
    if (m == "dsp" && argc == 4) return mode_dsp(argv[2], argv[3]);
    if (m == "prog" && argc == 5) return mode_prog(argv[2], atoi(argv[3]), argv[4]);
    if (m == "host" && argc == 5) return mode_host(argv[2], argv[3], argv[4]);
    fprintf(stderr, "uso: spctrace bus <psw> | cases <in> <out> | dsp <in> <out> | prog <img> <passos> <dir> | host <rom> <script> <dir>\n");
    return 1;
}
