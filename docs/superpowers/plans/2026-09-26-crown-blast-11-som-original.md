# Crown Blast: Plano 11, Som original

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tocar a música, os efeitos e as vozes originais do Super Bomberman 4, lidos da ROM do usuário no navegador (spec §8). O próprio driver de som da Hudson roda num APU emulado (SPC700 + S-DSP). O lado da CPU, que no jogo é o 65816, é reimplementado em TS. O resultado é o `AudioSink` real, ligado aos eventos do núcleo (§3.15) e às telas (§6).

**Architecture:**
- `web/src/audio/apu/`: o APU.
  - `smp.ts` + `smp-ops.ts` + `ipl.ts`: SPC700, timers, portas e IPL. Código **nosso**, escrito a partir da documentação do hardware.
  - `dsp/`: S-DSP. É o **porte para TS do `SPC_DSP` do blargg** (snes_spc 0.9.0, na versão usada pelo snes9x), módulo isolado sob LGPL-2.1.
  - `apu.ts`: junta as duas partes.
- `web/src/audio/host/`: o lado CPU.
  - `image.ts`: as fatias de áudio da ROM.
  - `host.ts`: porte do `spchost.cpp` [AUD §5], em geradores que dizem quantos ciclos o APU deve rodar a cada passo.
  - `script.ts`: roteiro síncrono usado nos goldens.
- `web/src/audio/engine/`: o motor em tempo real. Intercala o host com o APU, gera o NMI a 60 Hz, cuida da fila de SFX, faz a reamostragem e guarda os comandos.
- `web/src/audio/worklet*.ts` + `client.ts`: AudioWorklet e main thread.
- `web/src/audio/rom-sink.ts`: o `AudioSink` real.
- `web/src/audio/events.ts` + `cues.ts`: `GameEvent` → SFX/voz, e roteiros de transição.
- `web/src/audio/factory.ts` + `register.ts`: ligam o som ao `AudioDirector` do plano 10, que já prevê `registerAudioFactory` e `setGameEventAudio`.
- A **referência** dos goldens é o `spctrace`, uma ferramenta nativa em `analise/investigacao/audio/` ligada ao SMP/DSP do snes9x. Ela nunca vai para o site. Os fixtures guardam só números e hashes.

**Tech Stack:** TypeScript 7, Vite 8 (`?worker&url` para o worklet), Vitest 5, Web Audio (AudioWorklet). Ferramenta de referência em C++ (Apple clang, sem dependências novas). Node 24 (remoção de tipos) para o gerador de fixtures.

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md`: §1, §2.5 (`AudioSink`), §3.15 (`GameEvent`), §8 inteira, §10, §11 (linha 11 + aceite) e §12 A16. Relatório: `analise/investigacao/audio/RELATORIO.md` [AUD], `spchost.cpp` e scripts.

---

## Decisão: como emular o APU sem emscripten

**Restrição:** esta máquina não tem emcc nem wasm-ld. O `clang` da Apple tem o backend `wasm32`, mas não tem o linker, e não há Homebrew. A spec (§8.1) previa o `snes_spc` compilado para WASM.

**Opções avaliadas:**
- **(c) toolchain via npm.** O `@yowasp/clang` (LLVM/Clang/LLD para WebAssembly, v22, a rede responde) tornaria o WASM possível. Foi rejeitada, por quatro motivos:
  - dependência pesada de build;
  - `.wasm` binário versionado;
  - cola JS↔WASM dentro do worklet;
  - não elimina o porte do host.

  Fica como plano B, caso o TS não aguente o tempo real. O teste de desempenho da Tarefa 6 é o gatilho.
- **(a) APU inteiro em TS a partir da documentação.** Resolve a licença. O problema é o DSP: seu comportamento ciclo a ciclo (agenda de 32 fases, KON/KOFF a cada 2 amostras, BRR, gaussiana, eco com FIR, envelope com contador) só está especificado com precisão no código do blargg. Um DSP "da documentação" não chegaria bit a bit ao PCM da referência, e o golden mais forte (hash do PCM) viraria uma aproximação.
- **(b) porte do snes_spc inteiro.** O SMP do snes_spc tem um modelo de tempo diferente do SMP do snes9x (bapu), que é a referência validada contra o jogo (r = 0,99999). Daria trabalho sem ganho.

**Escolha: híbrido (a) + (b).**
- **SMP (SPC700, timers, portas, IPL): (a).** Código nosso, a partir da documentação do hardware, sem licença a herdar. São ≈ 1,5 mil linhas, e o comportamento é verificável por completo contra a referência:
  - padrão de barramento de cada opcode;
  - 4.064 casos aleatórios de 1 instrução (registradores, flags, ciclos e hash de cada acesso);
  - programa sintético de timers e portas, com o log de MMIO ciclo a ciclo.
- **S-DSP: (b), só o `SPC_DSP`.** Porte linha a linha do arquivo que a própria referência usa (`apu/bapu/dsp/SPC_DSP.cpp`, cabeçalho LGPL-2.1+ conferido no arquivo local). O módulo fica isolado:
  - pasta própria `src/audio/apu/dsp/`, com o aviso LGPL em cada arquivo;
  - texto da licença e fonte C++ correspondente em `web/vendor/snes_spc/`;
  - vai no *chunk* separado do worklet, que é substituível.

  Isso cumpre o que a spec já aceitava para o `snes_spc` em WASM. Como só o `SPC_DSP` é usado, a pergunta da A16 sobre a licença "do pacote inteiro" se reduz a esse arquivo, que é LGPL-2.1+ pelo próprio cabeçalho.
- **Fidelidade:** o PCM do TS deve ser **bit a bit igual** ao da referência. São 6 cenas sintéticas do DSP e 2 roteiros completos com a ROM, incluindo o hash do 1º segundo da música `$14` a partir do boot.

## Fatos medidos na preparação deste plano (valem como regra)

Medidos com o `spctrace`, que já foi compilado e rodado. O código dele está na Tarefa 1.

1. **Instruções atômicas.** O SMP do bapu pode parar uma instrução no meio quando o saldo de ciclos acaba. O host então escreve nas portas "dentro" da instrução. O nosso SMP executa instruções inteiras: `run(n)` roda instruções enquanto o saldo for negativo, e o que sobra passa para a próxima chamada. A referência (`spctrace`) usa o mesmo modelo.
2. **Com o modelo atômico, o host do `spchost.cpp` trava.** Há duas corridas, que o PoC só vencia por sorte de tempo:
   - (a) depois de cada upload, o driver reinicia e, em `$0965`, espera as **4 portas de entrada zeradas**. Como o host martela `$10` na porta 1, o driver nunca vê zero;
   - (b) depois do eco do *kick* de um bloco, o loader lê a porta 1 (`$1037–$103A`). Se o 1º byte do bloco já estiver lá e for 0, o loader acha que é o fim.

   **Regras do host (TS e referência):**
   - (a) com o driver no ar, antes de entrar no loader, esperar as portas 2 e 3 = `$AA` (o driver põe `$AA` ali em `$08C0`, ao terminar o init);
   - (b) rodar `CPU_SLACK` = 64 ciclos depois do eco do *kick*.
3. **Validação dessas regras contra o jogo.** Com elas, `init; blk 2F; mus 14` deixa a RAM do APU **idêntica aos blocos da ROM**, com as contagens da §10.2:
   - driver: 10.295 (10.075 + 220);
   - `$2E`: 5.366;
   - `$2F`: 4.515;
   - seq. `$14`: 4.064;
   - DIR: 144;
   - samples: 31.158;
   - 0 diferenças.

   As vozes `$07` e `$10` em stream também chegam intactas. O áudio da `$14` bate com o `jogo_battle_14.wav`: atraso constante de +1.290,9 ms em t = 1…25 s (o PoC dava +1.291) e r = 1,00000 em t = 5 s e 25 s.
4. **Mapa de MMIO da referência** (é o que o SMP deve fazer):
   - toda escrita em `$00F0–$00FF` também vai para a RAM;
   - leitura de `$F0`, `$F1` e `$FA–$FC` dá 0;
   - `$F4–$F7` lidos pelo SMP devolvem as portas CPU→SPC;
   - o que o SMP escreve em `$F4–$F7` fica em `ram[$F4..$F7]`, e é isso que a CPU lê;
   - a RAM começa zerada.

---

## Global Constraints

- **Worktree:** `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity` (branch `feat/fidelity`). Código em `web/`. Comandos a partir de `web/`: `npx vitest run`, `npx tsc --noEmit` e `npm run build`.
- **ROM:** `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"`. Os testes que a usam pulam sozinhos sem a variável (`describe.skipIf(!ROM)`).
- **Nunca versionar:** bytes da ROM, PCM, WAV, dumps de RAM do APU nem o snes9x. Fixtures só com números e hashes (`tests/fixtures/rom/audio-*.json`).
- **Posse de arquivos (plano 11):**
  - `web/src/audio/**`, menos `sink.ts`, que é do plano 5;
  - `web/vendor/snes_spc/**`;
  - `web/tests/audio/**`;
  - `web/tests/fixtures/rom/audio-*.json`;
  - `web/scripts/audio-golden/**`;
  - `analise/investigacao/audio/spctrace*` e `build_spctrace.sh`;
  - **1 linha** em `web/src/main.ts` (Tarefa 11): `import './audio/register';`, prevista pelo plano 10.
  - `web/public/audio/**` fica **sem uso**: não há `.wasm`.
- **Node sem `@types/node`:** os testes acessam `fs`, `crypto` e `env` por `tests/audio/node.ts` (`process.getBuiltinModule`), sem declarar tipos globais. Se o plano 5 instalar `@types/node`, nada muda.
- **Determinismo:** nada de `Math.random` nem de relógio em `src/audio/apu/**` e `src/audio/host/**`.
- **Licença:** todo arquivo em `src/audio/apu/dsp/` começa com o aviso LGPL da Tarefa 3. Nenhum outro arquivo do projeto copia código do snes9x nem do snes_spc.
- **Commits** em PT-BR, `feat(audio): …` / `test(audio): …`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Um commit por tarefa, feito a partir de `web/` com `git add` dos arquivos da tarefa.

## Ondas

| Onda | Tarefas (paralelas, arquivos disjuntos) | Depende de | Pode começar já (sem os planos 5 e 6)? |
|---|---|---|---|
| **1** | T1 ferramenta de referência + fixtures · T4 host (lado CPU) · T5 fila de amostras + reamostragem | – | **sim** |
| **2** | T2 SMP · T3 DSP (porte LGPL) · T7 motor em tempo real | T1 (T2); T1 + T5 (T3); T4 + T5 (T7) | **sim** |
| **3** | T6 APU completo + goldens com a ROM + desempenho | T2, T3, T4 | **sim** |
| **4** | T8 worklet + cliente · T9 `AudioSink` real · T10 eventos → som + roteiros | T6 + T7 (T8); **plano 5** + T7 (T9); **planos 5 e 6** (T10) | só T8 |
| **5** | T11 fábrica + registro (1 linha no `main.ts`) e aceite | T8, T9, T10 + **planos 5, 8, 9 e 10** mesclados | não |

As tarefas T1–T8 não importam nada de `src/rom/`, `src/core/` nem `src/audio/sink.ts`. Podem rodar antes do merge dos planos 5 e 6.

## Contratos do plano (nomes usados em todas as tarefas)

```ts
// src/audio/apu/smp.ts (T2)
export interface DspBus { run(clocks: number): void; read(addr: number): number; write(addr: number, v: number): void }
export type BusKind = 1 | 2 | 3;                      // 1 leitura, 2 escrita, 3 ciclo interno
export class Smp {
  readonly ram: Uint8Array; readonly cpuIn: Uint8Array;   // cpuIn = portas CPU→SPC
  pc: number; a: number; x: number; y: number; sp: number; psw: number; iplEnabled: boolean;
  clock: number; cycles: number;                          // saldo (Processor::clock) e total desde o power()
  onBus: ((kind: BusKind, addr: number, data: number, cycle: number) => void) | null;
  constructor(ram: Uint8Array, dsp: DspBus);
  power(): void; step(): void; run(cycles: number): void;
  readPort(p: number): number; writePort(p: number, v: number): void;
}
// src/audio/engine/ring.ts (T5)
export interface SampleSink { push(l: number, r: number): void }
// src/audio/apu/dsp/spc-dsp.ts (T3)
export class SpcDsp implements DspBus { constructor(ram: Uint8Array, out: SampleSink); reset(): void; … }
// src/audio/host/host.ts (T4)
export interface ApuBus { readPort(p: number): number; writePort(p: number, v: number): void; run(cycles: number): void }
export type HostOp = Generator<number, void, void>;        // yield = ciclos a rodar
export class SpcHost { boot(); bank(id); music(id); stop(); fade(); nmi(): HostOp; sfx(id): void; voice(id): boolean; … }
// src/audio/engine/commands.ts (T7)
export type AudioCmd = { t: 'boot' } | { t: 'bank'; id: 0x2f | 0x30 } | { t: 'music'; id: number } | { t: 'sfx'; id: number }
  | { t: 'voice'; id: number } | { t: 'stop' } | { t: 'fade' };
// src/audio/rom-sink.ts (T9)
export interface AudioTransport { send(cmd: AudioCmd): void; setGain?(g: number): void }
export class RomAudioSink implements AudioSink { constructor(t: AudioTransport, opts?: { onTick?: () => void }); setVolume(music: number, sfx: number): void; … }
// src/audio/sink.ts (plano 5, §2.5) — só consumido
export interface AudioSink { bank(id: 0x2f | 0x30): void; music(id: number): void; sfx(id: number): void;
  voice(id: number): void; stop(): void; fade(): void; tick(): void }
export class NoopSink implements AudioSink { … }
// src/app/audio.ts (plano 10) — só consumido, pelo register.ts (T11)
export function registerAudioFactory(f: () => Promise<AudioSink>): void;
export function setGameEventAudio(f: (sink: AudioSink, ev: readonly GameEvent[]) => void): void;
```

---

## Onda 1 (começa já)

### Task 1: Ferramenta de referência (`spctrace`), entradas sintéticas e fixtures

**Onda 1. Não depende dos planos 5 e 6.**

**Possui:**
- `analise/investigacao/audio/spctrace.cpp`
- `analise/investigacao/audio/spctrace_prepare.py`
- `analise/investigacao/audio/build_spctrace.sh`
- `web/scripts/audio-golden/make-fixtures.ts`
- `web/tests/audio/node.ts`
- `web/tests/audio/rom.ts`
- `web/tests/audio/gen/inputs.ts`
- `web/tests/audio/gen/host-scripts.ts`
- `web/tests/audio/fixtures.test.ts`
- `web/tests/fixtures/rom/audio-{smp-bus,smp-cases,dsp,prog,host}.json` (gerados)

**Interfaces:**
- Produz: `fixture<T>(name)`, `sha1(u8)`, `mmioBytes(log)`, `fs` e `env` (`tests/audio/node.ts`).
- Produz: `ROM` e `ROM_SHA1` (`tests/audio/rom.ts`).
- Produz: `xorshift32`, `smpCaseImage`, `smpCases`, `CASES_PER_OP`, `encodeCases`, `brrSample`, `dspScenes`, `encodeScene`, `progTimers`, `progDsp` e `PROG_STEPS` (`gen/inputs.ts`).
- Produz: `HOST_SCRIPTS` (`gen/host-scripts.ts`).
- Produz os 5 fixtures, consumidos pelas Tarefas 2, 3 e 6.

**Por que existe.** A referência é o SMP (byuu) + `SPC_DSP` (blargg) do snes9x (`apu/bapu`), o mesmo núcleo do `spchost` que a frente de áudio validou contra o jogo. Duas mudanças, explicadas no topo do arquivo:
- instruções atômicas;
- host com as regras (a) e (b).

O snes9x fica **fora do git**, em `analise/extraido/`, porque a licença é não comercial. O `spctrace_prepare.py` monta uma cópia com um gancho por ciclo de barramento no SMP. Os fixtures levam só números e hashes. As entradas sintéticas (casos de CPU, cenas do DSP, programas SPC) são **nossas** e ficam em `tests/audio/gen/inputs.ts`, lidas tanto pelo Vitest quanto pelo Node puro. Por isso esse arquivo é um "módulo folha": sem imports e só com sintaxe que o Node 24 consegue apagar (sem `enum`, sem *parameter properties*).

- [ ] **Step 1: Criar `analise/investigacao/audio/spctrace_prepare.py`**

```python
"""Prepara uma cópia do snes9x com ganchos de barramento no SMP (bapu) para o spctrace (plano 11).
Uso: python3 spctrace_prepare.py <snes9x-origem> <destino>
Cria <destino>/ com links para tudo do snes9x menos apu/, que é copiado e recebe o gancho
`SNES::bus_hook(tipo, endereço, dado)` em cada ciclo do SMP ('r' leitura, 'w' escrita, 'i' ciclo interno).
Nada disso vai para o repositório: a cópia fica fora do git (analise/extraido/)."""
import os, shutil, sys
src, dst = sys.argv[1], sys.argv[2]
if os.path.exists(dst): shutil.rmtree(dst)
os.makedirs(dst)
for name in os.listdir(src):
    if name == 'apu': continue
    os.symlink(os.path.join(src, name), os.path.join(dst, name))
shutil.copytree(os.path.join(src, 'apu'), os.path.join(dst, 'apu'), ignore=shutil.ignore_patterns('*.o'))
p = os.path.join(dst, 'apu/bapu/smp/core.cpp')
s = open(p).read()
REPL = [
('''void SMP::op_io() {
  tick();
}''', '''void SMP::op_io() {
  tick(); if (bus_hook) bus_hook('i', 0, 0);
}'''),
('''void SMP::op_io(unsigned clocks) {
  tick(clocks);
}''', '''void SMP::op_io(unsigned clocks) {
  tick(clocks); if (bus_hook) for (unsigned k = 0; k < clocks; k++) bus_hook('i', 0, 0);
}'''),
('''uint8 SMP::op_read(uint16 addr) {
  tick();
  if((addr & 0xfff0) == 0x00f0) return mmio_read(addr);
  if(addr >= 0xffc0 && status.iplrom_enable) return iplrom[addr & 0x3f];
  return apuram[addr];
}''', '''uint8 SMP::op_read(uint16 addr) {
  tick();
  uint8 v;
  if((addr & 0xfff0) == 0x00f0) v = mmio_read(addr);
  else if(addr >= 0xffc0 && status.iplrom_enable) v = iplrom[addr & 0x3f];
  else v = apuram[addr];
  if (bus_hook) bus_hook('r', addr, v);
  return v;
}'''),
('''void SMP::op_write(uint16 addr, uint8 data) {
  tick();
  if((addr & 0xfff0) == 0x00f0) mmio_write(addr, data);''', '''void SMP::op_write(uint16 addr, uint8 data) {
  tick(); if (bus_hook) bus_hook('w', addr, data);
  if((addr & 0xfff0) == 0x00f0) mmio_write(addr, data);'''),
('''uint8 SMP::op_readstack()
{
  tick();
  return apuram[0x0100 | ++regs.sp];
}''', '''uint8 SMP::op_readstack()
{
  tick();
  uint8 v = apuram[0x0100 | ++regs.sp];
  if (bus_hook) bus_hook('r', 0x0100 | regs.sp, v);
  return v;
}'''),
('''void SMP::op_writestack(uint8 data)
{
  tick();''', '''void SMP::op_writestack(uint8 data)
{
  tick(); if (bus_hook) bus_hook('w', 0x0100 | regs.sp, data);'''),
]
for a, b in REPL:
    assert s.count(a) == 1, 'trecho não encontrado: ' + a.splitlines()[0]
    s = s.replace(a, b)
s = 'void (*bus_hook)(char, unsigned, unsigned) = 0;\n' + s
open(p, 'w').write(s)
print('ok:', dst)
```

- [ ] **Step 2: Criar `analise/investigacao/audio/spctrace.cpp`**

```cpp
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
```

- [ ] **Step 3: Criar `analise/investigacao/audio/build_spctrace.sh` (executável) e compilar**

```sh
#!/bin/zsh
# Compila o spctrace (referência dos goldens de áudio do plano 11) contra o SMP/DSP do snes9x (bapu).
# O snes9x fica FORA do git (licença não comercial): só serve para gerar fixtures localmente.
#   SNES9X_SRC   cópia local do snes9x (padrão: a da frente de áudio)
#   SPCTRACE_OUT pasta de saída (padrão: analise/extraido/cores/rom-audio/spctrace, ignorada pelo git)
set -e
H=${0:A:h}
ROOT="/Users/dlotuz/Projetos Claude/Bomber Project"
SRC=${SNES9X_SRC:-"$ROOT/analise/extraido/cores/rom-audio/snes9x"}
OUT=${SPCTRACE_OUT:-"$ROOT/analise/extraido/cores/rom-audio/spctrace"}
mkdir -p "$OUT"
python3 "$H/spctrace_prepare.py" "$SRC" "$OUT/snes9x"
S="$OUT/snes9x"
FL=(-I$S -I$S/apu -I$S/apu/bapu -I$S/libretro -I$S/libretro/libretro-common/include -std=c++14 -O2
    -DRIGHTSHIFT_IS_SAR -D__LIBRETRO__ -DHAVE_STDINT_H -DHAVE_STRINGS_H -fno-rtti -fno-exceptions -w)
cd "$OUT"
c++ $FL -c "$S/apu/bapu/smp/smp.cpp" -o smp.o
c++ $FL -c "$S/apu/bapu/smp/smp_state.cpp" -o smp_state.o
c++ $FL -c "$S/apu/bapu/dsp/sdsp.cpp" -o sdsp.o
c++ $FL "$H/spctrace.cpp" smp.o smp_state.o sdsp.o -o spctrace
echo "$OUT/spctrace"
```

Run: `chmod +x analise/investigacao/audio/build_spctrace.sh && analise/investigacao/audio/build_spctrace.sh`
Expected: a última linha é o caminho do binário, `…/analise/extraido/cores/rom-audio/spctrace/spctrace`.

Conferência rápida: `"$SPCTRACE" bus 0 | head -3` deve imprimir exatamente:
```
00  2 r0400 i
01  8 r0400 rFFDE rFFDF i i i w01EF w01EE
02  4 r0400 r0401 r0040 w0040
```

- [ ] **Step 4: Criar os ajudantes de teste `web/tests/audio/node.ts` e `web/tests/audio/rom.ts`**

```ts
/**
 * Acesso ao Node nos testes de áudio SEM depender de @types/node (process.getBuiltinModule, Node ≥ 22.3).
 */
interface NodeFs { readFileSync(p: string | URL): Uint8Array; existsSync(p: string | URL): boolean; writeFileSync(p: string, d: Uint8Array): void }
interface NodeHash { update(d: Uint8Array): NodeHash; digest(enc: 'hex'): string }
interface NodeCrypto { createHash(alg: 'sha1'): NodeHash }
interface NodeProcess { env: Record<string, string | undefined>; getBuiltinModule(id: string): unknown }

const proc = (globalThis as unknown as { process: NodeProcess }).process;
export const fs = proc.getBuiltinModule('node:fs') as NodeFs;
const crypto = proc.getBuiltinModule('node:crypto') as NodeCrypto;
export const env = proc.env;

export function sha1(b: Uint8Array): string {
  return crypto.createHash('sha1').update(b).digest('hex');
}

/** Lê `tests/fixtures/rom/<name>`. */
export function fixture<T>(name: string): T {
  const bytes = fs.readFileSync(new URL(`../fixtures/rom/${name}`, import.meta.url));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** Converte um log de MMIO [ciclo, tipo, endereço & $FF, valor]… no formato binário do spctrace (8 bytes por registro). */
export function mmioBytes(log: number[]): Uint8Array {
  const out = new Uint8Array((log.length / 4) * 8);
  for (let i = 0, o = 0; i < log.length; i += 4, o += 8) {
    const c = log[i];
    out[o] = c & 0xff; out[o + 1] = (c >>> 8) & 0xff; out[o + 2] = (c >>> 16) & 0xff; out[o + 3] = c >>> 24;
    out[o + 4] = log[i + 1]; out[o + 5] = log[i + 2]; out[o + 6] = log[i + 3];
  }
  return out;
}
```

```ts
/** ROM do usuário para os testes de áudio (sem depender de tests/rom/helpers.ts do plano 5). */
import { env, fs } from './node';

function loadRom(): Uint8Array | null {
  const p = env.SB4_ROM;
  if (!p || !fs.existsSync(p)) return null;
  let b = new Uint8Array(fs.readFileSync(p));
  if (b.length % 0x8000 === 512) b = b.subarray(512);
  return b.length === 0x400000 ? b : null;
}

/** Arquivo sem cabeçalho de copiadora (4 MB), ou null. */
export const ROM: Uint8Array | null = loadRom();
export const ROM_SHA1 = '38f4394986bd39fcbe32a722a3fe103ee6177d9b';
```

- [ ] **Step 5: Criar as entradas sintéticas `web/tests/audio/gen/inputs.ts` e `web/tests/audio/gen/host-scripts.ts`**

```ts
/**
 * Entradas sintéticas dos goldens de áudio (plano 11). Tudo aqui é nosso (nenhum byte da ROM).
 * Módulo FOLHA: sem imports, só sintaxe apagável — é lido pelos testes (Vitest) e pelo Node puro
 * (`node scripts/audio-golden/make-fixtures.ts`, com remoção de tipos do Node 24).
 */

export function xorshift32(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s;
  };
}

// ------------------------------------------------------------------ SMP: 1 instrução por caso
export const CASES_PER_OP = 16;
export interface SmpCase { pc: number; a: number; x: number; y: number; sp: number; psw: number; op: number; b1: number; b2: number }

/** RAM compartilhada pelos casos: bytes em $20..$DF (ponteiros lidos da RAM caem em $2020..$DFDF). */
export function smpCaseImage(): Uint8Array {
  const r = xorshift32(0x5eed);
  const ram = new Uint8Array(0x10000);
  for (let i = 0; i < 0x10000; i++) ram[i] = 0x20 + (r() % 0xc0);
  for (let i = 0xf0; i <= 0xff; i++) ram[i] = 0;
  return ram;
}

/** 254 opcodes (sem SLEEP $EF e STOP $FF) × CASES_PER_OP, na ordem dos opcodes. Nenhum caso toca $00F0–$00FF nem $FFC0+. */
export function smpCases(): SmpCase[] {
  const r = xorshift32(0xc0ffee);
  const out: SmpCase[] = [];
  for (let op = 0; op < 256; op++) {
    if (op === 0xef || op === 0xff) continue;
    for (let k = 0; k < CASES_PER_OP; k++) {
      out.push({
        pc: 0x0400 + (r() & 0xff) * 4,
        a: r() & 0xff, x: r() & 0x1f, y: r() & 0x1f,
        sp: r() & 0xff, psw: r() & 0xff, op,
        b1: 0x20 + (r() % 0xb0), b2: 0x20 + (r() % 0xb0),
      });
    }
  }
  return out;
}

/** casos.bin do spctrace: "SPCC" u32 n, imagem[65536], n × 12 bytes. */
export function encodeCases(img: Uint8Array, cases: SmpCase[]): Uint8Array {
  const b = new Uint8Array(8 + 65536 + cases.length * 12);
  b.set([0x53, 0x50, 0x43, 0x43], 0);
  new DataView(b.buffer).setUint32(4, cases.length, true);
  b.set(img, 8);
  let o = 8 + 65536;
  for (const c of cases) {
    b.set([c.pc & 0xff, c.pc >> 8, c.a, c.x, c.y, c.sp, c.psw, c.op, c.b1, c.b2, 0, 0], o);
    o += 12;
  }
  return b;
}

// ------------------------------------------------------------------ BRR sintético
/** `blocks` blocos BRR de 9 bytes com cabeçalhos variados (shift 0..12, filtros 0..3); o último tem END (+LOOP se `loop`). */
export function brrSample(seed: number, blocks: number, loop: boolean): Uint8Array {
  const r = xorshift32(seed);
  const b = new Uint8Array(blocks * 9);
  for (let i = 0; i < blocks; i++) {
    const shift = r() % 13, filter = r() & 3;
    const last = i === blocks - 1;
    b[i * 9] = (shift << 4) | (filter << 2) | (last && loop ? 2 : 0) | (last ? 1 : 0);
    for (let j = 1; j < 9; j++) b[i * 9 + j] = r() & 0xff;
  }
  return b;
}

// ------------------------------------------------------------------ DSP: cenas
export interface DspWrite { clock: number; reg: number; value: number }
export interface DspScene { name: string; ram: Uint8Array; writes: DspWrite[]; totalClocks: number }

const SAMPLE_CLOCKS = 32;
const SCENE_SAMPLES = 8000;          // 0,25 s a 32 kHz

function sceneBase(): { ram: Uint8Array; w: (reg: number, value: number) => void; at: (clock: number) => void; writes: DspWrite[] } {
  const ram = new Uint8Array(0x10000);
  // DIR em $0200: 4 samples em $1000, $2000, $3000, $4000 (loop no início)
  const addrs = [0x1000, 0x2000, 0x3000, 0x4000];
  addrs.forEach((a, i) => {
    ram[0x200 + i * 4] = a & 0xff; ram[0x201 + i * 4] = a >> 8;
    ram[0x202 + i * 4] = a & 0xff; ram[0x203 + i * 4] = a >> 8;
    ram.set(brrSample(100 + i, 40 + i * 16, i !== 3), a);
  });
  const writes: DspWrite[] = [];
  let t = 0;
  const w = (reg: number, value: number) => { writes.push({ clock: t, reg, value: value & 0xff }); t += 3; };
  const at = (clock: number) => { if (clock < t) throw new Error('cena fora de ordem'); t = clock; };
  w(0x6c, 0x20); w(0x5d, 0x02); w(0x0c, 0x7f); w(0x1c, 0x7f); w(0x5c, 0x00); w(0x2d, 0); w(0x3d, 0); w(0x4d, 0);
  return { ram, w, at, writes };
}
function voice(w: (r: number, v: number) => void, v: number, srcn: number, pitch: number, adsr1: number, adsr2: number, gain: number, vl = 0x60, vr = 0x50): void {
  const b = v << 4;
  w(b + 0, vl); w(b + 1, vr); w(b + 2, pitch & 0xff); w(b + 3, pitch >> 8);
  w(b + 4, srcn); w(b + 5, adsr1); w(b + 6, adsr2); w(b + 7, gain);
}

export function dspScenes(): DspScene[] {
  const scenes: DspScene[] = [];
  const total = SCENE_SAMPLES * SAMPLE_CLOCKS;
  { // 1: uma voz com ADSR, em loop
    const s = sceneBase();
    voice(s.w, 0, 0, 0x1000, 0x8f, 0xe0, 0);
    s.at(1000); s.w(0x4c, 0x01);
    scenes.push({ name: 'adsr', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 2: modos de GAIN nas vozes 0–4 e KOFF no meio
    const s = sceneBase();
    const gains = [0x7f, 0xc0 | 0x1a, 0xe0 | 0x18, 0xa0 | 0x10, 0x80 | 0x14];
    gains.forEach((g, v) => voice(s.w, v, v & 3, 0x0800 + v * 0x333, 0x00, 0x00, g, 0x40 + v * 8, 0x70 - v * 8));
    s.at(640); s.w(0x4c, 0x1f);
    s.at(total / 2 + 17); s.w(0x5c, 0x05);
    s.at(total / 2 + 1000); s.w(0x5c, 0x00);
    scenes.push({ name: 'gain', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 3: eco com FIR e realimentação
    const s = sceneBase();
    voice(s.w, 0, 1, 0x1200, 0xff, 0xf0, 0);
    voice(s.w, 1, 2, 0x0e00, 0x9f, 0x31, 0, 0x30, 0x7f);
    s.w(0x6d, 0x80); s.w(0x7d, 0x03); s.w(0x0d, 0x50); s.w(0x2c, 0x40); s.w(0x3c, 0xc0);
    [0x7f, 0x00, 0xf0, 0x10, 0x00, 0x20, 0xe0, 0x08].forEach((c, i) => s.w((i << 4) | 0x0f, c));
    s.w(0x4d, 0x03); s.w(0x6c, 0x00);
    s.at(2048); s.w(0x4c, 0x03);
    scenes.push({ name: 'eco', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 4: ruído e modulação de pitch
    const s = sceneBase();
    voice(s.w, 0, 0, 0x0400, 0xff, 0xe0, 0);
    voice(s.w, 1, 1, 0x1000, 0xff, 0xe0, 0);
    voice(s.w, 2, 2, 0x1000, 0xcf, 0xb5, 0);
    s.w(0x2d, 0x02); s.w(0x3d, 0x04); s.w(0x6c, 0x3a);
    s.at(3000); s.w(0x4c, 0x07);
    scenes.push({ name: 'ruido-pmod', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 5: KON/KOFF em ciclos ímpares (meio de amostra) e sample sem loop (END)
    const s = sceneBase();
    voice(s.w, 3, 3, 0x2000, 0xfe, 0x2f, 0);
    voice(s.w, 4, 0, 0x0fff, 0x8a, 0x6c, 0);
    for (let k = 0; k < 40; k++) {
      s.at(5000 + k * 6000 + (k * 7) % 31);
      s.w(0x4c, k & 1 ? 0x10 : 0x08);
      s.w(0x5c, k % 3 === 0 ? 0x10 : 0x00);
    }
    scenes.push({ name: 'kon-koff', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  { // 6: FLG (reset, mudo) e mudança de pitch durante a nota
    const s = sceneBase();
    voice(s.w, 0, 1, 0x1000, 0xff, 0xe0, 0);
    s.at(500); s.w(0x4c, 0x01);
    for (let k = 1; k < 10; k++) { s.at(500 + k * 8000 + k); s.w(0x02, (k * 37) & 0xff); s.w(0x03, 0x08 + (k & 7)); }
    s.at(total / 3); s.w(0x6c, 0x60);
    s.at(total / 3 + 4000); s.w(0x6c, 0x80);
    s.at(total / 3 + 9000); s.w(0x6c, 0x20); s.w(0x4c, 0x01);
    scenes.push({ name: 'flg-pitch', ram: s.ram, writes: s.writes, totalClocks: total });
  }
  return scenes;
}

/** cena.bin do spctrace: "SPCD" u32 n, u32 total, ram[65536], n × {u32 ciclo, u8 reg, u8 valor, u16 0}. */
export function encodeScene(s: DspScene): Uint8Array {
  const b = new Uint8Array(12 + 65536 + s.writes.length * 8);
  const dv = new DataView(b.buffer);
  b.set([0x53, 0x50, 0x43, 0x44], 0);
  dv.setUint32(4, s.writes.length, true);
  dv.setUint32(8, s.totalClocks, true);
  b.set(s.ram, 12);
  let o = 12 + 65536;
  for (const w of s.writes) { dv.setUint32(o, w.clock, true); b[o + 4] = w.reg; b[o + 5] = w.value; o += 8; }
  return b;
}

// ------------------------------------------------------------------ programas SPC sintéticos (modo prog)
export const PROG_STEPS = 200;       // a cada passo k: portas CPU 0/1/2 = k, 7k, k>>1 (& $FF); run(1000)

/** Programa A: timers, leituras fantasmas ($FD/$FE), portas e $F1. Não toca o DSP. */
export function progTimers(): Uint8Array {
  const ram = new Uint8Array(0x10000);
  ram.set([
    0xcd, 0xef, 0xbd, 0x8f, 0x30, 0xf1, 0x8f, 0x20, 0xfa, 0x8f, 0x03, 0xfb, 0x8f, 0x00, 0xfc, 0x8f, 0x07, 0xf1, 0xe8, 0x00, 0xc4, 0x10,
    // $0216: laço
    0xe4, 0xfd, 0x60, 0x84, 0x11, 0xc4, 0x11, 0xeb, 0xfe, 0xcb, 0x12, 0xf8, 0xff, 0xd8, 0x13, 0xe4, 0xf4, 0xc4, 0xf5, 0xe4, 0xf5, 0xc4, 0xf4,
    0x8f, 0x00, 0xfd, 0xc4, 0xfe, 0xab, 0x10, 0xe4, 0x10, 0x28, 0x3f, 0xd0, 0xdc,
    // $023A
    0x8f, 0x05, 0xf1, 0x8f, 0x07, 0xf1, 0x8f, 0x37, 0xf1, 0x2f, 0xd1,
  ], 0x0200);
  return ram;
}

/** Programa B: liga uma voz pelo $F2/$F3 e lê ENVX/OUTX/ENDX em laço (precisa do DSP). */
export function progDsp(): Uint8Array {
  const ram = new Uint8Array(0x10000);
  // DIR em $0400: sample 0 em $0500 (loop no início)
  ram.set([0x00, 0x05, 0x00, 0x05], 0x0400);
  ram.set(brrSample(7, 32, true), 0x0500);
  const setup: [number, number][] = [
    [0x6c, 0x20], [0x5d, 0x04], [0x0c, 0x7f], [0x1c, 0x7f], [0x00, 0x7f], [0x01, 0x7f],
    [0x02, 0x00], [0x03, 0x10], [0x04, 0x00], [0x05, 0x8f], [0x06, 0xe0], [0x4c, 0x01],
  ];
  const code: number[] = [0xcd, 0xef, 0xbd, 0x8f, 0x30, 0xf1];
  for (const [r, v] of setup) code.push(0x8f, r, 0xf2, 0x8f, v, 0xf3);   // MOV $F2,#r ; MOV $F3,#v
  const loop = 0x0200 + code.length;
  code.push(
    0x8f, 0x08, 0xf2, 0xe4, 0xf3, 0xc4, 0x20,   // ENVX → $20
    0x8f, 0x09, 0xf2, 0xe4, 0xf3, 0xc4, 0x21,   // OUTX → $21
    0x8f, 0x7c, 0xf2, 0xe4, 0xf3, 0xc4, 0x22,   // ENDX → $22
    0xc4, 0xf3,                                 // escreve em ENDX (zera)
    0xe4, 0x20, 0xc4, 0xf4,                     // ENVX na porta 0
    0xab, 0x23,                                 // INC $23
  );
  const rel = loop - (0x0200 + code.length + 2);
  code.push(0x2f, rel & 0xff);                  // BRA laço
  ram.set(code, 0x0200);
  return ram;
}
```

```ts
/** Scripts do host usados nos goldens (mesma sintaxe do spchost/spctrace; argumentos em hexadecimal). Módulo folha. */
export const HOST_SCRIPTS: Record<string, string> = {
  /** Aceite da §11: 1º segundo da música $14 a partir do boot. */
  batalha: 'init; blk 2F; mus 14; frames 2; rec; frames 60',
  /** Menus, SFX, vozes (a $06 chega com a $10 ainda em stream e é ignorada), fade, troca de banco e STOP. */
  fluxo: 'init; blk 30; mus 12; frames 30; rec; sfx 1; frames 5; sfx 2; frames 5; stream 7; frames 120; fade; frames 30; blk 2F; mus 14; stream 10; sfx 7; frames 20; stream 6; frames 60; sfx c; frames 10; stop; frames 10',
};
```

- [ ] **Step 6: Criar o gerador `web/scripts/audio-golden/make-fixtures.ts`**

```ts
// Gera os fixtures de áudio do plano 11 rodando o spctrace (referência nativa, fora do repositório).
// Uso (em web/):  SPCTRACE=/caminho/spctrace [SB4_ROM=/caminho/rom.sfc] node scripts/audio-golden/make-fixtures.ts
// Só grava números e hashes em tests/fixtures/rom/audio-*.json. Nada de bytes da ROM.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CASES_PER_OP, smpCaseImage, smpCases, encodeCases, dspScenes, encodeScene, progTimers, progDsp, PROG_STEPS,
} from '../../tests/audio/gen/inputs.ts';
import { HOST_SCRIPTS } from '../../tests/audio/gen/host-scripts.ts';

const TOOL = process.env.SPCTRACE;
if (!TOOL || !existsSync(TOOL)) throw new Error('defina SPCTRACE com o binário do spctrace (analise/investigacao/audio/build_spctrace.sh)');
const OUT = new URL('../../tests/fixtures/rom/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'audio-golden-'));
const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const run = (...args: string[]) => execFileSync(TOOL, args, { maxBuffer: 1 << 26 }).toString();
const save = (name: string, obj: unknown) => { writeFileSync(new URL(name, OUT), JSON.stringify(obj, null, 1) + '\n'); console.log('gravado', name); };
const gen = { script: 'web/scripts/audio-golden/make-fixtures.ts', tool: 'analise/investigacao/audio/spctrace.cpp' };

// 1. padrões de barramento
const bus = (psw: number) => run('bus', String(psw)).trim().split('\n');
save('audio-smp-bus.json', { ...gen, psw00: bus(0), pswFF: bus(255) });

// 2. casos de 1 instrução
const cases = smpCases();
writeFileSync(join(tmp, 'cases.bin'), encodeCases(smpCaseImage(), cases));
run('cases', join(tmp, 'cases.bin'), join(tmp, 'cases.out'));
const res = new Uint8Array(readFileSync(join(tmp, 'cases.out')));
const perOp: Record<string, string> = {};
for (let i = 0; i < cases.length; i += CASES_PER_OP) {
  perOp[cases[i].op.toString(16).padStart(2, '0').toUpperCase()] = sha1(res.subarray(i * 12, (i + CASES_PER_OP) * 12));
}
save('audio-smp-cases.json', { ...gen, casesPerOp: CASES_PER_OP, total: cases.length, perOp });

// 3. cenas do DSP
const scenes: Record<string, { frames: number; sha1: string; first: number[] }> = {};
for (const s of dspScenes()) {
  const f = join(tmp, s.name + '.bin'), o = join(tmp, s.name + '.pcm');
  writeFileSync(f, encodeScene(s));
  run('dsp', f, o);
  const pcm = new Uint8Array(readFileSync(o));
  const i16 = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength >> 1);
  const nz = i16.findIndex(v => v !== 0);
  scenes[s.name] = { frames: i16.length / 2, sha1: sha1(pcm), first: Array.from(i16.subarray(Math.max(0, nz), Math.max(0, nz) + 8)) };
}
save('audio-dsp.json', { ...gen, scenes });

// 4. programas sintéticos
const progs: Record<string, unknown> = {};
for (const [name, img] of [['timers', progTimers()], ['dsp', progDsp()]] as const) {
  const d = join(tmp, 'prog-' + name); mkdirSync(d);
  writeFileSync(join(d, 'img.bin'), img);
  run('prog', join(d, 'img.bin'), String(PROG_STEPS), d);
  const mmio = new Uint8Array(readFileSync(join(d, 'mmio.bin')));
  const regs = readFileSync(join(d, 'regs.txt'), 'utf8').trim().split(' ').map(Number);
  progs[name] = {
    mmioCount: mmio.length / 8, mmioSha1: sha1(mmio),
    ramSha1: sha1(new Uint8Array(readFileSync(join(d, 'apuram.bin')))),
    pcmSha1: sha1(new Uint8Array(readFileSync(join(d, 'pcm.raw')))),
    regs: { pc: regs[0], a: regs[1], x: regs[2], y: regs[3], sp: regs[4], psw: regs[5], cycles: regs[6] },
  };
}
save('audio-prog.json', { ...gen, steps: PROG_STEPS, progs });

// 5. host completo (precisa da ROM)
const ROM = process.env.SB4_ROM;
if (ROM && existsSync(ROM)) {
  let rom = new Uint8Array(readFileSync(ROM));
  if (rom.length % 0x8000 === 512) rom = rom.subarray(512);
  const hosts: Record<string, unknown> = {};
  for (const [name, script] of Object.entries(HOST_SCRIPTS)) {
    const d = join(tmp, 'host-' + name); mkdirSync(d);
    run('host', ROM, script, d);
    const pcm = new Uint8Array(readFileSync(join(d, 'pcm.raw')));
    const mmio = new Uint8Array(readFileSync(join(d, 'mmio.bin')));
    const perSecond: string[] = [];
    for (let o = 0; o < pcm.length; o += 32000 * 4) perSecond.push(sha1(pcm.subarray(o, Math.min(pcm.length, o + 32000 * 4))));
    const win: string[] = [];              // mmio em janelas de 65.536 registros (para achar a 1ª divergência)
    for (let o = 0; o < mmio.length; o += 65536 * 8) win.push(sha1(mmio.subarray(o, Math.min(mmio.length, o + 65536 * 8))));
    hosts[name] = {
      script,
      ops: readFileSync(join(d, 'ops.txt'), 'utf8').trim().split('\n').map(l => { const [op, arg, cyc] = l.split(' '); return [op, parseInt(arg, 16), Number(cyc)]; }),
      pcmFrames: pcm.length / 4, pcmSha1PerSecond: perSecond,
      apuramSha1: sha1(new Uint8Array(readFileSync(join(d, 'apuram.bin')))),
      mmioCount: mmio.length / 8, mmioSha1: sha1(mmio), mmioWindows: win,
    };
  }
  save('audio-host.json', { ...gen, romSha1: sha1(rom), hosts });
} else console.log('SB4_ROM ausente: audio-host.json não foi gerado');
```

- [ ] **Step 7: Escrever o teste `web/tests/audio/fixtures.test.ts`**

```ts
import { fixture } from './node';
import { CASES_PER_OP, dspScenes, smpCases, PROG_STEPS } from './gen/inputs';
import { HOST_SCRIPTS } from './gen/host-scripts';
import { ROM_SHA1 } from './rom';

describe('fixtures de áudio (gerados pelo spctrace)', () => {
  it('padrões de barramento: 254 opcodes nos dois PSW', () => {
    const f = fixture<{ psw00: string[]; pswFF: string[] }>('audio-smp-bus.json');
    expect(f.psw00).toHaveLength(254);
    expect(f.pswFF).toHaveLength(254);
    expect(f.psw00[0]).toBe('00  2 r0400 i');
    expect(f.psw00[1]).toBe('01  8 r0400 rFFDE rFFDF i i i w01EF w01EE');
    expect(f.pswFF.find(l => l.startsWith('10 '))).toBe('10  2 r0400 r0401');   // BPL não tomado com N = 1
  });
  it('casos de 1 instrução: 1 hash por opcode', () => {
    const f = fixture<{ casesPerOp: number; total: number; perOp: Record<string, string> }>('audio-smp-cases.json');
    expect(f.casesPerOp).toBe(CASES_PER_OP);
    expect(f.total).toBe(smpCases().length);
    expect(Object.keys(f.perOp)).toHaveLength(254);
  });
  it('cenas do DSP: 8.000 quadros cada', () => {
    const f = fixture<{ scenes: Record<string, { frames: number; sha1: string }> }>('audio-dsp.json');
    expect(Object.keys(f.scenes).sort()).toEqual(dspScenes().map(s => s.name).sort());
    for (const s of Object.values(f.scenes)) expect(s.frames).toBe(8000);
  });
  it('programas sintéticos: 200 passos de 1.000 ciclos', () => {
    const f = fixture<{ steps: number; progs: Record<string, { regs: { cycles: number } }> }>('audio-prog.json');
    expect(f.steps).toBe(PROG_STEPS);
    expect(f.progs.timers.regs.cycles).toBe(200_000);
    expect(f.progs.dsp.regs.cycles).toBeGreaterThanOrEqual(200_000);
  });
  it('host com a ROM: mesma ROM e mesmos roteiros', () => {
    const f = fixture<{ romSha1: string; hosts: Record<string, { script: string; pcmFrames: number }> }>('audio-host.json');
    expect(f.romSha1).toBe(ROM_SHA1);
    for (const [k, s] of Object.entries(HOST_SCRIPTS)) expect(f.hosts[k].script).toBe(s);
    expect(f.hosts.batalha.pcmFrames).toBe(32001);
  });
});
```

Run: `cd web && npx vitest run tests/audio/fixtures.test.ts`
Expected: FAIL, porque os arquivos `audio-*.json` ainda não existem (ENOENT).

- [ ] **Step 8: Gerar os fixtures**

Run (em `web/`):
```sh
SPCTRACE="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/rom-audio/spctrace/spctrace" \
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" \
node scripts/audio-golden/make-fixtures.ts
```
Expected: 5 linhas `gravado audio-….json`.

Valores medidos na preparação (conferência; se algum não bater, o `spctrace` ou as entradas mudaram):
- `audio-dsp.json` → `adsr.sha1` = `49a79da205611ccb44cecb7578e8d238b3c55d72`;
- `audio-prog.json` → `timers.regs` = `{pc: 553, a: 0, x: 0, y: 0, sp: 239, psw: 2, cycles: 200000}` e `timers.mmioCount` = 42059;
- `audio-host.json` → `batalha.ops`:
  - `init` 585899, `blk` 154129, `mus` 1154429 e `frames` 34134 / 1024026;
  - `pcmFrames` = 32001;
  - `pcmSha1PerSecond[0]` = `26d26780f5dd5cc3570322db3c894598f17fc93d`;
  - `apuramSha1` = `cdab101718a5d5b6830bbaa6e51769f4c8e55fe0`.

- [ ] **Step 9: Rodar o teste e o tsc**

Run: `cd web && npx vitest run tests/audio/fixtures.test.ts && npx tsc --noEmit`
Expected: 5 testes PASS, tsc limpo.

- [ ] **Step 10: Commit**

```sh
cd web && git add ../analise/investigacao/audio/spctrace.cpp ../analise/investigacao/audio/spctrace_prepare.py \
  ../analise/investigacao/audio/build_spctrace.sh scripts/audio-golden tests/audio tests/fixtures/rom/audio-*.json
git commit -m "test(audio): spctrace (referência nativa) + entradas sintéticas e fixtures dos goldens de áudio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lado CPU (host): fatias da ROM e protocolo do driver

**Onda 1. Não depende dos planos 5 e 6.**

**Possui:**
- `web/src/audio/host/image.ts`
- `web/src/audio/host/host.ts`
- `web/tests/audio/host.test.ts`
- `web/tests/audio/fake-driver.ts`
- `web/tests/audio/gen/synth-image.ts`

**Interfaces:**
- Produz: `C0_START`, `C0_END`, `DATA_START`, `DATA_END`, `AudioSlices`, `slicesFromRom(rom)`, `slicesFromView(v)` e `AudioImage { u8, u16, u24, slices }`.
- Produz: `ApuBus`, `HostOp`, `CPU_SLACK` = 64, `POLL` = 8, `FRAME_CYCLES` = 17067, `HostTimeout`, `runSync(bus, op)`.
- Produz: `SpcHost { boot, bank, music, stop, fade, nmi, sfx, voice, e2, e3, e9, ea, driverUp, streaming, frameCount }`.
- Produz (testes): `FakeDriver` e `synthImage()`.

**Regras** (porte do `spchost.cpp` [AUD §1.4–1.5] + regras (a) e (b); o código abaixo já foi rodado contra o driver falso):
- Cada operação é um gerador. `yield n` significa "rode n ciclos do APU antes de continuar". Leituras e escritas de porta são imediatas.
- `runSync` executa a operação até o fim, com o mesmo efeito do `spchost`, que roda `run(8)` dentro dos laços.
- `sfx(id)` só marca o pendente `$E2 = tabela[$C0:0787 + id]`. Ele sai no `nmi()` seguinte, e um novo `sfx` antes disso sobrescreve o anterior (igual ao `spchost`; a fila de 1 por tick fica na Tarefa 9).
- `voice(id)` devolve `false` e não faz nada se `$E9 ≠ 0` (voz em andamento).
- O orçamento do stream conta as chamadas de `nmi()`:
  - 4 pedaços de 64 B quando `frameCount % 4 == 0`;
  - 1 nos outros frames (🟡, A16; igual ao `spchost`).
- STOP zera `$E2/$E3/$E9/$EA`, mas **não** interrompe um stream já iniciado (igual ao `spchost`; ver "Decisões").

- [ ] **Step 1: Criar o driver falso e a imagem sintética (ajudantes de teste)**

`web/tests/audio/fake-driver.ts`:
```ts
/**
 * Driver de som FALSO, só com o protocolo de portas do driver Hudson [AUD §1.4] (sem SPC700):
 * IPL/loader (kick, índice, fim), comandos da porta 0 (eco com bit 7 trocado), comandos da porta 1
 * ($10 loader, $13/$93 STOP, $18 fade, $31 stream) e "pronto" = $AA nas portas 2 e 3.
 * Serve para testar o host sem a ROM. Reage às escritas da CPU a cada run().
 */
export class FakeDriver {
  readonly ram = new Uint8Array(0x10000);
  readonly cpuIn = new Uint8Array(4);        // CPU→SPC
  readonly out = new Uint8Array(4);          // SPC→CPU
  mode: 'loader' | 'driver' = 'loader';
  /** comandos recebidos na porta 0 (id = valor & $7F) e na porta 1 (valor cru), em ordem */
  readonly cmds: number[] = [];
  readonly port1: number[] = [];
  readonly uploads: { dest: number; len: number }[] = [];
  streamChunks = 0;
  cycles = 0;
  private last = [0, 0, 0, 0];
  private loaderState: 'kick' | 'data' = 'kick';
  private dest = 0;
  private index = 0;
  private streamMode = false;
  private streamBase = 0;
  private readyIn = -1;

  constructor() { this.enterLoader(); }

  readPort(p: number): number { return this.out[p & 3]; }
  writePort(p: number, v: number): void { this.cpuIn[p & 3] = v & 0xff; }

  private enterLoader(): void {
    this.mode = 'loader'; this.loaderState = 'kick';
    this.out[0] = 0xaa; this.out[1] = 0xbb; this.out[2] = 0; this.out[3] = 0;
  }

  run(cycles: number): void {
    this.cycles += cycles;
    const [i0, i1, i2, i3] = this.cpuIn;
    const ch0 = i0 !== this.last[0], ch1 = i1 !== this.last[1];
    this.last = [i0, i1, i2, i3];
    if (this.readyIn >= 0 && --this.readyIn < 0) { this.out[2] = 0xaa; this.out[3] = 0xaa; }
    if (this.mode === 'loader') {
      if (this.loaderState === 'kick') { if (i0 !== 0xcc) return; }   // o 1º kick de cada entrada é sempre $CC
      else if (!ch0) return;
      if (this.loaderState === 'data' && i0 === (this.index & 0xff)) {
        this.ram[(this.dest + this.index) & 0xffff] = i1;
        this.index++;
        this.uploads[this.uploads.length - 1].len++;
        this.out[0] = i0;
        return;
      }
      this.out[0] = i0;                         // kick
      if (i1 !== 0) {
        this.loaderState = 'data'; this.dest = i2 | (i3 << 8); this.index = 0;
        this.uploads.push({ dest: this.dest, len: 0 });
      } else {
        this.mode = 'driver'; this.readyIn = 3;  // o driver (re)inicia e fica pronto depois
      }
      return;
    }
    if (ch0) { this.out[0] = i0 ^ 0x80; this.cmds.push(i0 & 0x7f); }
    if (!ch1) return;
    this.port1.push(i1);
    if (this.streamMode) {
      if (i1 === 0x7f) { this.streamMode = false; return; }
      if ((i1 & 1) === 0) { this.ram[(this.streamBase + i1) & 0xffff] = i2; this.ram[(this.streamBase + i1 + 1) & 0xffff] = i3; }
      this.out[1] = i1;
      return;
    }
    this.out[1] = i1 ^ 0x80;
    if (i1 === 0x10) { this.enterLoader(); return; }
    if ((i1 & 0x7f) === 0x31) { this.streamMode = true; this.streamBase = i2 | (i3 << 8); this.streamChunks++; }
  }
}
```

`web/tests/audio/gen/synth-image.ts`:
```ts
/**
 * Imagem de áudio SINTÉTICA com o mesmo formato das tabelas da ROM [AUD §1.2] e conteúdo nosso,
 * para testar o host sem a ROM. Módulo folha (sem imports).
 * Blocos: $31 driver (2 segmentos), $2E, $2F, $30 (bancos), $14 (sequência), $29 (voz $10), $1F (voz $06).
 * Música $14 = (bloco $14, set $13, comando $01). Set $13: lista IPL de 1 segmento + 2 samples em $7C00.
 */
const C0_START = 0xc00190, C0_LEN = 0x7eb - 0x190, DATA_START = 0xd90000, DATA_LEN = 0xde9c95 - 0xd90000;

export interface SynthImage {
  slices: { c0: Uint8Array; data: Uint8Array };
  /** o que cada bloco deve deixar na RAM do APU: [dest, bytes][] */
  blocks: Record<number, [number, Uint8Array][]>;
  /** samples do set $13, na ordem, a partir de $7C00 */
  set13: { list: [number, Uint8Array][]; samples: Uint8Array[] };
}

function bytes(seed: number, n: number): Uint8Array {
  const b = new Uint8Array(n); let s = seed;
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; b[i] = s >>> 24; }
  return b;
}

export function synthImage(): SynthImage {
  const c0 = new Uint8Array(C0_LEN), data = new Uint8Array(DATA_LEN);
  const put8 = (a: number, v: number) => { if (a >= DATA_START) data[a - DATA_START] = v; else c0[a - C0_START] = v; };
  const put16 = (a: number, v: number) => { put8(a, v & 0xff); put8(a + 1, v >> 8); };
  const put24 = (a: number, v: number) => { put16(a, v & 0xffff); put8(a + 2, v >> 16); };
  const putBytes = (a: number, b: Uint8Array) => b.forEach((v, i) => put8(a + i, v));
  let cursor = 0xd90000;
  const blocks: Record<number, [number, Uint8Array][]> = {};
  /** grava um bloco IPL [len][dest][dados]… 0,0 + palavra final e aponta a entrada `id` da tabela $C0:0190 */
  const block = (id: number, segs: [number, Uint8Array][], jump = 0x0800) => {
    put24(0xc00190 + 3 * id, cursor);
    for (const [dest, b] of segs) { put16(cursor, b.length); put16(cursor + 2, dest); putBytes(cursor + 4, b); cursor += 4 + b.length; }
    put16(cursor, 0); put16(cursor + 2, jump); cursor += 4;
    blocks[id] = segs;
  };
  block(0x31, [[0x0800, bytes(1, 40)], [0xff00, bytes(2, 12)]]);
  block(0x2e, [[0x5300, bytes(3, 16)], [0x5500, bytes(4, 30)]]);
  block(0x2f, [[0x3100, bytes(5, 50)]]);
  block(0x30, [[0x3100, bytes(6, 33)]]);
  block(0x14, [[0x4300, bytes(7, 64)]]);
  block(0x29, [[0x53fc, bytes(8, 4)], [0x54fc, bytes(9, 4)], [0x6a00, bytes(10, 301)]]);   // voz $10: 301 bytes de stream
  block(0x1f, [[0x53fc, bytes(11, 4)], [0x54fc, bytes(12, 4)], [0x6a00, bytes(13, 90)]]);  // voz $06
  // música $14 → (bloco $14, set $13, comando $01)
  put8(0xc00739 + 3 * 0x14, 0x14); put8(0xc0073a + 3 * 0x14, 0x13); put8(0xc0073b + 3 * 0x14, 0x01);
  // SFX: comando $32 + id
  for (let id = 1; id < 50; id++) put8(0xc00787 + id, 0x32 + id);
  // vozes: (bloco $19 + id, comando $63 + id)
  for (let id = 1; id <= 0x14; id++) { put8(0xc007b9 + 2 * id, 0x19 + id); put8(0xc007ba + 2 * id, 0x63 + id); }
  // set de samples $13 (descritor no banco $DA)
  const listAddr = 0xda1900, descAddr = 0xda1a00;
  put16(0xda17d2 + 2 * 0x13, descAddr & 0xffff);
  const list: [number, Uint8Array][] = [[0x5378, bytes(14, 20)]];
  put16(listAddr, 20); put16(listAddr + 2, 0x5378); putBytes(listAddr + 4, list[0][1]); put16(listAddr + 24, 0);
  put16(descAddr, listAddr & 0xffff); put16(descAddr + 2, 0x7c00); put8(descAddr + 4, 0x05); put8(descAddr + 5, 0x09); put8(descAddr + 6, 0xff);
  const samples = [bytes(15, 45), bytes(16, 27)];
  [0x05, 0x09].forEach((s, i) => {
    const at = 0xdb0000 + i * 0x100;
    put24(0xda2118 + 3 * s, at); put16(0xda2238 + 2 * s, samples[i].length); putBytes(at, samples[i]);
  });
  return { slices: { c0, data }, blocks, set13: { list, samples } };
}
```

- [ ] **Step 2: Escrever o teste `web/tests/audio/host.test.ts`**

```ts
import { AudioImage, C0_END, C0_START, DATA_END, DATA_START, slicesFromRom } from '../../src/audio/host/image';
import { SpcHost, runSync, CPU_SLACK, HostTimeout } from '../../src/audio/host/host';
import { FakeDriver } from './fake-driver';
import { synthImage } from './gen/synth-image';

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

function setup() {
  const si = synthImage();
  const drv = new FakeDriver();
  const host = new SpcHost(new AudioImage(si.slices), drv);
  return { si, drv, host };
}

describe('AudioImage', () => {
  it('lê as duas fatias por endereço SNES e recusa o resto', () => {
    const rom = new Uint8Array(0x400000);
    rom[0x0190] = 0x11; rom[0x07ea] = 0x22; rom[0x190000] = 0x33; rom[0x1e9c94] = 0x44;
    const img = new AudioImage(slicesFromRom(rom));
    expect(img.u8(C0_START)).toBe(0x11);
    expect(img.u8(0xc007ea)).toBe(0x22);
    expect(img.u8(DATA_START)).toBe(0x33);
    expect(img.u8(0xde9c94)).toBe(0x44);
    expect(() => img.u8(C0_END)).toThrow(RangeError);
    expect(() => img.u8(DATA_END)).toThrow(RangeError);
    expect(() => img.u8(0xc00000)).toThrow(RangeError);
    expect(img.slices.c0.length + img.slices.data.length).toBe(1627 + 367765);
  });
});

describe('SpcHost contra o driver falso', () => {
  it('boot sobe $31, $2E e $2F e deixa os bytes certos na RAM', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    for (const id of [0x31, 0x2e, 0x2f]) for (const [d, b] of si.blocks[id]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
    expect(drv.mode).toBe('driver');
    expect(host.driverUp).toBe(true);
  });

  it('música: STOP ($13, $93) antes do loader ($10), depois bloco, samples e comando', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    const n = drv.port1.length;
    runSync(drv, host.music(0x14));
    expect(drv.port1.slice(n, n + 3)).toEqual([0x13, 0x93, 0x10]);
    for (const [d, b] of si.blocks[0x14]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
    expect(same(drv.ram.subarray(0x5378, 0x5378 + 20), si.set13.list[0][1])).toBe(true);
    let a = 0x7c00;
    for (const s of si.set13.samples) { expect(same(drv.ram.subarray(a, a + s.length), s)).toBe(true); a += s.length; }
    expect(drv.cmds).toEqual([0x01]);
  });

  it('banco: STOP antes do bloco', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    const n = drv.port1.length;
    runSync(drv, host.bank(0x30));
    expect(drv.port1.slice(n, n + 3)).toEqual([0x13, 0x93, 0x10]);
    for (const [d, b] of si.blocks[0x30]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
  });

  it('SFX sai no NMI como $32 + id, um por NMI (o pendente é sobrescrito, como no spchost)', () => {
    const { drv, host } = setup();
    runSync(drv, host.boot());
    host.sfx(0x07); runSync(drv, host.nmi());
    host.sfx(0x0c); host.sfx(0x08); runSync(drv, host.nmi());
    runSync(drv, host.nmi());
    expect(drv.cmds).toEqual([0x39, 0x3a]);
  });

  it('voz: $32, pedaços no orçamento 4/1/1/1, comando $63 + id; outra voz é ignorada enquanto a 1ª não termina', () => {
    const { si, drv, host } = setup();
    runSync(drv, host.boot());
    expect(host.voice(0x10)).toBe(true);
    expect(host.voice(0x06)).toBe(false);
    const perFrame: number[] = [];
    for (let f = 0; f < 8; f++) { const c = drv.streamChunks; runSync(drv, host.nmi()); perFrame.push(drv.streamChunks - c); }
    // bloco $29: 4 + 4 + 301 bytes → pedaços de ≤ 64 bytes: 1 + 1 + 5 = 7
    expect(perFrame).toEqual([4, 1, 1, 1, 0, 0, 0, 0]);
    expect(drv.cmds).toEqual([0x32, 0x73]);
    for (const [d, b] of si.blocks[0x29]) expect(same(drv.ram.subarray(d, d + b.length), b)).toBe(true);
    expect(host.voice(0x06)).toBe(true);
  });

  it('STOP zera SFX e voz pendentes; FADE manda $18 com velocidade $7F', () => {
    const { drv, host } = setup();
    runSync(drv, host.boot());
    host.sfx(1); host.voice(0x10);
    runSync(drv, host.stop());
    expect([host.e2, host.e3, host.e9, host.ea]).toEqual([0, 0, 0, 0]);
    runSync(drv, host.fade());
    expect(drv.port1.at(-1)).toBe(0x18);
    expect(drv.cpuIn[2]).toBe(0x7f);
  });

  it('regras de robustez: espera $AA/$AA antes do loader e folga depois do kick', () => {
    const { drv, host } = setup();
    runSync(drv, host.boot());
    drv.out[2] = 0;                                     // driver "ocupado"
    const op = host.bank(0x2f);
    let steps = 0;
    for (const n of op) { drv.run(n); if (++steps === 50) { drv.out[2] = 0xaa; drv.out[3] = 0xaa; } }
    expect(steps).toBeGreaterThan(50);
    expect(CPU_SLACK).toBe(64);
  });

  it('driver mudo estoura o limite com HostTimeout', () => {
    const si = synthImage();
    const dead = { readPort: () => 0, writePort: () => {}, run: () => {} };
    const host = new SpcHost(new AudioImage(si.slices), dead);
    expect(() => runSync(dead, host.boot())).toThrow(HostTimeout);
  });
});
```

Run: `cd web && npx vitest run tests/audio/host.test.ts`
Expected: FAIL (`src/audio/host/image` não existe).

- [ ] **Step 3: Implementar `web/src/audio/host/image.ts`**

```ts
/**
 * Fatias de áudio da ROM do usuário [AUD §1.1]: $C0:0190–$C0:07EA (tabelas do lado CPU) e
 * $D9:0000–$DE:9C94 (driver, sequências, samples, sets). Endereços SNES HiROM de 24 bits.
 */
export const C0_START = 0xc00190;
export const C0_END = 0xc007eb;          // exclusivo
export const DATA_START = 0xd90000;
export const DATA_END = 0xde9c95;        // exclusivo

export interface AudioSlices { c0: Uint8Array; data: Uint8Array }

/** `rom` = arquivo sem cabeçalho de copiadora (4 MB). Offset = endereço − $C00000 (bancos $C0–$FF). */
export function slicesFromRom(rom: Uint8Array): AudioSlices {
  return {
    c0: rom.slice(C0_START - 0xc00000, C0_END - 0xc00000),
    data: rom.slice(DATA_START - 0xc00000, DATA_END - 0xc00000),
  };
}

/** Mesmas fatias a partir do `RomView` do plano 5 (`bytes(endereçoSNES, n)`), sem depender do tipo dele. */
export function slicesFromView(v: { bytes(addr: number, n: number): Uint8Array }): AudioSlices {
  return { c0: v.bytes(C0_START, C0_END - C0_START).slice(), data: v.bytes(DATA_START, DATA_END - DATA_START).slice() };
}

export class AudioImage {
  readonly slices: AudioSlices;
  constructor(slices: AudioSlices) {
    this.slices = slices;
    if (slices.c0.length !== C0_END - C0_START) throw new RangeError('fatia $C0 com tamanho errado');
    if (slices.data.length !== DATA_END - DATA_START) throw new RangeError('fatia $D9–$DE com tamanho errado');
  }
  u8(addr: number): number {
    if (addr >= C0_START && addr < C0_END) return this.slices.c0[addr - C0_START];
    if (addr >= DATA_START && addr < DATA_END) return this.slices.data[addr - DATA_START];
    throw new RangeError(`endereço de áudio fora das fatias: $${addr.toString(16)}`);
  }
  u16(addr: number): number { return this.u8(addr) | (this.u8(addr + 1) << 8); }
  u24(addr: number): number { return this.u8(addr) | (this.u8(addr + 1) << 8) | (this.u8(addr + 2) << 16); }
}
```

- [ ] **Step 4: Implementar `web/src/audio/host/host.ts`**

```ts
/**
 * Lado CPU do som (o 65816 do jogo), portado de `analise/investigacao/audio/spchost.cpp` [AUD §1.4–1.5],
 * com as 2 regras de robustez do plano 11 (iguais às do `spctrace`, a referência dos goldens):
 *  (a) com o driver no ar, antes de entrar no loader espera as portas 2 e 3 = $AA;
 *  (b) 64 ciclos de folga depois do eco do "kick" de cada bloco.
 * Cada operação é um gerador que devolve (yield) quantos ciclos o APU deve rodar antes de continuar.
 * `runSync` roda uma operação até o fim (goldens); o motor em tempo real a intercala com o áudio.
 */
import type { AudioImage } from './image';

export interface ApuBus {
  readPort(p: number): number;             // SPC→CPU ($2140–3 lidos pela CPU)
  writePort(p: number, v: number): void;   // CPU→SPC
  run(cycles: number): void;
}
export type HostOp = Generator<number, void, void>;

export const CPU_SLACK = 64;
export const POLL = 8;
export const FRAME_CYCLES = 17067;          // 1.024.000 / 60
const LIMIT = 4_000_000;

export class HostTimeout extends Error {}

export function runSync(bus: ApuBus, op: HostOp): void {
  for (const n of op) bus.run(n);
}

const BLOCKS = 0xc00190, MUSIC = 0xc00739, SFX = 0xc00787, VOICE = 0xc007b9;
const SETS = 0xda17d2, SMP_PTR = 0xda2118, SMP_LEN = 0xda2238;

export class SpcHost {
  private readonly img: AudioImage;
  private readonly bus: ApuBus;
  // variáveis de página direta do jogo ($D0–$F3)
  d3 = 0; e0 = 0; e1 = 0; e2 = 0; e3 = 0; e9 = 0; ea = 0;
  private p = 0;                           // ponteiro de leitura ($D0–$D2), endereço SNES
  driverUp = false;
  streaming = false;
  private strmLeft = 0;
  private e7 = 0;
  frameCount = 0;                          // conta as chamadas de nmi() (orçamento 4/1/1/1)

  constructor(img: AudioImage, bus: ApuBus) { this.img = img; this.bus = bus; }

  private nb(): number { return this.img.u8(this.p++); }
  private w(p: number, v: number): void { this.bus.writePort(p, v & 0xff); }
  private r(p: number): number { return this.bus.readPort(p); }

  private *wait(p: number, v: number): HostOp {
    for (let k = 0; this.r(p) !== v; k++) {
      yield POLL;
      if (k > LIMIT) throw new HostTimeout(`porta ${p} = $${v.toString(16)} (tem $${this.r(p).toString(16)})`);
    }
  }
  private *enterLoader(): HostOp {                       // $C0:029B
    if (this.driverUp) { yield* this.wait(2, 0xaa); yield* this.wait(3, 0xaa); }   // regra (a)
    for (let k = 0; ; k++) {
      this.w(1, 0x10); yield POLL;
      if (this.r(0) === 0xaa && this.r(1) === 0xbb) break;
      if (k > LIMIT) throw new HostTimeout('loader');
    }
    this.d3 = 0xcc;
  }
  private *xfer(dest: number, n: number): HostOp {       // $C0:0310–$C0:0360
    this.w(1, 0xff); this.w(2, dest & 0xff); this.w(3, dest >> 8); this.w(0, this.d3);
    yield* this.wait(0, this.d3);
    yield CPU_SLACK;                                       // regra (b)
    this.d3 = 0;
    for (let i = 0; i < n; i++) {
      this.w(1, this.nb()); this.w(0, this.d3);
      yield* this.wait(0, this.d3);
      this.d3 = (this.d3 + 1) & 0xff;
    }
    this.d3 = (this.d3 + 1) & 0xff;
    if (this.d3 === 0) this.d3 = 1;
  }
  private *uploadStream(): HostOp {                      // $C0:02F0: [len][dest][dados]… até len = 0
    for (;;) {
      const n = this.nb() | (this.nb() << 8);
      if (!n) return;
      const d = this.nb() | (this.nb() << 8);
      yield* this.xfer(d, n);
    }
  }
  private *endUpload(): HostOp {                         // $C0:02BD
    this.w(1, 0); this.w(2, this.nb()); this.w(3, this.nb());
    if (this.d3 === 0xaa) this.d3 = 0xab;
    this.w(0, this.d3);
    yield* this.wait(0, this.d3);
    this.e0 = (this.d3 & 0x80) ^ 0x80;
    yield CPU_SLACK;
  }
  private *uploadBlock(i: number): HostOp {              // $C0:0416
    this.p = this.img.u24(BLOCKS + 3 * i);
    yield* this.enterLoader(); yield* this.uploadStream(); yield* this.endUpload();
    this.driverUp = true;
  }
  private *sampleSet(k: number): HostOp {                // $C0:0226
    const desc = 0xda0000 | this.img.u16(SETS + 2 * k);
    this.p = 0xda0000 | this.img.u16(desc);
    yield* this.enterLoader(); yield* this.uploadStream();
    let ee = this.img.u16(desc + 2);
    for (let y = desc + 4; this.img.u8(y) !== 0xff; y++) {
      const s = this.img.u8(y);
      const len = this.img.u16(SMP_LEN + 2 * s);
      this.p = this.img.u24(SMP_PTR + 3 * s);
      yield* this.xfer(ee, len);
      ee = (ee + len) & 0xffff;
    }
    yield* this.endUpload();                              // lê os 2 bytes depois do último sample, como o jogo
  }
  private *sendCmd(c: number): HostOp {                  // $C0:071D
    const a = c | this.e0;
    for (let k = 0; ; k++) {
      this.w(0, a ^ 0x80); yield POLL;
      if (this.r(0) === a) { yield POLL; if (this.r(0) === a) break; }
      if (k > LIMIT) throw new HostTimeout(`comando $${c.toString(16)}`);
    }
    this.e0 ^= 0x80;
    yield CPU_SLACK;
  }
  private *stopAll(): HostOp {                           // $C0:046E
    yield* this.wait(2, 0xaa); this.w(1, 0x13); yield* this.wait(1, 0x93); yield* this.wait(2, 0xaa);
    this.w(1, 0x93); yield* this.wait(1, 0x13); yield* this.wait(2, 0xaa);
    this.e2 = this.e3 = this.e9 = this.ea = 0;
    yield CPU_SLACK;
  }

  /** $C0:0376: driver ($31), SFX/instrumentos ($2E) e banco da partida ($2F). */
  *boot(): HostOp { this.e0 = 0; yield* this.uploadBlock(0x31); yield* this.uploadBlock(0x2e); yield* this.uploadBlock(0x2f); }
  /** $C3:4A16: STOP + bloco (banco de SFX $2F/$30). */
  *bank(id: number): HostOp { yield* this.stopAll(); yield* this.uploadBlock(id); }
  /** $C3:4A44: STOP + música (bloco, set de samples e comando da tabela $C0:0739). */
  *music(id: number): HostOp {
    yield* this.stopAll();
    const m = MUSIC + 3 * (id & 0x7f);
    const b0 = this.img.u8(m), b1 = this.img.u8(m + 1), b2 = this.img.u8(m + 2);
    yield* this.uploadBlock(b0); yield* this.sampleSet(b1); yield* this.sendCmd(b2);
  }
  *stop(): HostOp { yield* this.stopAll(); }
  /** $C0:0445. */
  *fade(): HostOp { this.w(2, 0x7f); this.w(1, 0x18); yield* this.wait(1, 0x98); yield* this.wait(2, 0xaa); }
  /** SFX pendente ($E2); sai no próximo nmi(). Sobrescreve um pendente não enviado (como o spchost). */
  sfx(id: number): void { this.e2 = this.img.u8(SFX + id); }
  /** $C0:03E1. Devolve false quando a voz é ignorada porque já há outra em andamento. */
  voice(id: number): boolean {
    if (this.e9) return false;
    this.ea = this.img.u8(VOICE + 2 * id); this.e9 = this.img.u8(VOICE + 2 * id + 1);
    return true;
  }
  /** $C0:0573 + $C0:05F3 + $C0:0704, 1× por frame: stream (4 pedaços no 1º de cada 4 frames, 1 nos outros), depois SFX e comando da voz. */
  *nmi(): HostOp {
    if (this.ea && !this.streaming) {
      yield* this.sendCmd(0x32);
      this.p = this.img.u24(BLOCKS + 3 * this.ea); this.ea = 0;
      this.streaming = true;
      const n = this.nb() | (this.nb() << 8);
      this.strmLeft = (n + 1) & 0xfffe;
      this.e7 = this.nb() | (this.nb() << 8);
    }
    let chunks = (this.frameCount++ & 3) === 0 ? 4 : 1;
    while (this.streaming && chunks-- > 0) {
      const n = Math.min(this.strmLeft, 0x40);
      this.w(2, this.e7 & 0xff); this.w(3, this.e7 >> 8);
      const a = 0x31 | this.e1;
      this.w(1, a); yield* this.wait(1, a ^ 0x80);
      this.d3 = 0; this.strmLeft -= n; this.e7 = (this.e7 + n) & 0xffff;
      for (let i = 0; i < n; i += 2) {
        this.w(2, this.nb()); this.w(3, this.nb()); this.w(1, this.d3);
        const d = this.d3; this.d3 = (this.d3 + 2) & 0xff;
        yield* this.wait(1, d);
      }
      let done = false;
      if (!this.strmLeft) {
        const m = this.nb() | (this.nb() << 8);
        if (!m) done = true;
        else { this.strmLeft = (m + 1) & 0xfffe; this.e7 = this.nb() | (this.nb() << 8); }
      }
      this.w(1, this.d3 + 1); yield* this.wait(2, 0xaa); this.w(1, 0x7f);
      this.e1 ^= 0x80;
      yield CPU_SLACK;
      if (done) { this.streaming = false; this.e3 = this.e9; this.e9 = 0; }
    }
    if (this.e2) yield* this.sendCmd(this.e2);
    if (this.e3) yield* this.sendCmd(this.e3);
    this.e2 = this.e3 = 0;
  }
}
```

- [ ] **Step 5: Rodar**

Run: `cd web && npx vitest run tests/audio/host.test.ts && npx tsc --noEmit`
Expected: 9 testes PASS, tsc limpo.

- [ ] **Step 6: Commit**

```sh
cd web && git add src/audio/host tests/audio/host.test.ts tests/audio/fake-driver.ts tests/audio/gen/synth-image.ts
git commit -m "feat(audio): lado CPU do som (host do driver Hudson) em geradores, com driver falso para testes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fila de amostras e reamostragem

**Onda 1. Não depende dos planos 5 e 6.**

**Possui:**
- `web/src/audio/engine/ring.ts`
- `web/src/audio/engine/resample.ts`
- `web/tests/audio/ring.test.ts`
- `web/tests/audio/resample.test.ts`

**Interfaces:**
- Produz: `SampleSink { push(l, r) }`, `SampleRing(capacityFrames) { push, shift(outL, outR, off, n), size, dropped, clear }`.
- Produz: `Resampler(inRate, outRate) { process(outL, outR, n, fill), consumed }` e `Fill`.

**Regras:**
- A saída int16 vira float dividindo por 32768.
- A reamostragem é Hermite cúbica de 4 pontos, com latência fixa de 3 amostras de saída quando as taxas são iguais.
- Ela só é usada se o navegador recusar `AudioContext({ sampleRate: 32000 })` (Tarefa 8).

- [ ] **Step 1: Escrever os testes**

`web/tests/audio/ring.test.ts`:
```ts
import { SampleRing } from '../../src/audio/engine/ring';

describe('SampleRing', () => {
  it('guarda e devolve quadros em ordem, como float', () => {
    const r = new SampleRing(4);
    r.push(16384, -16384); r.push(32767, -32768);
    const L = new Float32Array(3), R = new Float32Array(3);
    expect(r.shift(L, R, 0, 3)).toBe(2);
    expect(Array.from(L.subarray(0, 2))).toEqual([0.5, 32767 / 32768]);
    expect(Array.from(R.subarray(0, 2))).toEqual([-0.5, -1]);
    expect(r.size).toBe(0);
  });
  it('dá a volta e descarta quando cheia', () => {
    const r = new SampleRing(3);
    for (let i = 1; i <= 5; i++) r.push(i, -i);
    expect(r.size).toBe(3);
    expect(r.dropped).toBe(2);
    const L = new Float32Array(2), R = new Float32Array(2);
    r.shift(L, R, 0, 2);
    r.push(9, -9);
    const L2 = new Float32Array(2), R2 = new Float32Array(2);
    r.shift(L2, R2, 0, 2);
    expect(Array.from(L2).map(v => Math.round(v * 32768))).toEqual([3, 9]);
  });
});
```

`web/tests/audio/resample.test.ts`:
```ts
import { Resampler } from '../../src/audio/engine/resample';

function feeder(f: (i: number) => number) {
  let i = 0;
  return (l: Float32Array, r: Float32Array, n: number) => { for (let k = 0; k < n; k++, i++) { l[k] = f(i); r[k] = -f(i); } };
}

describe('Resampler 32 kHz → contexto', () => {
  it('mesma taxa: saída = entrada atrasada 3 amostras', () => {
    const rs = new Resampler(32000, 32000);
    const L = new Float32Array(10), R = new Float32Array(10);
    rs.process(L, R, 10, feeder(i => i + 1));
    expect(Array.from(L)).toEqual([0, 0, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(Array.from(R)).toEqual([-0, -0, -0, -1, -2, -3, -4, -5, -6, -7].map(v => v || 0));
  });
  it('48 kHz: 1 s de saída consome 1 s de entrada e preserva a frequência de 1 kHz', () => {
    const rs = new Resampler(32000, 48000);
    const L = new Float32Array(128), R = new Float32Array(128);
    const fill = feeder(i => Math.sin((2 * Math.PI * 1000 * i) / 32000));
    let zc = 0, prev = 0, tot = 0;
    for (let b = 0; b < 375; b++) {
      rs.process(L, R, 128, fill);
      for (let k = 0; k < 128; k++, tot++) { if (tot > 3 && (prev < 0) !== (L[k] < 0)) zc++; prev = L[k]; }
    }
    expect(tot).toBe(48000);
    expect(Math.abs(rs.consumed - 32000)).toBeLessThanOrEqual(2);
    expect(Math.abs(zc - 2000)).toBeLessThanOrEqual(2);
  });
  it('44,1 kHz: DC continua DC', () => {
    const rs = new Resampler(32000, 44100);
    const L = new Float32Array(100), R = new Float32Array(100);
    rs.process(L, R, 100, feeder(() => 0.5));
    for (let i = 8; i < 100; i++) { expect(L[i]).toBeCloseTo(0.5, 6); expect(R[i]).toBeCloseTo(-0.5, 6); }
  });
});
```

Run: `cd web && npx vitest run tests/audio/ring.test.ts tests/audio/resample.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar `web/src/audio/engine/ring.ts`**

```ts
/** Fila circular de quadros estéreo int16 (saída do DSP a 32 kHz). */
export interface SampleSink { push(l: number, r: number): void }

export class SampleRing implements SampleSink {
  private readonly buf: Int16Array;
  private readonly cap: number;
  private head = 0;                 // próximo quadro a ler
  private count = 0;
  dropped = 0;                      // quadros descartados por falta de espaço
  constructor(capacityFrames: number) { this.cap = capacityFrames; this.buf = new Int16Array(capacityFrames * 2); }
  get size(): number { return this.count; }
  push(l: number, r: number): void {
    if (this.count === this.cap) { this.dropped++; return; }
    const i = ((this.head + this.count) % this.cap) * 2;
    this.buf[i] = l; this.buf[i + 1] = r;
    this.count++;
  }
  /** Tira até `n` quadros para outL/outR[off..] como float (−1..1). Devolve quantos tirou. */
  shift(outL: Float32Array, outR: Float32Array, off: number, n: number): number {
    const m = Math.min(n, this.count);
    for (let k = 0; k < m; k++) {
      const i = this.head * 2;
      outL[off + k] = this.buf[i] / 32768; outR[off + k] = this.buf[i + 1] / 32768;
      this.head = (this.head + 1) % this.cap;
    }
    this.count -= m;
    return m;
  }
  clear(): void { this.head = 0; this.count = 0; }
}
```

- [ ] **Step 3: Implementar `web/src/audio/engine/resample.ts`**

```ts
/**
 * Reamostragem 32 kHz → taxa do AudioContext (Hermite cúbica, 4 pontos), só usada quando o navegador
 * não aceita `new AudioContext({ sampleRate: 32000 })`. Latência fixa de 2 amostras de entrada.
 */
export type Fill = (l: Float32Array, r: Float32Array, n: number) => void;

const BLOCK = 256;

export class Resampler {
  private readonly step: number;
  private pos = 0;
  private readonly hl = new Float32Array(4);
  private readonly hr = new Float32Array(4);
  private readonly bl = new Float32Array(BLOCK);
  private readonly br = new Float32Array(BLOCK);
  private bi = BLOCK;
  consumed = 0;                                  // amostras de entrada consumidas
  constructor(inRate: number, outRate: number) { this.step = inRate / outRate; }

  process(outL: Float32Array, outR: Float32Array, n: number, fill: Fill): void {
    const hl = this.hl, hr = this.hr;
    for (let i = 0; i < n; i++) {
      while (this.pos >= 1) {
        this.pos -= 1;
        if (this.bi === BLOCK) { fill(this.bl, this.br, BLOCK); this.bi = 0; }
        hl[0] = hl[1]; hl[1] = hl[2]; hl[2] = hl[3]; hl[3] = this.bl[this.bi];
        hr[0] = hr[1]; hr[1] = hr[2]; hr[2] = hr[3]; hr[3] = this.br[this.bi];
        this.bi++; this.consumed++;
      }
      outL[i] = hermite(this.pos, hl[0], hl[1], hl[2], hl[3]);
      outR[i] = hermite(this.pos, hr[0], hr[1], hr[2], hr[3]);
      this.pos += this.step;
    }
  }
}

function hermite(t: number, a: number, b: number, c: number, d: number): number {
  const m0 = (c - a) * 0.5, m1 = (d - b) * 0.5;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * b + (t3 - 2 * t2 + t) * m0 + (t3 - t2) * m1 + (-2 * t3 + 3 * t2) * c;
}
```

- [ ] **Step 4: Rodar**

Run: `cd web && npx vitest run tests/audio/ring.test.ts tests/audio/resample.test.ts && npx tsc --noEmit`
Expected: 5 testes PASS.

- [ ] **Step 5: Commit**

```sh
cd web && git add src/audio/engine/ring.ts src/audio/engine/resample.ts tests/audio/ring.test.ts tests/audio/resample.test.ts
git commit -m "feat(audio): fila de quadros int16 e reamostragem Hermite 32 kHz → contexto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Onda 2 (depois da onda 1; ainda sem os planos 5 e 6)

### Task 2: SPC700 (SMP) em TypeScript

**Onda 2. Depende de T1 (fixtures). Não depende dos planos 5 e 6.**

**Possui:**
- `web/src/audio/apu/smp.ts`
- `web/src/audio/apu/smp-ops.ts`
- `web/src/audio/apu/ipl.ts`
- `web/tests/audio/smp.test.ts`
- `web/tests/audio/prog.ts`

**Interfaces:**
- Produz: `DspBus`, `BusKind`, `FLAG`, `Smp` (contrato no topo do plano) e `IPL_ROM`.
- Produz (testes): `runProg(smp, img, steps)` e `ProgResult`.

**Fontes:** documentação do hardware (fullsnes "SNES APU SPC700 CPU", manual oficial do SPC700). **Não** copiar código do snes9x/bapu, do snes_spc nem do higan. A ordem dos acessos de cada opcode é um **fato medido** e já está no fixture `audio-smp-bus.json`, que é o gabarito.

**Regras do modelo** (são as da referência; o núcleo abaixo já as implementa):
- **Tempo por acesso.** Cada acesso é 1 ciclo: leitura, escrita, *push*/*pop* ou ciclo interno. O ciclo avança antes do acesso: timers +1, `cycles++`, `dspPending++`. O `onBus` recebe o ciclo já contado.
- **Leitura.**
  - `$00F0–$00FF`: MMIO.
  - `$FFC0–$FFFF` com o IPL ligado: `IPL_ROM`.
  - O resto: RAM.
- **Escrita.** MMIO, e **sempre** também a RAM.
- **Pilha.** Página 1, sem MMIO nem IPL. *Push*: grava em `$100|sp` e depois `sp--`. *Pop*: `sp++` e depois lê.
- **Leituras de MMIO.**
  - `$F2`: endereço do DSP.
  - `$F3`: sincroniza o DSP e lê o registrador `dspAddr & $7F`.
  - `$F4–$F7`: `cpuIn`.
  - `$F8/$F9`: RAM auxiliar.
  - `$FD–$FF`: contador de 4 bits do timer, que é zerado na leitura. Isso vale também para a **leitura fantasma** das instruções de escrita (`MOV dp,#imm`, `MOV dp,A` etc.; está no gabarito).
  - `$F0`, `$F1` e `$FA–$FC`: devolvem 0.
- **Escritas em MMIO.**
  - `$F1`:
    - bit 7 liga o IPL;
    - bit 5 zera `cpuIn[2..3]`;
    - bit 4 zera `cpuIn[0..1]`;
    - bits 0–2 ligam os timers. Ligar um timer desligado zera os estágios 2 e 3; o estágio 1 continua contando.
  - `$F2`: endereço do DSP.
  - `$F3`: se `dspAddr < $80`, sincroniza e escreve no DSP.
  - `$F8/$F9`: RAM auxiliar.
  - `$FA–$FC`: alvos dos timers.
  - `$F0`: ignorado.
- **Timers.**
  - Estágio 1 conta ciclos até 128 (T0, T1) ou 16 (T2), sempre, mesmo com o timer desligado.
  - Com o timer ligado, cada volta incrementa o estágio 2 (8 bits). Quando ele iguala o alvo (0 = 256), volta a 0 e o estágio 3 (4 bits) sobe 1.
- **`power()`.**
  - RAM e `cpuIn` zeradas;
  - `pc = $FFC0`, `sp = $EF`, `a = x = y = 0`, `psw = $02`;
  - IPL ligado, timers desligados, alvos 0, contadores 0.
- **`run(n)`.** `clock -= n`; enquanto `clock < 0`, executa uma instrução inteira e soma os ciclos dela ao `clock`. No fim sincroniza o DSP. O excedente passa para a próxima chamada.
- **SLEEP (`$EF`) e STOP (`$FF`).** Busca, 2 ciclos internos e `pc--`: repete para sempre, 3 ciclos por volta.

**Semântica das instruções.** Flags: N `$80`, V `$40`, P `$20`, B `$10`, H `$08`, I `$04`, Z `$02`, C `$01`.
- **dp.** `(psw & P ? $100 : 0) | (end & $FF)`. Toda soma de índice em dp dá a volta na página: `dp+X`, `dp+Y`, o 2º byte de `[dp]`, `MOVW` e `INCW`.
- **abs+X/Y e `[dp]+Y`.** Somam em 16 bits (`& $FFFF`). `JMP [!abs+X]` lê o ponteiro em `abs+X` e `abs+X+1` (16 bits).
- **Bit de memória (`m.b`).** Palavra `w` = byte baixo | byte alto << 8. Endereço = `w & $1FFF`, bit = `w >> 13`. Opcodes: OR1 `$0A/$2A`, AND1 `$4A/$6A`, EOR1 `$8A`, MOV1 `$AA/$CA`, NOT1 `$EA`.
- **ADC.** `r = a + b + C`. `C = r > $FF`. `H = ((a ^ b ^ r) & $10) ≠ 0`. `V = (~(a ^ b) & (a ^ r) & $80) ≠ 0`. N e Z do resultado de 8 bits.
- **SBC** é `ADC(a, ~b & $FF)`.
- **CMP.** `r = a − b`. `C = r ≥ 0`. N e Z de `r & $FF`.
- **ADDW YA,dp.** Zera C; `lo = ADC(A, m)`; `hi = ADC(Y, m+1)`. N, V, H e C vêm do byte alto; Z vem do resultado de 16 bits.
- **SUBW** faz o mesmo com C = 1 e SBC.
- **CMPW.** `r = YA − w`. `C = r ≥ 0`. N e Z de 16 bits. Não mexe em V nem em H.
- **INCW/DECW.** N e Z de 16 bits.
- **MUL YA.** `YA = Y·A`. N e Z do **Y**.
- **DIV YA,X.**
  - `H = (Y & 15) ≥ (X & 15)` e `V = Y ≥ X`;
  - se `Y < 2X`: `A = YA / X` e `Y = YA % X`;
  - senão: `A = 255 − (YA − (X << 9)) / (256 − X)` e `Y = X + (YA − (X << 9)) % (256 − X)`, com divisão inteira;
  - N e Z de A.
- **DAA.** Se `C` ou `A > $99`: `A += $60` e `C = 1`. Se `H` ou `(A & 15) > 9`: `A += 6`. Depois `A &= $FF` e N, Z.
- **DAS.** Se `!C` ou `A > $99`: `A −= $60` e `C = 0`. Se `!H` ou `(A & 15) > 9`: `A −= 6`. Depois `A &= $FF` e N, Z.
- **XCN.** Troca os nibbles; N, Z.
- **TSET1/TCLR1 !abs.** Lê `m`; N e Z de `(A − m) & $FF`; grava `m | A` ou `m & ~A`.
- **CLRV** zera V e H. **NOTC** inverte C. **EI/DI** mexem no I. **SETP/CLRP** mexem no P.
- **MOV com flags e sem flags.**
  - MOV para registrador, `MOV X,SP` e `MOV A,(X)+` mudam N e Z.
  - `MOV SP,X`, as escritas em memória, `MOVW dp,YA` e `MOV (X)+,A` não mudam flags.
  - `MOVW YA,dp` muda N e Z em 16 bits.
- **POP PSW e RETI.** Restauram todos os flags. RETI tira PSW, PC baixo e PC alto, nessa ordem.
- **BRK.** Empilha PC alto, PC baixo e PSW; `B = 1`, `I = 0`; `PC = [$FFDE]`.
- **TCALL n.** Lê o vetor em `$FFDE − 2n`, empilha o PC e salta.
- **PCALL u.** `PC = $FF00 | u`.
- **CALL.** Empilha o PC depois do operando.
- **Desvios.** Destino = PC depois dos operandos + deslocamento com sinal. Tomado custa +2 ciclos internos.
- **CBNE, DBNZ e BBS/BBC.** Leem os operandos na ordem do gabarito. `DBNZ dp` grava antes de ler o deslocamento.

**Ordem dos acessos por família.** Extraída do gabarito (P = leitura em PC, D = dp, A = endereço efetivo, S = pilha, i = interno, R/W = leitura/escrita). **O gabarito prevalece.**
- **Leituras.**
  - `#imm` P P;
  - `dp` P P D;
  - `dp+X` P P i D;
  - `!abs` P P P A;
  - `!abs+X/Y` P P P i A;
  - `(X)` P i D;
  - `[dp+X]` P P i D D A;
  - `[dp]+Y` P P i D D A;
  - `MOV A,(X)+` P i D i;
  - `MOVW YA,dp`, `ADDW` e `SUBW` P P D i D;
  - `CMPW` P P D D.
- **Operações dp,dp / dp,#imm / (X),(Y).**
  - OR/AND/EOR/ADC/SBC: P P D P D W;
  - `dp,#imm`: P P P D W;
  - `(X),(Y)`: P i D D W.
  - Nas versões com CMP, o W vira i.
- **Leitura-modificação-escrita.**
  - `dp` P P D W;
  - `dp+X` P P i D W;
  - `!abs` P P P A W;
  - `INCW`/`DECW` P P D W D W;
  - `SET1`/`CLR1` P P D W;
  - `TSET1`/`TCLR1` P P P A A W;
  - `NOT1` P P P A W;
  - `MOV1 m.b,C` P P P A i W.
- **Escritas.**
  - `MOV dp,reg` P P D(fantasma) W;
  - `MOV dp+X,A` P P i D W;
  - `MOV !abs,reg` P P P A(fantasma) W;
  - `MOV !abs+X/Y,A` P P P i A W;
  - `MOV (X),A` P i D W;
  - `MOV (X)+,A` P i i W;
  - `MOV [dp+X],A` P P i D D A W;
  - `MOV [dp]+Y,A` P P D D i A W;
  - `MOV dp,dp` P P D P W (sem fantasma);
  - `MOV dp,#imm` P P P D W;
  - `MOVW dp,YA` P P D W W.
- **Fluxo.**
  - `BRA` P P i i;
  - `Bcc` P P (+i i);
  - `BBS`/`BBC` P P D P i (+i i);
  - `CBNE dp` P P D P i (+i i);
  - `CBNE dp+X` P P i D P i (+i i);
  - `DBNZ dp` P P D W P (+i i);
  - `DBNZ Y` P P i i (+i i);
  - `JMP !abs` P P P;
  - `JMP [!abs+X]` P P P i A A;
  - `CALL` P P P i i i S S;
  - `PCALL` P P i i S S;
  - `TCALL` P A A i i i S S;
  - `BRK` P A A i i S S S;
  - `RET` P S S i i;
  - `RETI` P S S S i i;
  - `PUSH` P i i S;
  - `POP` P i i S.
- **Registradores.**
  - `NOP`, `MOV` entre registradores, `INC`/`DEC` de registrador, `CLRC`, `SETC`, `CLRP`, `SETP` e `CLRV`: P i;
  - `EI`, `DI`, `NOTC`, `DAA` e `DAS`: P i i;
  - `XCN`: P i i i i;
  - `MUL`: P + 8 i;
  - `DIV`: P + 11 i;
  - `OR1`/`EOR1`: P P P A i;
  - `AND1`/`MOV1 C,m.b`: P P P A.

- [ ] **Step 1: Escrever o teste `web/tests/audio/smp.test.ts` e o ajudante `web/tests/audio/prog.ts`**

`web/tests/audio/prog.ts`:
```ts
/** Roda um programa sintético (modo `prog` do spctrace) e resume o log de MMIO. */
import type { Smp } from '../../src/audio/apu/smp';
import { mmioBytes, sha1 } from './node';

export interface ProgResult {
  mmioCount: number; mmioSha1: string; ramSha1: string;
  regs: { pc: number; a: number; x: number; y: number; sp: number; psw: number; cycles: number };
}

/** O SMP já deve estar ligado ao DSP certo; `power()` é chamado aqui. A cada passo k: portas 0/1/2 = k, 7k, k>>1; run(1000). */
export function runProg(s: Smp, img: Uint8Array, steps: number): ProgResult {
  s.power();
  s.ram.set(img);
  s.pc = 0x0200;
  const log: number[] = [];
  s.onBus = (k, addr, data, cycle) => {
    if (k !== 3 && (addr & 0xfff0) === 0x00f0) log.push(cycle, k === 1 ? 0x72 : 0x77, addr & 0xff, data);
  };
  for (let k = 0; k < steps; k++) {
    s.writePort(0, k & 0xff); s.writePort(1, (k * 7) & 0xff); s.writePort(2, (k >> 1) & 0xff);
    s.run(1000);
  }
  s.onBus = null;
  const mmio = mmioBytes(log);
  return {
    mmioCount: mmio.length / 8, mmioSha1: sha1(mmio), ramSha1: sha1(s.ram),
    regs: { pc: s.pc, a: s.a, x: s.x, y: s.y, sp: s.sp, psw: s.psw, cycles: s.cycles },
  };
}
```

`web/tests/audio/smp.test.ts`:
```ts
import { Smp, type DspBus } from '../../src/audio/apu/smp';
import { IPL_ROM } from '../../src/audio/apu/ipl';
import { CASES_PER_OP, PROG_STEPS, progTimers, smpCaseImage, smpCases } from './gen/inputs';
import { fixture, sha1 } from './node';
import { runProg, type ProgResult } from './prog';

/** DSP de mentira: guarda registradores (o SMP só precisa de read/write/run nestes testes). */
function stubDsp(): DspBus {
  const regs = new Uint8Array(128);
  return { run() {}, read: a => regs[a & 0x7f], write: (a, v) => { regs[a & 0x7f] = v; } };
}
const makeSmp = () => new Smp(new Uint8Array(0x10000), stubDsp());
const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, '0');

describe('SMP: estado do power-on e IPL', () => {
  it('registradores, IPL mapeado em $FFC0 e RAM zerada', () => {
    const s = makeSmp();
    s.ram.fill(0x77);
    s.power();
    expect([s.pc, s.a, s.x, s.y, s.sp, s.psw, s.iplEnabled, s.cycles]).toEqual([0xffc0, 0, 0, 0, 0xef, 0x02, true, 0]);
    expect(s.ram.every(v => v === 0)).toBe(true);
    expect(IPL_ROM).toHaveLength(64);
    expect(Array.from(IPL_ROM.subarray(0, 4))).toEqual([0xcd, 0xef, 0xbd, 0xe8]);
    expect(Array.from(IPL_ROM.subarray(60))).toEqual([0x00, 0x00, 0xc0, 0xff]);   // vetor de reset = $FFC0
  });
  it('o IPL sozinho escreve $AA/$BB nas portas e espera o $CC', () => {
    const s = makeSmp();
    s.power();
    s.run(3000);                     // zera a página 0 (≈ 2.390 ciclos) e publica $AA/$BB
    expect([s.readPort(0), s.readPort(1)]).toEqual([0xaa, 0xbb]);
    expect(s.pc).toBeGreaterThanOrEqual(0xffcf);
    expect(s.pc).toBeLessThanOrEqual(0xffd3);
  });
});

describe('SMP: padrão de barramento de cada opcode = referência', () => {
  const fx = fixture<{ psw00: string[]; pswFF: string[] }>('audio-smp-bus.json');
  for (const [psw, lines] of [[0x00, fx.psw00], [0xff, fx.pswFF]] as const) {
    it(`PSW $${hex(psw, 2)}`, () => {
      const got: string[] = [];
      const s = makeSmp();
      for (let op = 0; op < 256; op++) {
        if (op === 0xef || op === 0xff) continue;
        s.power(); s.iplEnabled = false;
        const R = s.ram;
        R.fill(0x55, 0x200);
        for (let i = 0; i < 0xf0; i++) R[i] = 0x30 + (i & 0x0f);
        R[0x40] = 0x34; R[0x41] = 0x12; R[0x50] = 0x78; R[0x51] = 0x56;
        R[0x400] = op; R[0x401] = 0x40; R[0x402] = 0x12;
        s.pc = 0x400; s.x = 0x10; s.y = 0x20; s.a = 0x05; s.sp = 0xef; s.psw = psw;
        let pat = '';
        s.onBus = (k, addr) => { pat += k === 3 ? ' i' : ` ${k === 1 ? 'r' : 'w'}${hex(addr, 4)}`; };
        const c0 = s.cycles;
        s.step();
        s.onBus = null;
        got.push(`${hex(op, 2)} ${String(s.cycles - c0).padStart(2)}${pat}`);
      }
      expect(got).toEqual(lines);
    });
  }
});

describe('SMP: 4.064 casos de 1 instrução = referência (registradores, flags, ciclos, barramento)', () => {
  it('todos os opcodes', () => {
    const fx = fixture<{ total: number; perOp: Record<string, string> }>('audio-smp-cases.json');
    const img = smpCaseImage();
    const cases = smpCases();
    expect(cases.length).toBe(fx.total);
    const s = makeSmp();
    const bad: string[] = [];
    for (let i = 0; i < cases.length; i += CASES_PER_OP) {
      const rec = new Uint8Array(12 * CASES_PER_OP);
      for (let k = 0; k < CASES_PER_OP; k++) {
        const c = cases[i + k];
        s.power(); s.iplEnabled = false; s.ram.set(img);
        s.ram[c.pc] = c.op; s.ram[(c.pc + 1) & 0xffff] = c.b1; s.ram[(c.pc + 2) & 0xffff] = c.b2;
        s.pc = c.pc; s.a = c.a; s.x = c.x; s.y = c.y; s.sp = c.sp; s.psw = c.psw;
        let h = 0x811c9dc5;
        const fnv = (b: number) => { h = Math.imul(h ^ b, 16777619) >>> 0; };
        s.onBus = (kind, addr, data) => { fnv(kind); fnv(addr & 0xff); fnv(addr >> 8); fnv(data); };
        const c0 = s.cycles;
        s.step();
        s.onBus = null;
        rec.set([s.pc & 0xff, s.pc >> 8, s.a, s.x, s.y, s.sp, s.psw, s.cycles - c0,
          h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff, h >>> 24], k * 12);
      }
      const key = hex(cases[i].op, 2);
      if (sha1(rec) !== fx.perOp[key]) bad.push(key);
    }
    expect(bad).toEqual([]);
  });
});

describe('SMP: programa de timers, leituras fantasmas e portas (200.000 ciclos)', () => {
  it('log de MMIO, RAM e registradores = referência', () => {
    const fx = fixture<{ steps: number; progs: Record<string, ProgResult> }>('audio-prog.json');
    const got = runProg(makeSmp(), progTimers(), PROG_STEPS);
    const want = fx.progs.timers;
    expect(got.regs).toEqual(want.regs);
    expect(got.mmioCount).toBe(want.mmioCount);
    expect(got.mmioSha1).toBe(want.mmioSha1);
    expect(got.ramSha1).toBe(want.ramSha1);
  });
});
```

Run: `cd web && npx vitest run tests/audio/smp.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Criar `web/src/audio/apu/ipl.ts`**

```ts
/**
 * ROM de boot (IPL) de 64 bytes do S-SMP, mapeada em $FFC0–$FFFF enquanto $F1.7 = 1.
 * É firmware do HARDWARE do SNES (documentado byte a byte na fullsnes), não é dado da ROM do jogo.
 */
export const IPL_ROM = new Uint8Array([
  0xcd, 0xef, 0xbd, 0xe8, 0x00, 0xc6, 0x1d, 0xd0, 0xfc, 0x8f, 0xaa, 0xf4, 0x8f, 0xbb, 0xf5, 0x78,
  0xcc, 0xf4, 0xd0, 0xfb, 0x2f, 0x19, 0xeb, 0xf4, 0xd0, 0xfc, 0x7e, 0xf4, 0xd0, 0x0b, 0xe4, 0xf5,
  0xcb, 0xf4, 0xd7, 0x00, 0xfc, 0xd0, 0xf3, 0xab, 0x01, 0x10, 0xef, 0x7e, 0xf4, 0x10, 0xeb, 0xba,
  0xf6, 0xda, 0x00, 0xba, 0xf4, 0xc4, 0xf4, 0xdd, 0x5d, 0xd0, 0xdb, 0x1f, 0x00, 0x00, 0xc0, 0xff,
]);
```

- [ ] **Step 3: Criar o núcleo `web/src/audio/apu/smp.ts` (bus, MMIO, timers e execução; completo)**

```ts
/**
 * SPC700 do SNES (S-SMP): CPU, timers, portas e IPL. Código do Crown Blast, escrito a partir da
 * documentação do hardware e validado ciclo a ciclo contra a referência (tests/audio/smp.test.ts).
 * Modelo de tempo: cada acesso ao barramento (leitura, escrita ou ciclo interno) é 1 ciclo; o ciclo
 * "anda" (timers, contador, DSP pendente) ANTES do acesso. Instruções são atômicas.
 */
import { IPL_ROM } from './ipl';
import { execute } from './smp-ops';

export interface DspBus { run(clocks: number): void; read(addr: number): number; write(addr: number, v: number): void }
export type BusKind = 1 | 2 | 3;

export const FLAG = { C: 0x01, Z: 0x02, I: 0x04, H: 0x08, B: 0x10, P: 0x20, V: 0x40, N: 0x80 } as const;
const TIMER_FREQ = [128, 128, 16];

export class Smp {
  readonly ram: Uint8Array;
  readonly cpuIn = new Uint8Array(4);          // CPU→SPC (escritas da CPU em $2140–3)
  private readonly dsp: DspBus;
  pc = 0xffc0; a = 0; x = 0; y = 0; sp = 0xef; psw = 0x02;
  iplEnabled = true;
  dspAddr = 0; f8 = 0; f9 = 0;
  private readonly tEnable = [false, false, false];
  private readonly tTarget = [0, 0, 0];
  private readonly tStage1 = [0, 0, 0];
  private readonly tStage2 = [0, 0, 0];
  private readonly tStage3 = [0, 0, 0];
  clock = 0;                                   // saldo: negativo = ciclos ainda a executar
  cycles = 0;                                  // ciclos desde o power()
  private dspPending = 0;
  onBus: ((kind: BusKind, addr: number, data: number, cycle: number) => void) | null = null;

  constructor(ram: Uint8Array, dsp: DspBus) { this.ram = ram; this.dsp = dsp; }

  power(): void {
    this.ram.fill(0); this.cpuIn.fill(0);
    this.pc = 0xffc0; this.a = 0; this.x = 0; this.y = 0; this.sp = 0xef; this.psw = 0x02;
    this.iplEnabled = true; this.dspAddr = 0; this.f8 = 0; this.f9 = 0;
    for (let t = 0; t < 3; t++) { this.tEnable[t] = false; this.tTarget[t] = 0; this.tStage1[t] = 0; this.tStage2[t] = 0; this.tStage3[t] = 0; }
    this.clock = 0; this.cycles = 0; this.dspPending = 0;
  }

  // ---- portas vistas pela CPU
  readPort(p: number): number { return this.ram[0xf4 + (p & 3)]; }
  writePort(p: number, v: number): void { this.cpuIn[p & 3] = v & 0xff; }

  // ---- execução
  run(cycles: number): void {
    this.clock -= cycles;
    while (this.clock < 0) { const c0 = this.cycles; this.step(); this.clock += this.cycles - c0; }
    this.syncDsp();
  }
  /** Executa exatamente uma instrução. */
  step(): void {
    const op = this.read(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    execute(this, op);
  }
  syncDsp(): void { if (this.dspPending) { this.dsp.run(this.dspPending); this.dspPending = 0; } }

  // ---- barramento (usado por smp-ops.ts)
  private tick(): void {
    for (let t = 0; t < 3; t++) {
      if (++this.tStage1[t] < TIMER_FREQ[t]) continue;
      this.tStage1[t] = 0;
      if (!this.tEnable[t]) continue;
      this.tStage2[t] = (this.tStage2[t] + 1) & 0xff;
      if (this.tStage2[t] !== this.tTarget[t]) continue;     // alvo 0 = 256
      this.tStage2[t] = 0;
      this.tStage3[t] = (this.tStage3[t] + 1) & 15;
    }
    this.cycles++;
    this.dspPending++;
  }
  idle(): void { this.tick(); this.onBus?.(3, 0, 0, this.cycles); }
  read(addr: number): number {
    this.tick();
    let v: number;
    if ((addr & 0xfff0) === 0x00f0) v = this.mmioRead(addr);
    else if (addr >= 0xffc0 && this.iplEnabled) v = IPL_ROM[addr & 0x3f];
    else v = this.ram[addr];
    this.onBus?.(1, addr, v, this.cycles);
    return v;
  }
  write(addr: number, v: number): void {
    this.tick();
    this.onBus?.(2, addr, v, this.cycles);
    if ((addr & 0xfff0) === 0x00f0) this.mmioWrite(addr, v);
    this.ram[addr] = v;                          // toda escrita vai para a RAM, inclusive MMIO
  }
  push(v: number): void {
    this.tick();
    const addr = 0x100 | this.sp;
    this.onBus?.(2, addr, v, this.cycles);
    this.ram[addr] = v; this.sp = (this.sp - 1) & 0xff;
  }
  pop(): number {
    this.tick();
    this.sp = (this.sp + 1) & 0xff;
    const addr = 0x100 | this.sp, v = this.ram[addr];
    this.onBus?.(1, addr, v, this.cycles);
    return v;
  }

  private mmioRead(addr: number): number {
    switch (addr) {
      case 0xf2: return this.dspAddr;
      case 0xf3: this.syncDsp(); return this.dsp.read(this.dspAddr & 0x7f);
      case 0xf4: case 0xf5: case 0xf6: case 0xf7: return this.cpuIn[addr & 3];
      case 0xf8: return this.f8;
      case 0xf9: return this.f9;
      case 0xfd: case 0xfe: case 0xff: {
        const t = addr - 0xfd, v = this.tStage3[t] & 15;
        this.tStage3[t] = 0;
        return v;
      }
      default: return 0;                         // $F0, $F1, $FA–$FC
    }
  }
  private mmioWrite(addr: number, v: number): void {
    switch (addr) {
      case 0xf1:
        this.iplEnabled = (v & 0x80) !== 0;
        if (v & 0x20) { this.cpuIn[2] = 0; this.cpuIn[3] = 0; }
        if (v & 0x10) { this.cpuIn[0] = 0; this.cpuIn[1] = 0; }
        for (let t = 2; t >= 0; t--) {
          const on = (v & (1 << t)) !== 0;
          if (!this.tEnable[t] && on) { this.tStage2[t] = 0; this.tStage3[t] = 0; }
          this.tEnable[t] = on;
        }
        break;
      case 0xf2: this.dspAddr = v; break;
      case 0xf3: if (!(this.dspAddr & 0x80)) { this.syncDsp(); this.dsp.write(this.dspAddr, v); } break;
      case 0xf8: this.f8 = v; break;
      case 0xf9: this.f9 = v; break;
      case 0xfa: case 0xfb: case 0xfc: this.tTarget[addr - 0xfa] = v; break;
      default: break;                            // $F0 (TEST) ignorado; $F4–$F7 já vão para a RAM
    }
  }
}
```

- [ ] **Step 4: Implementar os 256 opcodes em `web/src/audio/apu/smp-ops.ts`**

Assinatura: `export function execute(s: Smp, op: number): void`, chamada com o opcode já buscado e o `pc` já incrementado.

Estrutura sugerida:
- ajudantes de busca: `pcByte(s)` = `s.read(s.pc)` + `pc++`;
- ajudantes de endereço: `dpAddr(s, a)` = `(s.psw & FLAG.P ? 0x100 : 0) | (a & 0xff)`;
- ajudantes de flags: `nz8`, `nz16`, `adc`, `sbc`, `cmp`, `asl`, `lsr`, `rol`, `ror`, `inc`, `dec`;
- ajudantes de família, que chamam `s.read/s.write/s.idle/s.push/s.pop` **na ordem do gabarito**, ligados a um `switch (op)` com os 256 casos.

Exemplos, na forma esperada:

```ts
case 0xe4: { const d = pcByte(s); s.a = s.read(dpAddr(s, d)); nz8(s, s.a); break; }            // MOV A,dp: P P D
case 0xc4: { const d = pcByte(s); const a = dpAddr(s, d); s.read(a); s.write(a, s.a); break; }  // MOV dp,A: P P D(fantasma) W
case 0x8f: { const i = pcByte(s); const d = pcByte(s); const a = dpAddr(s, d); s.read(a); s.write(a, i); break; } // MOV dp,#imm
case 0xfa: { const sd = pcByte(s); const v = s.read(dpAddr(s, sd)); const dd = pcByte(s); s.write(dpAddr(s, dd), v); break; } // MOV dp,dp
case 0xd0: { const r = pcByte(s); if (!(s.psw & FLAG.Z)) { s.idle(); s.idle(); s.pc = (s.pc + ((r << 24) >> 24)) & 0xffff; } break; } // BNE
case 0xef: case 0xff: s.idle(); s.idle(); s.pc = (s.pc - 1) & 0xffff; break;                    // SLEEP/STOP
```

Método: implemente por família e rode `npx vitest run tests/audio/smp.test.ts` a cada família.
- O teste de padrão aponta, com diff, o opcode cuja ordem de acessos difere.
- O teste de casos lista os opcodes com registradores, flags ou ciclos errados.
- Para depurar um opcode da lista `bad`, gere a saída da referência para os 16 casos dele: rode `spctrace cases` com um `casos.bin` só daquele opcode (use `encodeCases` com `smpCases().filter(c => c.op === X)`) e compare registro a registro.

- [ ] **Step 5: Rodar tudo**

Run: `cd web && npx vitest run tests/audio/smp.test.ts && npx tsc --noEmit`
Expected: 6 testes PASS:
- power-on;
- IPL;
- padrão com PSW `$00`;
- padrão com PSW `$FF`;
- 4.064 casos;
- programa de timers.

- [ ] **Step 6: Commit**

```sh
cd web && git add src/audio/apu/smp.ts src/audio/apu/smp-ops.ts src/audio/apu/ipl.ts tests/audio/smp.test.ts tests/audio/prog.ts
git commit -m "feat(audio): SPC700 (S-SMP) em TS — barramento, timers, MMIO e 256 opcodes iguais à referência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: S-DSP: porte do `SPC_DSP` (módulo LGPL isolado)

**Onda 2. Depende de T1 (fixtures) e de `SampleSink` (T5). Não depende dos planos 5 e 6.**

**Possui:**
- `web/src/audio/apu/dsp/spc-dsp.ts`
- `web/src/audio/apu/dsp/tables.ts`
- `web/vendor/snes_spc/LICENSE`
- `web/vendor/snes_spc/NOTICE.txt`
- `web/vendor/snes_spc/SPC_DSP.cpp`
- `web/vendor/snes_spc/SPC_DSP.h`
- `web/tests/audio/dsp.test.ts`

**Interfaces:**
- Produz: `class SpcDsp implements DspBus`, com:
  - `constructor(ram: Uint8Array, out: SampleSink)`;
  - `reset()`;
  - `run(clocks)`;
  - `read(addr)`;
  - `write(addr, v)`.

**Fonte do porte:** `/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/rom-audio/snes9x/apu/bapu/dsp/SPC_DSP.cpp` e `SPC_DSP.h`. É o snes_spc 0.9.0 com as mudanças do snes9x (`external_regs`, `load()` que zera os registradores internos, `stereo_switch`). **É exatamente o que a referência usa.** Porte linha a linha, sem "melhorar" nada.

**Configuração fixa da referência** (spchost/spctrace):
- `Settings.InterpolationMethod = 2` (gaussiana; porte **só** o caso `default/2` de `interpolate`, sem as tabelas `cubic` e `sinc`);
- `SeparateEchoBuffer = false` (o eco usa a RAM);
- `stereo_switch = 0xFFFF`;
- `mute_mask = 0`;
- sem MSU1;
- sem *snapshot*.

A saída de cada amostra (`echo_27`, o `SPC_DSP_OUT_HOOK`) vira `this.out.push(l, r)`.

**Estrutura em TS:**
- `tables.ts`: `GAUSS` (Int16Array de 512), `COUNTER_RATES` e `COUNTER_OFFSETS` (32 cada) e `INITIAL_REGS` (128). São cópias literais das tabelas do arquivo.
- `SpcDsp`:
  - `regs` e `externalRegs` (Uint8Array de 128);
  - estado `m.*` como campos da classe;
  - `voices: Voice[8]`, com `buf` (Int32Array de 24), `bufPos`, `interpPos`, `brrAddr`, `brrOffset`, `base` (índice dos registradores da voz, `v*16`), `vbit`, `konDelay`, `envMode` (0 release, 1 attack, 2 decay, 3 sustain), `env`, `hiddenEnv`, `tEnvxOut` e `voiceNumber`;
  - `echoHist` (Int32Array de 32 = `[16][2]`) com `echoHistPos` como índice 0–7.
- `run(clocks)` reproduz o `switch` com *fall-through* de `GEN_DSP_TIMING`: um laço que, a cada clock, executa as ações da fase `m.phase` e avança `phase = (phase + 1) & 31`. Ações por fase, idênticas à macro: fase 0 `V5(0) V2(1)`; fase 1 `V6(0) V3(1)`; fases 2–16 os compostos `V7_V4_V1`, `V8_V5_V2` e `V9_V6_V3` das vozes 0–4; e assim por diante até a fase 31 `V4(0) V1(2)`. Os compostos: `V7_V4_V1(v)` = `V7(v) V1(v+3) V4(v+1)`, `V8_V5_V2(v)` = `V8(v) V5(v+1) V2(v+2)`, `V9_V6_V3(v)` = `V9(v) V6(v+1) V3(v+2)`, **nessa ordem**.
- `reset()` = `init()` + `load(INITIAL_REGS)`, como `DSP::power()`:
  - `externalRegs` = valores iniciais;
  - `regs` zerado, com `regs[66] = 1`, `regs[82] = 1` e `regs[FLG] = $E0`;
  - todo o estado interno zerado;
  - `brrOffset = 1`, `vbit = 1 << i` e `base = i*16` por voz;
  - `newKon = regs[KON]`, `tDir = regs[DIR]` e `tEsa = regs[ESA]`;
  - depois `softResetCommon()`: `noise = $4000`, `echoHistPos = 0`, `everyOtherSample = 1`, `echoOffset = 0`, `phase = 0`, `counter = 0`, `voiceNumber = i`.
- `read(addr)` devolve `externalRegs[addr]`.
- `write(addr, v)` grava em `regs` e em `externalRegs` e segue o `switch` de `SPC_DSP.h`:
  - ENVX e OUTX também vão para os *buffers*;
  - KON → `newKon`;
  - ENDX: zera `endxBuf` e `regs[ENDX]`, qualquer que seja o valor escrito.

**Armadilhas C → JS** (todas causam diferença no hash):
- `(int8_t) x` → `(x << 24) >> 24`; `(int16_t) x` → `(x << 16) >> 16`; `(unsigned) x > k` → `(x >>> 0) > k`.
- `CLAMP16(io)` → `if (((io << 16) >> 16) !== io) io = (io >> 31) ^ 0x7fff;`.
- `GET_LE16SA` = leitura de 16 bits com sinal. **Todo índice de RAM leva `& 0xffff`**, inclusive `ptr + 1` do eco e do DIR (no C, passar do fim é UB; o hardware dá a volta).
- `decode_brr`:
  - `(int16_t) nybbles >> 12` é aplicado a `nybbles` que cresce com `<<= 4`: use `((nybbles << 16) >> 16) >> 12`;
  - `s = (int16_t)(s * 2)` depois do `CLAMP16`;
  - a cópia dupla `pos[brr_buf_size] = pos[0]` usa `buf[bufPos + k]` e `buf[bufPos + k + 12]`;
  - `p1 = buf[idx + 11]` e `p2 = buf[idx + 10] >> 1`, com `idx` = posição da amostra.
- `interpolate`:
  - `in` = `buf[(interpPos >> 12) + bufPos + k]`;
  - `offset = (interpPos >> 4) & 0xff`;
  - `fwd = GAUSS[255 − offset + …]` e `rev = GAUSS[offset + …]`;
  - as 3 primeiras parcelas são somadas antes do corte `(int16_t)` e só depois entra a 4ª;
  - no fim, `CLAMP16` e `& ~1`.
- `read_counter(rate)` = `(counter + COUNTER_OFFSETS[rate]) % COUNTER_RATES[rate]`; `run_counters`: `if (--counter < 0) counter = 30720 − 1`.
- `m.t_output = (output * env) >> 11 & ~1` (o `>>` vem antes do `&`).
- Os `*_buf` e `t_envx_out` são `uint8_t`: grave `& 0xff`.
- **Ordem:** `V7`, `V8` e `V9` gravam em `regs` **e** em `externalRegs` (`REG`/`XREG`).
- `echo_22`: `echoHistPos = (echoHistPos + 1) & 7`. `ECHO_FIR(i)` = `echoHist[((pos + i) * 2) + ch]`. `echo_read` grava em `pos` e em `pos + 8`.
- `CALC_FIR(i, ch)` = `(echoHist[(pos + i + 1)*2 + ch] * int8(regs[FIR + i*16])) >> 6`.

**Aviso obrigatório** no topo de `spc-dsp.ts` e de `tables.ts`:
```ts
/*
 * Porte para TypeScript do SPC_DSP (snes_spc 0.9.0, http://www.slack.net/~ant/), na versão
 * modificada pelo snes9x (apu/bapu/dsp). Copyright (C) 2007 Shay Green; modificações do snes9x;
 * porte (C) 2026 Crown Blast. Este módulo é software livre: você pode redistribuí-lo e/ou modificá-lo
 * sob os termos da GNU Lesser General Public License, versão 2.1 ou (a seu critério) posterior.
 * Distribuído SEM NENHUMA GARANTIA. Veja web/vendor/snes_spc/LICENSE e NOTICE.txt.
 */
```

- [ ] **Step 1: Copiar a fonte correspondente e a licença para `web/vendor/snes_spc/`**

Run (em `web/`):
```sh
mkdir -p vendor/snes_spc
S="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores"
cp "$S/rom-audio/snes9x/apu/bapu/dsp/SPC_DSP.cpp" "$S/rom-audio/snes9x/apu/bapu/dsp/SPC_DSP.h" vendor/snes_spc/
cp "$S/snes9x-src/filter/snes_ntsc-license.txt" vendor/snes_spc/LICENSE
head -2 vendor/snes_spc/LICENSE
```
Expected: `GNU LESSER GENERAL PUBLIC LICENSE` / `Version 2.1, February 1999`.

Criar `web/vendor/snes_spc/NOTICE.txt`:
```
Crown Blast — módulo S-DSP (web/src/audio/apu/dsp/)

O arquivo web/src/audio/apu/dsp/spc-dsp.ts (e tables.ts) é um porte para TypeScript do
SPC_DSP do snes_spc 0.9.0 (Shay Green, http://www.slack.net/~ant/), na versão incluída no
snes9x (apu/bapu/dsp/SPC_DSP.cpp e SPC_DSP.h, copiados aqui como fonte correspondente).
Licença: GNU Lesser General Public License 2.1 ou posterior (arquivo LICENSE).

O módulo é carregado no chunk separado do AudioWorklet (assets/worklet-*.js). Para substituí-lo,
altere web/src/audio/apu/dsp/ e recompile com `npm run build`; a interface usada pelo resto do
jogo é só `SpcDsp` (reset, run, read, write) e `SampleSink.push(l, r)`.

Nada mais do snes_spc nem do snes9x é usado pelo jogo. O snes9x (licença não comercial) só é
usado fora do repositório, pela ferramenta de testes analise/investigacao/audio/spctrace.cpp.
```

- [ ] **Step 2: Escrever o teste `web/tests/audio/dsp.test.ts`**

```ts
import { SpcDsp } from '../../src/audio/apu/dsp/spc-dsp';
import { dspScenes } from './gen/inputs';
import { fixture, sha1 } from './node';

function render(sc: ReturnType<typeof dspScenes>[number]): Int16Array {
  const out: number[] = [];
  const dsp = new SpcDsp(sc.ram.slice(), { push: (l, r) => { out.push(l, r); } });
  dsp.reset();
  let now = 0;
  for (const w of sc.writes) {
    if (w.clock > now) dsp.run(w.clock - now);
    now = w.clock;
    dsp.write(w.reg, w.value);
  }
  if (sc.totalClocks > now) dsp.run(sc.totalClocks - now);
  return new Int16Array(out);
}

describe('DSP (porte do SPC_DSP): PCM bit a bit igual à referência', () => {
  const fx = fixture<{ scenes: Record<string, { frames: number; sha1: string; first: number[] }> }>('audio-dsp.json');
  for (const sc of dspScenes()) {
    it(sc.name, () => {
      const pcm = render(sc);
      const want = fx.scenes[sc.name];
      expect(pcm.length / 2).toBe(want.frames);
      const nz = pcm.findIndex(v => v !== 0);
      expect(Array.from(pcm.subarray(nz, nz + 8))).toEqual(want.first);
      expect(sha1(new Uint8Array(pcm.buffer))).toBe(want.sha1);
    });
  }
});

describe('DSP: registradores', () => {
  it('reset: a leitura devolve os valores iniciais do snes9x (initial_regs)', () => {
    const dsp = new SpcDsp(new Uint8Array(0x10000), { push() {} });
    dsp.reset();
    expect([dsp.read(0x00), dsp.read(0x01), dsp.read(0x0f)]).toEqual([0x45, 0x8b, 0x80]);
  });
  it('qualquer escrita em ENDX zera o registrador; KON guarda o valor', () => {
    const dsp = new SpcDsp(new Uint8Array(0x10000), { push() {} });
    dsp.reset();
    dsp.write(0x7c, 0xff);
    expect(dsp.read(0x7c)).toBe(0);
    dsp.write(0x4c, 0x81);
    expect(dsp.read(0x4c)).toBe(0x81);
  });
  it('32 ciclos = 1 quadro', () => {
    let n = 0;
    const dsp = new SpcDsp(new Uint8Array(0x10000), { push: () => { n++; } });
    dsp.reset();
    dsp.run(32 * 100);
    expect(n).toBe(100);
    dsp.run(16); dsp.run(16);
    expect(n).toBe(101);
  });
});
```

Run: `cd web && npx vitest run tests/audio/dsp.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Portar `tables.ts` e `spc-dsp.ts`**, seguindo a estrutura e as armadilhas acima.

- [ ] **Step 4: Rodar**

Run: `cd web && npx vitest run tests/audio/dsp.test.ts && npx tsc --noEmit`
Expected: 9 testes PASS (6 cenas bit a bit + 3 de registradores).

**Depuração:** se uma cena divergir, compare os 8 primeiros quadros não nulos (`first`) para achar o estágio, e depois o índice do 1º quadro diferente contra o `.pcm` da referência. Para gerar esse arquivo: `spctrace dsp <cena.bin> <saida.pcm>`, com `encodeScene(dspScenes()[i])` gravado por um script Node de 3 linhas no scratchpad.

- [ ] **Step 5: Commit**

```sh
cd web && git add src/audio/apu/dsp vendor/snes_spc tests/audio/dsp.test.ts
git commit -m "feat(audio): S-DSP — porte do SPC_DSP (snes_spc 0.9.0/snes9x, LGPL-2.1) bit a bit igual à referência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Motor em tempo real (host × APU × NMI × comandos)

**Onda 2. Depende de T4 e T5. Não depende dos planos 5 e 6.**

**Possui:**
- `web/src/audio/engine/engine.ts`
- `web/src/audio/engine/commands.ts`
- `web/tests/audio/engine.test.ts`
- `web/tests/audio/fake-apu.ts`

**Interfaces:**
- Produz: `AudioCmd`, `WorkletIn` e `WorkletOut` (`commands.ts`).
- Produz: `AudioEngine(img, bus, ring) { post(cmd), render(outL, outR, n, off?), stats, broken, host }`, `SAMPLE_CYCLES` = 32 e `SFX_FIFO` = 64.

**Regras** (código já rodado contra o driver falso):
- operações longas numa fila, uma de cada vez;
- NMI a cada 17.067 ciclos, só com o host livre; no máximo 1 pendente;
- SFX numa fila de 64, com no máximo 1 entregue por NMI;
- voz na hora (ignorada e contada se já houver outra);
- nada antes do fim do boot;
- uma exceção do host (`HostTimeout`) deixa o motor mudo (`broken`) em vez de derrubar o worklet.

- [ ] **Step 1: Escrever o APU falso e o teste**

`web/tests/audio/fake-apu.ts`:
```ts
import type { SampleRing } from '../../src/audio/engine/ring';
import { FakeDriver } from './fake-driver';

/** APU falso para o motor: o protocolo vem do FakeDriver; cada 32 ciclos geram 1 quadro (1000, −1000). */
export class FakeApu {
  readonly drv = new FakeDriver();
  private acc = 0;
  private readonly ring: SampleRing;
  constructor(ring: SampleRing) { this.ring = ring; }
  readPort(p: number): number { return this.drv.readPort(p); }
  writePort(p: number, v: number): void { this.drv.writePort(p, v); }
  run(c: number): void {
    this.drv.run(c);
    this.acc += c;
    while (this.acc >= 32) { this.acc -= 32; this.ring.push(1000, -1000); }
  }
}
```

`web/tests/audio/engine.test.ts`:
```ts
import { AudioEngine, SFX_FIFO } from '../../src/audio/engine/engine';
import { SampleRing } from '../../src/audio/engine/ring';
import { AudioImage } from '../../src/audio/host/image';
import { FRAME_CYCLES } from '../../src/audio/host/host';
import { FakeApu } from './fake-apu';
import { synthImage } from './gen/synth-image';

function setup() {
  const ring = new SampleRing(4096);
  const apu = new FakeApu(ring);
  const eng = new AudioEngine(new AudioImage(synthImage().slices), apu, ring);
  const L = new Float32Array(128), R = new Float32Array(128);
  const render = (blocks: number) => { for (let i = 0; i < blocks; i++) eng.render(L, R, 128); };
  return { ring, apu, eng, L, R, render };
}

describe('AudioEngine (tempo real)', () => {
  it('entrega exatamente os quadros pedidos e avança 32 ciclos por quadro', () => {
    const { apu, eng, L, render } = setup();
    render(250);                                   // 32.000 quadros = 1 s
    expect(eng.stats.frames).toBe(32000);
    expect(Math.abs(apu.drv.cycles - 1_024_000)).toBeLessThan(64);
    expect(L[0]).toBeCloseTo(1000 / 32768, 6);
  });

  it('sem boot não roda NMI nem comandos; SFX antes do boot é descartado', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'sfx', id: 3 });
    eng.post({ t: 'music', id: 0x14 });
    render(100);
    expect(apu.drv.cmds).toEqual([]);
    expect(eng.stats.nmis).toBe(0);
  });

  it('boot e música rodam em fila; depois o NMI roda a 60 Hz', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' }); eng.post({ t: 'music', id: 0x14 });
    render(50);
    expect(apu.drv.cmds).toEqual([0x01]);
    const n0 = eng.stats.nmis;
    render(250);                                   // +1 s
    expect(Math.abs(eng.stats.nmis - n0 - 1_024_000 / FRAME_CYCLES)).toBeLessThanOrEqual(1);
  });

  it('5 SFX no mesmo instante saem 1 por NMI, em ordem', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' });
    render(50);
    for (const id of [7, 8, 9, 10, 11]) eng.post({ t: 'sfx', id });
    const perNmi: number[] = [];
    let last = eng.stats.nmis;
    for (let i = 0; i < 200 && perNmi.length < 6; i++) {
      render(1);
      if (eng.stats.nmis !== last) { perNmi.push(apu.drv.cmds.length); last = eng.stats.nmis; }
    }
    expect(apu.drv.cmds).toEqual([0x39, 0x3a, 0x3b, 0x3c, 0x3d]);
    expect(perNmi.slice(0, 6)).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it('fila de SFX limitada a 64', () => {
    const { eng, render } = setup();
    eng.post({ t: 'boot' });
    render(50);
    for (let i = 0; i < SFX_FIFO + 3; i++) eng.post({ t: 'sfx', id: 1 });
    expect(eng.stats.droppedSfx).toBe(3);
  });

  it('voz com outra em andamento é ignorada e contada', () => {
    const { apu, eng, render } = setup();
    eng.post({ t: 'boot' });
    render(50);
    eng.post({ t: 'voice', id: 0x10 });
    eng.post({ t: 'voice', id: 0x06 });
    render(200);
    expect(eng.stats.ignoredVoices).toBe(1);
    expect(apu.drv.cmds).toEqual([0x32, 0x73]);
  });

  it('erro do host deixa o motor mudo, sem exceção para fora', () => {
    const ring = new SampleRing(4096);
    let acc = 0;
    const dead = { readPort: () => 0, writePort: () => {}, run: (c: number) => { acc += c; while (acc >= 32) { acc -= 32; ring.push(1, 1); } } };
    const eng = new AudioEngine(new AudioImage(synthImage().slices), dead, ring);
    eng.post({ t: 'boot' });
    const L = new Float32Array(128), R = new Float32Array(128);
    expect(() => { for (let i = 0; i < 20000 && !eng.broken; i++) eng.render(L, R, 128); }).not.toThrow();
    expect(eng.broken).toBe(true);
    expect(eng.stats.errors).toBe(1);
    eng.render(L, R, 128);
    expect(L.every(v => v === 0)).toBe(true);
  });
});
```

Run: `cd web && npx vitest run tests/audio/engine.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar `web/src/audio/engine/commands.ts`**

```ts
/** Mensagens do main thread para o motor de áudio (AudioWorklet). */
export type AudioCmd =
  | { t: 'boot' }
  | { t: 'bank'; id: 0x2f | 0x30 }
  | { t: 'music'; id: number }
  | { t: 'sfx'; id: number }
  | { t: 'voice'; id: number }
  | { t: 'stop' }
  | { t: 'fade' };

/** Mensagens do main thread para o processador: a imagem da ROM vem 1 vez, antes de tudo. */
export type WorkletIn = { t: 'image'; c0: Uint8Array; data: Uint8Array } | AudioCmd;
/** Mensagens do processador para o main thread. */
export type WorkletOut =
  | { t: 'ready' }
  | { t: 'stats'; frames: number; nmis: number; droppedSfx: number; ignoredVoices: number; errors: number; lastError: string };
```

- [ ] **Step 3: Implementar `web/src/audio/engine/engine.ts`**

```ts
/**
 * Motor em tempo real (roda dentro do AudioWorklet): intercala as operações do host com o APU,
 * gera o "NMI" do jogo a cada 17.067 ciclos (60 Hz) e entrega quadros a 32 kHz.
 * Regras:
 *  - operações longas (boot, bank, music, stop, fade) vão para uma fila e rodam uma de cada vez,
 *    consumindo ciclos do APU como o 65816 consumiria (a música $14 leva ≈ 1,13 s para começar);
 *  - o NMI só roda com o host livre; um NMI que cai durante uma operação fica pendente (1 no máximo);
 *  - SFX: fila de até 64 aqui dentro; cada NMI entrega no máximo 1 (e só se não houver outro pendente);
 *  - voz: `host.voice()` na hora; ignorada se já houver voz (contada em stats.ignoredVoices);
 *  - antes do fim do boot, SFX e voz são descartados.
 */
import { FRAME_CYCLES, SpcHost, type ApuBus, type HostOp } from '../host/host';
import type { AudioImage } from '../host/image';
import type { SampleRing } from './ring';
import type { AudioCmd } from './commands';

export const SAMPLE_CYCLES = 32;
export const SFX_FIFO = 64;

export interface EngineStats { frames: number; nmis: number; droppedSfx: number; ignoredVoices: number; errors: number; lastError: string }

export class AudioEngine {
  readonly host: SpcHost;
  readonly stats: EngineStats = { frames: 0, nmis: 0, droppedSfx: 0, ignoredVoices: 0, errors: 0, lastError: '' };
  private readonly bus: ApuBus;
  private readonly ring: SampleRing;
  private readonly ops: AudioCmd[] = [];
  private readonly sfxFifo: number[] = [];
  private cur: HostOp | null = null;
  private toFrame = FRAME_CYCLES;
  private nmiPending = false;
  private booted = false;
  private bootQueued = false;
  broken = false;

  constructor(img: AudioImage, bus: ApuBus, ring: SampleRing) {
    this.bus = bus; this.ring = ring;
    this.host = new SpcHost(img, bus);
  }

  post(cmd: AudioCmd): void {
    switch (cmd.t) {
      case 'sfx':
        if (!this.booted) return;
        if (this.sfxFifo.length >= SFX_FIFO) { this.stats.droppedSfx++; return; }
        this.sfxFifo.push(cmd.id);
        return;
      case 'voice':
        if (!this.booted || !this.host.voice(cmd.id)) this.stats.ignoredVoices++;
        return;
      case 'boot':
        if (this.bootQueued) return;
        this.bootQueued = true;
        this.ops.unshift(cmd);
        return;
      default:
        this.ops.push(cmd);
    }
  }

  /** Escreve `n` quadros a 32 kHz em outL/outR[off..]. */
  render(outL: Float32Array, outR: Float32Array, n: number, off = 0): void {
    if (this.broken) { outL.fill(0, off, off + n); outR.fill(0, off, off + n); return; }
    try {
      while (this.ring.size < n) this.advance((n - this.ring.size) * SAMPLE_CYCLES);
    } catch (e) {
      this.broken = true; this.stats.errors++; this.stats.lastError = String(e);
    }
    const got = this.ring.shift(outL, outR, off, n);
    if (got < n) { outL.fill(0, off + got, off + n); outR.fill(0, off + got, off + n); }
    this.stats.frames += n;
  }

  private nextOp(): HostOp | null {
    if (this.nmiPending && this.booted) {
      this.nmiPending = false; this.stats.nmis++;
      if (this.host.e2 === 0 && this.sfxFifo.length) this.host.sfx(this.sfxFifo.shift()!);
      return this.host.nmi();
    }
    const c = this.ops.shift();
    if (!c) return null;
    if (c.t !== 'boot' && !this.booted && !this.bootQueued) return this.nextOp();   // sem boot, nada a fazer
    switch (c.t) {
      case 'boot': return this.withBootDone(this.host.boot());
      case 'bank': return this.host.bank(c.id);
      case 'music': return this.host.music(c.id);
      case 'stop': return this.host.stop();
      case 'fade': return this.host.fade();
      default: return null;
    }
  }
  private *withBootDone(op: HostOp): HostOp { yield* op; this.booted = true; }

  /** Avança o APU por ≈ `cycles` ciclos, rodando o host quando há trabalho. */
  private advance(cycles: number): void {
    let left = Math.min(cycles, this.toFrame);
    while (left > 0) {
      if (!this.cur) this.cur = this.nextOp();
      let used: number;
      if (this.cur) {
        const r = this.cur.next();
        if (r.done) { this.cur = null; continue; }
        used = r.value;
      } else used = left;
      this.bus.run(used);
      left -= used;
      this.toFrame -= used;
      if (this.toFrame <= 0) { this.toFrame += FRAME_CYCLES; this.nmiPending = true; break; }
    }
  }
}
```

- [ ] **Step 4: Rodar**

Run: `cd web && npx vitest run tests/audio/engine.test.ts && npx tsc --noEmit`
Expected: 7 testes PASS.

- [ ] **Step 5: Commit**

```sh
cd web && git add src/audio/engine/engine.ts src/audio/engine/commands.ts tests/audio/engine.test.ts tests/audio/fake-apu.ts
git commit -m "feat(audio): motor em tempo real — fila de operações, NMI a 60 Hz, 1 SFX por NMI e voz única

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Onda 3

### Task 6: APU completo, roteiro síncrono e goldens com a ROM

**Onda 3. Depende de T2, T3 e T4. Não depende dos planos 5 e 6.**

**Possui:**
- `web/src/audio/apu/apu.ts`
- `web/src/audio/host/script.ts`
- `web/tests/audio/golden-host.test.ts`
- `web/tests/audio/perf.test.ts`
- `web/tests/audio/blocks.ts`
- `web/scripts/audio-golden/first-diff.ts`

**Interfaces:**
- Produz: `Apu(out: SampleSink) implements ApuBus { ram, smp, dsp, power(), cycles }`.
- Produz: `runScript(bus, host, script, setRec): [op, ciclos][]`.

**O que os goldens provam:**
- **Sem ROM:** o programa sintético do DSP. O SMP liga uma voz por `$F2/$F3` e lê ENVX/OUTX/ENDX em laço. O log de MMIO, a RAM e o PCM devem ser iguais à referência. Isso valida a sincronização SMP↔DSP ciclo a ciclo.
- **Com a ROM:**
  - a RAM da §10.2, com as contagens exatas;
  - os roteiros `batalha` e `fluxo`, com os ciclos de cada operação, o log completo de MMIO (hash + janelas), a RAM final e o hash do PCM por segundo. O `batalha[0]` é o critério da §11: "hash do 1º segundo da `$14` a partir de `boot`".
- **Desempenho:** ≥ 2× o tempo real no Node. Abaixo disso, ativar o plano B (WASM via `@yowasp/clang`), ver Riscos.

- [ ] **Step 1: Escrever os testes e ajudantes**

`web/tests/audio/blocks.ts`:
```ts
/** Leitura dos blocos IPL e dos sets de samples pela imagem (como romaudio.py [AUD §1.2]), para o golden de RAM. */
import type { AudioImage } from '../../src/audio/host/image';

export type Seg = [number, Uint8Array];

export function blockSegments(img: AudioImage, id: number): Seg[] {
  let p = img.u24(0xc00190 + 3 * id);
  const out: Seg[] = [];
  for (;;) {
    const n = img.u16(p);
    if (!n) return out;
    const d = img.u16(p + 2);
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = img.u8(p + 4 + i);
    out.push([d, b]);
    p += 4 + n;
  }
}

export function sampleSetSegments(img: AudioImage, k: number): { list: Seg[]; samples: Seg[] } {
  const desc = 0xda0000 | img.u16(0xda17d2 + 2 * k);
  let up = 0xda0000 | img.u16(desc);
  const list: Seg[] = [];
  for (;;) {
    const n = img.u16(up);
    if (!n) break;
    const d = img.u16(up + 2);
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = img.u8(up + 4 + i);
    list.push([d, b]); up += 4 + n;
  }
  let dest = img.u16(desc + 2);
  const samples: Seg[] = [];
  for (let y = desc + 4; img.u8(y) !== 0xff; y++) {
    const s = img.u8(y);
    const len = img.u16(0xda2238 + 2 * s), at = img.u24(0xda2118 + 3 * s);
    const b = new Uint8Array(len);
    for (let i = 0; i < len; i++) b[i] = img.u8(at + i);
    samples.push([dest, b]); dest = (dest + len) & 0xffff;
  }
  return { list, samples };
}

/** Quantos bytes dos segmentos a RAM tem iguais / diferentes (ignora $00F0–$00FF, que são MMIO). */
export function compareSegs(ram: Uint8Array, segs: Seg[]): { bytes: number; diffs: number } {
  let bytes = 0, diffs = 0;
  for (const [d, b] of segs) for (let i = 0; i < b.length; i++) {
    const a = d + i;
    if (a > 0xffff || (a >= 0xf0 && a <= 0xff)) continue;
    bytes++;
    if (ram[a] !== b[i]) diffs++;
  }
  return { bytes, diffs };
}
```

`web/tests/audio/golden-host.test.ts`:
```ts
import { Apu } from '../../src/audio/apu/apu';
import { SpcHost } from '../../src/audio/host/host';
import { AudioImage, slicesFromRom } from '../../src/audio/host/image';
import { runScript } from '../../src/audio/host/script';
import { HOST_SCRIPTS } from './gen/host-scripts';
import { PROG_STEPS, progDsp } from './gen/inputs';
import { env, fixture, fs, mmioBytes, sha1 } from './node';
import { ROM, ROM_SHA1 } from './rom';
import { blockSegments, compareSegs, sampleSetSegments } from './blocks';
import { runProg, type ProgResult } from './prog';

interface HostFx {
  romSha1: string;
  hosts: Record<string, { script: string; ops: [string, number, number][]; pcmFrames: number; pcmSha1PerSecond: string[];
    apuramSha1: string; mmioCount: number; mmioSha1: string; mmioWindows: string[] }>;
}

/** Roda um roteiro no APU completo, com log de MMIO e PCM (só enquanto `rec`). */
function runHost(script: string) {
  const pcm: number[] = [];
  let rec = false;
  const apu = new Apu({ push: (l, r) => { if (rec) pcm.push(l, r); } });
  const log: number[] = [];
  apu.smp.onBus = (k, a, d, c) => { if (k !== 3 && (a & 0xfff0) === 0x00f0) log.push(c, k === 1 ? 0x72 : 0x77, a & 0xff, d); };
  const img = new AudioImage(slicesFromRom(ROM!));
  const ops = runScript(apu, new SpcHost(img, apu), script, on => { rec = on; });
  return { apu, img, ops, pcm: new Int16Array(pcm), mmio: mmioBytes(log) };
}

describe('APU + programa sintético do DSP (sem ROM)', () => {
  it('ENVX/OUTX/ENDX lidos pelo SMP e PCM = referência', () => {
    const fx = fixture<{ progs: Record<string, ProgResult & { pcmSha1: string }> }>('audio-prog.json');
    const pcm: number[] = [];
    const apu = new Apu({ push: (l, r) => { pcm.push(l, r); } });
    const got = runProg(apu.smp, progDsp(), PROG_STEPS);
    const want = fx.progs.dsp;
    expect(got.regs).toEqual(want.regs);
    expect(got.mmioSha1).toBe(want.mmioSha1);
    expect(got.ramSha1).toBe(want.ramSha1);
    expect(sha1(new Uint8Array(new Int16Array(pcm).buffer))).toBe(want.pcmSha1);
  });
});

describe.skipIf(!ROM)('host + APU com a ROM = referência (spctrace)', () => {
  const fx = fixture<HostFx>('audio-host.json');

  it('mesma ROM do fixture', () => { expect(sha1(ROM!)).toBe(ROM_SHA1); expect(fx.romSha1).toBe(ROM_SHA1); });

  it('RAM do APU depois de init; blk 2F; mus 14 = bytes da ROM (§10.2)', () => {
    const { apu, img } = runHost('init; blk 2F; mus 14');
    const r = (segs: [number, Uint8Array][]) => compareSegs(apu.ram, segs);
    expect(r(blockSegments(img, 0x31))).toEqual({ bytes: 10295, diffs: 0 });     // driver 10.075 + 220
    expect(r(blockSegments(img, 0x2e))).toEqual({ bytes: 5366, diffs: 0 });
    expect(r(blockSegments(img, 0x2f))).toEqual({ bytes: 4515, diffs: 0 });
    expect(r(blockSegments(img, 0x14))).toEqual({ bytes: 4064, diffs: 0 });
    const set = sampleSetSegments(img, 0x13);
    expect(r(set.list)).toEqual({ bytes: 144, diffs: 0 });
    expect(r(set.samples)).toEqual({ bytes: 31158, diffs: 0 });
  }, 60_000);

  for (const name of Object.keys(HOST_SCRIPTS)) {
    it(`roteiro "${name}": ciclos por operação, PCM, RAM e MMIO bit a bit`, () => {
      const want = fx.hosts[name];
      expect(want.script).toBe(HOST_SCRIPTS[name]);
      const got = runHost(want.script);
      const dump = env.AUDIO_DUMP;                 // depuração: grava as saídas do TS para comparar com o spctrace
      if (dump) {
        fs.writeFileSync(`${dump}/${name}.mmio.bin`, got.mmio);
        fs.writeFileSync(`${dump}/${name}.pcm.raw`, new Uint8Array(got.pcm.buffer));
      }
      const firstBadWindow = want.mmioWindows.findIndex((h, i) => sha1(got.mmio.subarray(i * 65536 * 8, (i + 1) * 65536 * 8)) !== h);
      expect(firstBadWindow, 'primeira janela de 65.536 acessos MMIO diferente').toBe(-1);
      expect(got.mmio.length / 8).toBe(want.mmioCount);
      expect(got.ops).toEqual(want.ops.map(([op, , cyc]) => [op, cyc]));
      expect(got.pcm.length / 2).toBe(want.pcmFrames);
      const pcmBytes = new Uint8Array(got.pcm.buffer);
      const perSecond = want.pcmSha1PerSecond.map((_, i) => sha1(pcmBytes.subarray(i * 128000, (i + 1) * 128000)));
      expect(perSecond).toEqual(want.pcmSha1PerSecond);     // "batalha"[0] = 1º segundo da $14 a partir do boot (§11)
      expect(sha1(got.apu.ram)).toBe(want.apuramSha1);
    }, 120_000);
  }
});
```

`web/tests/audio/perf.test.ts`:
```ts
import { Apu } from '../../src/audio/apu/apu';
import { SpcHost, runSync, FRAME_CYCLES } from '../../src/audio/host/host';
import { AudioImage, slicesFromRom } from '../../src/audio/host/image';
import { ROM } from './rom';

describe.skipIf(!ROM)('desempenho do APU em TS', () => {
  it('3 s da música $14 emulados em menos de 1,5 s (≥ 2× o tempo real)', () => {
    const apu = new Apu({ push() {} });
    const host = new SpcHost(new AudioImage(slicesFromRom(ROM!)), apu);
    runSync(apu, host.boot()); runSync(apu, host.bank(0x2f)); runSync(apu, host.music(0x14));
    const t0 = performance.now();
    for (let f = 0; f < 180; f++) { apu.run(FRAME_CYCLES); runSync(apu, host.nmi()); }
    const ms = performance.now() - t0;
    console.log(`APU: 3 s de áudio em ${ms.toFixed(0)} ms (${(3000 / ms).toFixed(1)}× o tempo real)`);
    expect(ms).toBeLessThan(1500);
  }, 30_000);
});
```

Run: `cd web && SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/audio/golden-host.test.ts tests/audio/perf.test.ts`
Expected: FAIL (`src/audio/apu/apu` não existe).

- [ ] **Step 2: Implementar `web/src/audio/apu/apu.ts`**

```ts
/** O APU completo: 64 KB de RAM compartilhada, SPC700 (nosso) e S-DSP (porte LGPL). */
import { Smp } from './smp';
import { SpcDsp } from './dsp/spc-dsp';
import type { ApuBus } from '../host/host';
import type { SampleSink } from '../engine/ring';

export class Apu implements ApuBus {
  readonly ram = new Uint8Array(0x10000);
  readonly dsp: SpcDsp;
  readonly smp: Smp;
  constructor(out: SampleSink) {
    this.dsp = new SpcDsp(this.ram, out);
    this.smp = new Smp(this.ram, this.dsp);
    this.power();
  }
  /** Igual ao power_all do spctrace: SMP (zera a RAM) e depois DSP. */
  power(): void { this.smp.power(); this.dsp.reset(); }
  get cycles(): number { return this.smp.cycles; }
  readPort(p: number): number { return this.smp.readPort(p); }
  writePort(p: number, v: number): void { this.smp.writePort(p, v); }
  run(cycles: number): void { this.smp.run(cycles); }
}
```

- [ ] **Step 3: Implementar `web/src/audio/host/script.ts`**

```ts
/**
 * Roteiro síncrono, com a mesma sintaxe e a mesma semântica do spchost/spctrace (goldens e depuração):
 *   init | blk XX | mus XX | sfx XX | stream XX | stop | fade | rec | norec | frames N
 * XX em hexadecimal; N em decimal. `frames N` = N × (run(17.067) + NMI).
 * Devolve [operação, ciclos do SMP gastos] para cada comando.
 */
import { FRAME_CYCLES, runSync, type ApuBus, type SpcHost } from './host';

export function runScript(bus: ApuBus & { readonly cycles: number }, host: SpcHost, script: string, setRec: (on: boolean) => void): [string, number][] {
  const out: [string, number][] = [];
  for (const raw of script.split(';')) {
    const [op, arg = ''] = raw.trim().split(/\s+/);
    if (!op) continue;
    const hex = parseInt(arg, 16);
    const c0 = bus.cycles;
    switch (op) {
      case 'init': runSync(bus, host.boot()); break;
      case 'blk': runSync(bus, host.bank(hex)); break;
      case 'mus': runSync(bus, host.music(hex)); break;
      case 'sfx': host.sfx(hex); break;
      case 'stream': host.voice(hex); break;
      case 'stop': runSync(bus, host.stop()); break;
      case 'fade': runSync(bus, host.fade()); break;
      case 'rec': setRec(true); break;
      case 'norec': setRec(false); break;
      case 'frames': {
        const n = parseInt(arg, 10);
        for (let i = 0; i < n; i++) { bus.run(FRAME_CYCLES); runSync(bus, host.nmi()); }
        break;
      }
      default: throw new Error(`comando de roteiro desconhecido: ${op}`);
    }
    out.push([op, bus.cycles - c0]);
  }
  return out;
}
```

- [ ] **Step 4: Criar o comparador de logs `web/scripts/audio-golden/first-diff.ts`**

```ts
// Primeira diferença entre dois logs de MMIO (formato do spctrace: 8 bytes por registro).
// Uso: node scripts/audio-golden/first-diff.ts <referência/mmio.bin> <ts/nome.mmio.bin>
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map(p => new Uint8Array(readFileSync(p)));
const rec = (x: Uint8Array, i: number) => {
  const o = i * 8;
  const cyc = (x[o] | (x[o + 1] << 8) | (x[o + 2] << 16) | (x[o + 3] << 24)) >>> 0;
  return `ciclo ${cyc} ${String.fromCharCode(x[o + 4])} $00${x[o + 5].toString(16).toUpperCase().padStart(2, '0')} = $${x[o + 6].toString(16).toUpperCase().padStart(2, '0')}`;
};
const n = Math.min(a.length, b.length) / 8;
for (let i = 0; i < n; i++) {
  for (let k = 0; k < 8; k++) {
    if (a[i * 8 + k] !== b[i * 8 + k]) {
      console.log(`registro ${i}:`);
      for (let j = Math.max(0, i - 5); j <= i; j++) console.log(`  ref ${rec(a, j)}   |   ts ${rec(b, j)}`);
      process.exit(1);
    }
  }
}
console.log(a.length === b.length ? 'iguais' : `prefixo igual; tamanhos ${a.length / 8} × ${b.length / 8}`);
```

- [ ] **Step 5: Rodar com e sem a ROM**

Run:
```sh
cd web && npx vitest run tests/audio/golden-host.test.ts tests/audio/perf.test.ts
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/audio/golden-host.test.ts tests/audio/perf.test.ts
```
Expected:
- sem ROM: 1 PASS e o resto *skipped*;
- com ROM: 6 PASS (prog DSP, ROM, RAM §10.2, `batalha`, `fluxo`, desempenho), e o log mostra `APU: 3 s de áudio em … ms`.

**Depuração se um roteiro divergir:**
1. Rode o teste com `AUDIO_DUMP=/tmp/a` (a pasta precisa existir).
2. Gere a saída da referência: `"$SPCTRACE" host "$SB4_ROM" "<roteiro>" /tmp/r`.
3. Compare: `node scripts/audio-golden/first-diff.ts /tmp/r/mmio.bin /tmp/a/<nome>.mmio.bin`.

A 1ª diferença de MMIO aponta o ciclo exato. Se o MMIO bate e só o PCM diverge, o erro está no DSP. Se nem o MMIO bate, está no SMP ou no host.

- [ ] **Step 6: Commit**

```sh
cd web && git add src/audio/apu/apu.ts src/audio/host/script.ts tests/audio/golden-host.test.ts tests/audio/perf.test.ts tests/audio/blocks.ts scripts/audio-golden/first-diff.ts
git commit -m "feat(audio): APU completo + goldens com a ROM (RAM da §10.2, PCM do 1º segundo da \$14, MMIO ciclo a ciclo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


## Onda 4

### Task 8: AudioWorklet e cliente do main thread

**Onda 4. Depende de T6 e T7. Não depende dos planos 5 e 6.**

**Possui:**
- `web/src/audio/worklet-core.ts`
- `web/src/audio/worklet.ts`
- `web/src/audio/client.ts`
- `web/tests/audio/worklet-core.test.ts`

**Interfaces:**
- Produz: `WorkletCore(rate, makeBus, post) { onMessage, process, engine }`, `APU_RATE` = 32000 e `BusFactory`.
- Produz: `AudioClientLike { send, setGain, close }` e `AudioClient.create(slices, onMessage?)`.
- Produz: o processador `'crown-apu'`.

**Regras:**
- **Taxa.** O cliente tenta `new AudioContext({ sampleRate: 32000 })`: o navegador reamostra para o aparelho e o worklet entrega as amostras exatas do DSP. Se o construtor recusar, usa a taxa padrão e o `WorkletCore` reamostra com Hermite.
- **Carga do worklet.** `import workletUrl from './worklet?worker&url'`. O Vite emite um *chunk* separado, `assets/worklet-*.js`, com APU, host e motor; é o módulo substituível da LGPL. Conferido na preparação: um `main.ts` de teste que importava o cliente produziu `dist/assets/worklet-*.js`.
- **Volume.** Saída → `GainNode` → destino; o `setGain` ajusta o ganho.
- **Imagem da ROM.** Vai uma vez, com *transfer* dos `ArrayBuffer`. Comandos que chegam antes dela ficam guardados.
- **Estatísticas.** Chegam a cada 1 s de áudio.

- [ ] **Step 1: Escrever o teste `web/tests/audio/worklet-core.test.ts`**

```ts
import { WorkletCore } from '../../src/audio/worklet-core';
import type { WorkletOut } from '../../src/audio/engine/commands';
import { FakeApu } from './fake-apu';
import { synthImage } from './gen/synth-image';

function setup(rate: number) {
  const posted: WorkletOut[] = [];
  let apu: FakeApu | null = null;
  const core = new WorkletCore(rate, ring => (apu = new FakeApu(ring)), m => { posted.push(m); });
  return { core, posted, apu: () => apu! };
}

describe('WorkletCore', () => {
  it('antes da imagem: silêncio e comandos guardados; depois: ready e os comandos na ordem', () => {
    const { core, posted, apu } = setup(32000);
    const L = new Float32Array(128).fill(9), R = new Float32Array(128).fill(9);
    core.process(L, R, 128);
    expect(L.every(v => v === 0)).toBe(true);
    core.onMessage({ t: 'boot' });
    core.onMessage({ t: 'music', id: 0x14 });
    const { c0, data } = synthImage().slices;
    core.onMessage({ t: 'image', c0, data });
    expect(posted).toEqual([{ t: 'ready' }]);
    for (let i = 0; i < 50; i++) core.process(L, R, 128);
    expect(apu().drv.cmds).toEqual([0x01]);
    expect(L[0]).toBeCloseTo(1000 / 32768, 6);
  });
  it('a 48 kHz reamostra: 1 s de saída consome ≈ 1 s de APU e publica estatísticas', () => {
    const { core, posted, apu } = setup(48000);
    const { c0, data } = synthImage().slices;
    core.onMessage({ t: 'image', c0, data });
    const L = new Float32Array(128), R = new Float32Array(128);
    for (let i = 0; i < 375; i++) core.process(L, R, 128);
    expect(Math.abs(apu().drv.cycles - 1_024_000)).toBeLessThan(256 * 32);
    const stats = posted.filter(m => m.t === 'stats');
    expect(stats).toHaveLength(1);
    expect(L[127]).toBeCloseTo(1000 / 32768, 5);
  });
});
```

Run: `cd web && npx vitest run tests/audio/worklet-core.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: Implementar `web/src/audio/worklet-core.ts`**

```ts
/**
 * Lógica do processador de áudio, sem nada do escopo do AudioWorklet (testável no Node).
 * Recebe a imagem da ROM, cria o APU pela fábrica e renderiza a 32 kHz, reamostrando se o
 * contexto rodar em outra taxa. Comandos que chegam antes da imagem ficam guardados.
 */
import { AudioEngine } from './engine/engine';
import { SampleRing } from './engine/ring';
import { Resampler } from './engine/resample';
import { AudioImage } from './host/image';
import type { ApuBus } from './host/host';
import type { AudioCmd, WorkletIn, WorkletOut } from './engine/commands';

export const APU_RATE = 32000;
export type BusFactory = (ring: SampleRing) => ApuBus;

export class WorkletCore {
  engine: AudioEngine | null = null;
  private readonly rate: number;
  private readonly makeBus: BusFactory;
  private readonly post: (m: WorkletOut) => void;
  private readonly resampler: Resampler | null;
  private readonly early: AudioCmd[] = [];
  private sinceStats = 0;

  constructor(rate: number, makeBus: BusFactory, post: (m: WorkletOut) => void) {
    this.rate = rate; this.makeBus = makeBus; this.post = post;
    this.resampler = rate === APU_RATE ? null : new Resampler(APU_RATE, rate);
  }

  onMessage(m: WorkletIn): void {
    if (m.t === 'image') {
      const ring = new SampleRing(8192);
      this.engine = new AudioEngine(new AudioImage({ c0: m.c0, data: m.data }), this.makeBus(ring), ring);
      for (const c of this.early.splice(0)) this.engine.post(c);
      this.post({ t: 'ready' });
      return;
    }
    if (this.engine) this.engine.post(m); else this.early.push(m);
  }

  process(outL: Float32Array, outR: Float32Array, n: number): void {
    const e = this.engine;
    if (!e) { outL.fill(0, 0, n); outR.fill(0, 0, n); return; }
    if (this.resampler) this.resampler.process(outL, outR, n, (l, r, m) => e.render(l, r, m));
    else e.render(outL, outR, n);
    this.sinceStats += n;
    if (this.sinceStats >= this.rate) { this.sinceStats = 0; this.post({ t: 'stats', ...e.stats }); }
  }
}
```

- [ ] **Step 3: Implementar `web/src/audio/worklet.ts`**

A casca não é testável no Node e evita tipos globais de worklet.

```ts
/** Processador do AudioWorklet ('crown-apu'). Só a casca; a lógica está em worklet-core.ts. */
import { WorkletCore } from './worklet-core';
import { Apu } from './apu/apu';
import type { WorkletIn, WorkletOut } from './engine/commands';

interface WorkletScope {
  sampleRate: number;
  registerProcessor(name: string, ctor: unknown): void;
  AudioWorkletProcessor: new () => { readonly port: MessagePort };
}
const g = globalThis as unknown as WorkletScope;

class CrownApuProcessor extends g.AudioWorkletProcessor {
  private readonly core: WorkletCore;
  constructor() {
    super();
    this.core = new WorkletCore(g.sampleRate, ring => new Apu(ring), (m: WorkletOut) => this.port.postMessage(m));
    this.port.onmessage = e => this.core.onMessage(e.data as WorkletIn);
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const o = outputs[0];
    this.core.process(o[0], o[1] ?? o[0], o[0].length);
    return true;
  }
}
g.registerProcessor('crown-apu', CrownApuProcessor);
```

- [ ] **Step 4: Implementar `web/src/audio/client.ts`**

```ts
/**
 * Main thread: cria o AudioContext (de preferência a 32 kHz, a taxa do DSP; senão, a do aparelho e o
 * worklet reamostra), carrega o worklet (chunk separado, que contém o módulo LGPL do DSP) e envia
 * a imagem da ROM uma vez. Só pode ser chamado depois de um gesto do usuário.
 */
import workletUrl from './worklet?worker&url';
import type { AudioCmd, WorkletIn, WorkletOut } from './engine/commands';
import type { AudioSlices } from './host/image';

/** O que o resto do jogo usa do cliente (a fábrica da Tarefa 11 recebe isto, e os testes, um falso). */
export interface AudioClientLike { send(cmd: AudioCmd): void; setGain(g: number): void; close(): Promise<void> }

export class AudioClient implements AudioClientLike {
  private readonly ctx: AudioContext;
  private readonly node: AudioWorkletNode;
  private readonly gain: GainNode;
  private constructor(ctx: AudioContext, node: AudioWorkletNode, gain: GainNode) { this.ctx = ctx; this.node = node; this.gain = gain; }

  static async create(s: AudioSlices, onMessage?: (m: WorkletOut) => void): Promise<AudioClient> {
    let ctx: AudioContext;
    try { ctx = new AudioContext({ sampleRate: 32000, latencyHint: 'interactive' }); }
    catch { ctx = new AudioContext({ latencyHint: 'interactive' }); }
    await ctx.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(ctx, 'crown-apu', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    if (onMessage) node.port.onmessage = e => onMessage(e.data as WorkletOut);
    const gain = ctx.createGain();
    node.connect(gain).connect(ctx.destination);
    const c0 = s.c0.slice(), data = s.data.slice();
    const msg: WorkletIn = { t: 'image', c0, data };
    node.port.postMessage(msg, [c0.buffer, data.buffer]);
    await ctx.resume();
    return new AudioClient(ctx, node, gain);
  }

  send(cmd: AudioCmd): void { this.node.port.postMessage(cmd); }
  setGain(g: number): void { this.gain.gain.value = g; }
  async close(): Promise<void> { this.node.disconnect(); await this.ctx.close(); }
}
```

- [ ] **Step 5: Rodar os testes, o tsc e o build**

Run: `cd web && npx vitest run tests/audio/worklet-core.test.ts && npx tsc --noEmit && npm run build`
Expected: 2 testes PASS, tsc limpo, build ok. O `worklet-….js` só aparece no `dist` quando o `main.ts` importar o registro (T11).

- [ ] **Step 6: Commit**

```sh
cd web && git add src/audio/worklet-core.ts src/audio/worklet.ts src/audio/client.ts tests/audio/worklet-core.test.ts
git commit -m "feat(audio): AudioWorklet 'crown-apu' (32 kHz ou reamostrado) e cliente do main thread

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `AudioSink` real

**Onda 4. Depende do plano 5 (`src/audio/sink.ts`: `AudioSink`, `NoopSink`) e de T7 (`AudioCmd`).**

**Possui:**
- `web/src/audio/rom-sink.ts`
- `web/tests/audio/rom-sink.test.ts`

**Interfaces:**
- Produz: `AudioTransport { send, setGain? }`, `RomSinkOptions { onTick? }` e `SFX_QUEUE` = 64.
- Produz: `RomAudioSink(t, opts?) implements AudioSink`, com `setVolume(music, sfx)` (o `VolumeControl` do plano 10), `dropAllButSfx13`, `dropped` e `pending`.

**Regras (§8.1):**
- **SFX.** O `sfx()` só enfileira, numa fila circular de 64; o 65º é descartado (🟡). O `tick()` é chamado pelo `AudioDirector` do plano 10 1× por update, em **todas** as telas. Ele roda primeiro o `onTick` (atrasos do `BattleAudio`) e depois envia no máximo 1 SFX.
- **Flag `$CA`** (`dropAllButSfx13`): implementado e testado, mas não é ligado no Battle (ver "Decisões").
- **Banco, música, voz, STOP e FADE** vão na hora; a ordem e o STOP ficam por conta do host.
- **Volume.** O DSP mistura música e efeitos num só sinal, então há um ganho geral = `max(música, efeitos)`, limitado a 0..1 (ver "Decisões", D16).
- **Repetição de banco e música.** Ao ligar o sink real depois do gesto, quem repete o banco e a música é o `AudioDirector.setSink` do plano 10 (`current`). Este plano não duplica isso.

- [ ] **Step 1: Escrever o teste `web/tests/audio/rom-sink.test.ts`**

```ts
import { RomAudioSink, SFX_QUEUE } from '../../src/audio/rom-sink';
import type { AudioCmd } from '../../src/audio/engine/commands';

function make(onTick?: () => void) {
  const sent: AudioCmd[] = [];
  const gains: number[] = [];
  return { sent, gains, sink: new RomAudioSink({ send: c => { sent.push(c); }, setGain: g => { gains.push(g); } }, { onTick }) };
}

describe('RomAudioSink', () => {
  it('5 explosões no mesmo tick saem em 5 ticks, 1 por tick (§11)', () => {
    const { sent, sink } = make();
    for (let i = 0; i < 5; i++) sink.sfx(0x07);
    expect(sent).toEqual([]);
    const perTick: number[] = [];
    for (let t = 0; t < 7; t++) { const n = sent.length; sink.tick(); perTick.push(sent.length - n); }
    expect(perTick).toEqual([1, 1, 1, 1, 1, 0, 0]);
    expect(sent).toEqual(Array.from({ length: 5 }, () => ({ t: 'sfx', id: 0x07 })));
  });
  it('mantém a ordem de chegada', () => {
    const { sent, sink } = make();
    sink.sfx(0x0c); sink.sfx(0x07); sink.sfx(0x08);
    sink.tick(); sink.tick(); sink.tick();
    expect(sent.map(c => (c.t === 'sfx' ? c.id : -1))).toEqual([0x0c, 0x07, 0x08]);
  });
  it('fila circular de 64: o 65º é descartado', () => {
    const { sink } = make();
    for (let i = 0; i < SFX_QUEUE + 1; i++) sink.sfx(1);
    expect(sink.pending).toBe(64);
    expect(sink.dropped).toBe(1);
  });
  it('banco, música, voz, STOP e FADE vão na hora', () => {
    const { sent, sink } = make();
    sink.bank(0x2f); sink.music(0x14); sink.voice(0x10); sink.stop(); sink.fade();
    expect(sent).toEqual([{ t: 'bank', id: 0x2f }, { t: 'music', id: 0x14 }, { t: 'voice', id: 0x10 }, { t: 'stop' }, { t: 'fade' }]);
  });
  it('flag $CA: descarta tudo menos o $13', () => {
    const { sent, sink } = make();
    sink.dropAllButSfx13 = true;
    sink.sfx(0x01); sink.sfx(0x02); sink.sfx(0x13); sink.sfx(0x04);
    sink.tick(); sink.tick();
    expect(sent).toEqual([{ t: 'sfx', id: 0x13 }]);
    expect(sink.pending).toBe(0);
  });
  it('onTick roda no início de cada tick, antes de tirar o SFX (atrasos entram na mesma fila)', () => {
    const order: string[] = [];
    const { sent, sink } = make(() => { order.push('onTick'); sink.sfx(0x10); });
    sink.tick();
    expect(order).toEqual(['onTick']);
    expect(sent).toEqual([{ t: 'sfx', id: 0x10 }]);
  });
  it('volume (VolumeControl do plano 10): ganho geral = o maior dos dois, entre 0 e 1', () => {
    const { gains, sink } = make();
    sink.setVolume(0.3, 0.8); sink.setVolume(0, 0); sink.setVolume(2, 0);
    expect(gains).toEqual([0.8, 0, 1]);
  });
});
```

Run: `cd web && npx vitest run tests/audio/rom-sink.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: Implementar `web/src/audio/rom-sink.ts`**

```ts
/**
 * AudioSink real (§8.1): fila circular de 64 SFX no main thread, 1 SFX por tick de jogo
 * ($C3:4A7F/$C3:4AAA [AUD §1.5]); o resto vai direto ao worklet. Implementa também o
 * `VolumeControl` opcional do plano 10 (R25).
 */
import type { AudioSink } from './sink';
import type { AudioCmd } from './engine/commands';

export interface AudioTransport { send(cmd: AudioCmd): void; setGain?(g: number): void }
export interface RomSinkOptions { /** chamado no início de cada tick(), antes de tirar o SFX da fila (atrasos do BattleAudio) */ onTick?: () => void }
export const SFX_QUEUE = 64;

export class RomAudioSink implements AudioSink {
  private readonly t: AudioTransport;
  private readonly onTick: (() => void) | undefined;
  private readonly queue: number[] = [];
  /** Flag $CA do jogo: com ele, tick() descarta tudo menos o SFX $13. Não é ligado no Battle (🟡, A16). */
  dropAllButSfx13 = false;
  dropped = 0;
  constructor(t: AudioTransport, opts: RomSinkOptions = {}) { this.t = t; this.onTick = opts.onTick; }
  bank(id: 0x2f | 0x30): void { this.t.send({ t: 'bank', id }); }
  music(id: number): void { this.t.send({ t: 'music', id }); }
  sfx(id: number): void {
    if (this.queue.length >= SFX_QUEUE) { this.dropped++; return; }
    this.queue.push(id);
  }
  voice(id: number): void { this.t.send({ t: 'voice', id }); }
  stop(): void { this.t.send({ t: 'stop' }); }
  fade(): void { this.t.send({ t: 'fade' }); }
  tick(): void {
    this.onTick?.();
    while (this.queue.length) {
      const id = this.queue.shift()!;
      if (this.dropAllButSfx13 && id !== 0x13) continue;
      this.t.send({ t: 'sfx', id });
      return;
    }
  }
  /** VolumeControl (plano 10): o DSP mistura música e efeitos num só sinal; o ganho geral é o maior dos dois. */
  setVolume(music: number, sfx: number): void { this.t.setGain?.(Math.max(0, Math.min(1, Math.max(music, sfx)))); }
  get pending(): number { return this.queue.length; }
}
```

- [ ] **Step 3: Rodar**

Run: `cd web && npx vitest run tests/audio/rom-sink.test.ts && npx tsc --noEmit`
Expected: 7 testes PASS.

- [ ] **Step 4: Commit**

```sh
cd web && git add src/audio/rom-sink.ts tests/audio/rom-sink.test.ts
git commit -m "feat(audio): AudioSink real — fila de 64, 1 SFX por tick, volume e gancho de tick

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Eventos da partida → SFX/voz e roteiros de transição

**Onda 4. Depende do plano 5 (`AudioSink`) e do plano 6 (`GameEvent` em `src/core/types.ts`).**

**Possui:**
- `web/src/audio/events.ts`
- `web/src/audio/cues.ts`
- `web/tests/audio/events.test.ts`
- `web/tests/audio/cues.test.ts`

**Interfaces:**
- Produz: `EventSoundTables { stage, mount }` e `BattleAudio(tables?) { handle(sink, events), tick(), reset() }`.
- Produz: `SKULL_FIRST`/`SKULL_LAST` = `$21`/`$2B`, `HIT_VOICE_DELAY` = 2, `HIT_SFX_DELAY` = 13 e `MAX_PENDING` = 64.
- Produz: `MUSIC_BANK`, `VOICE_BANK`, `Cue`, `CueScript`, `CUES`, `CuePlayer(sink, script) { tick() }`.

**Regras:**
- **Integração.** `handle` tem a assinatura do `setGameEventAudio` do plano 10: `(sink, ev) => void`, chamado só em passos com eventos.
- **Tabela da §3.15**, com os IDs da AUD §3.
- **`item_picked`:** caveiras `$21–$2B` → `$0A`; qualquer outro item, inclusive ovos `$30–$3F` → `$08`.
- **`player_hit`:** voz `$06` em +2 ticks e SFX `$10` em +13 ticks (≈ 11 depois da voz).
  - O relógio anda por `tick()`, que o `RomAudioSink` chama 1× por tick (`onTick`), porque o plano 10 só chama `handle` quando há eventos.
  - Os atrasados saem no mesmo sink que recebeu o evento (o `AudioDirector`).
  - No máximo 64 pendentes.
- **`time_up`** → STOP. **`round_over`** → nada.
- **`{type: 'stage'|'mount', id}`** → `STAGE_SFX` (plano 8, `core/stages/events.ts`: `a2_warn` `$26`, `a5_shock` `$18`, `a6_reverse` `$0A`, `a8_click` `$01`, `a8_brake` `$27`, `a8_prize` `$17`, `a8_drop` `$12`) e `MOUNT_SFX` (plano 9, `core/mounts/events.ts`, `null` = sem som). As tabelas entram no construtor, então esta tarefa não importa os planos 8 e 9; um campo numérico `sfx`/`voice` no evento também toca.
- **Leitura "frouxa".** O `handle` lê os eventos como `{ type: string; … }`, então compila mesmo que o plano 6 acrescente variantes.
- **Roteiros.** Frames medidos [AUD §2]; `nextRound` e `allDeadDraw` têm intervalos 🟡. O teste garante, para todo roteiro, que cada música e cada voz tocam com o banco que as exige; é a parte de dados do critério "banco certo por tela" da §11. O plano 10 tem as próprias *cues* (`game/timeline.ts`); a T11 confere que elas batem com `CUES`.

- [ ] **Step 1: Escrever os testes**

`web/tests/audio/events.test.ts`:
```ts
import { BattleAudio, HIT_SFX_DELAY, HIT_VOICE_DELAY } from '../../src/audio/events';
import type { AudioSink } from '../../src/audio/sink';
import type { GameEvent } from '../../src/core/types';

function recorder() {
  const log: string[] = [];
  const h = (n: number) => n.toString(16).padStart(2, '0');
  const s: AudioSink = {
    bank: id => { log.push(`bank ${h(id)}`); }, music: id => { log.push(`music ${h(id)}`); }, sfx: id => { log.push(`sfx ${h(id)}`); },
    voice: id => { log.push(`voice ${h(id)}`); }, stop: () => { log.push('stop'); }, fade: () => { log.push('fade'); }, tick: () => { log.push('tick'); },
  };
  return { log, s };
}
const ev = (...e: object[]) => e as unknown as GameEvent[];
const TABLES = {
  stage: { a2_warn: 0x26, a5_shock: 0x18, a6_reverse: 0x0a, a8_click: 0x01, a8_brake: 0x27, a8_prize: 0x17, a8_drop: 0x12 },
  mount: { egg_revealed: null, mount_start: null, mount_ability: 0x0c },
};

describe('BattleAudio: tabela da §3.15', () => {
  const table: [object, string[]][] = [
    [{ type: 'bomb_placed', slot: 0, cell: 40 }, ['sfx 0c']],
    [{ type: 'explosion', cell: 40, owner: 0 }, ['sfx 07']],
    [{ type: 'item_picked', slot: 0, item: 0x01 }, ['sfx 08']],
    [{ type: 'item_picked', slot: 0, item: 0x21 }, ['sfx 0a']],
    [{ type: 'item_picked', slot: 0, item: 0x2b }, ['sfx 0a']],
    [{ type: 'item_picked', slot: 0, item: 0x30 }, ['sfx 08']],
    [{ type: 'disease_passed', from: 0, to: 1 }, ['sfx 0a', 'voice 04']],
    [{ type: 'footstep', slot: 2 }, ['sfx 0b']],
    [{ type: 'bomb_kicked', slot: 0 }, ['sfx 0d']],
    [{ type: 'punch', slot: 0 }, ['sfx 0d', 'voice 03']],
    [{ type: 'p_punch', slot: 0 }, ['sfx 0d', 'voice 03']],
    [{ type: 'throw', slot: 0 }, ['sfx 0e', 'voice 03']],
    [{ type: 'bomb_bounce' }, ['sfx 0e']],
    [{ type: 'bomb_landed' }, ['sfx 0f']],
    [{ type: 'stunned', slot: 1 }, ['sfx 12', 'voice 02']],
    [{ type: 'hurry' }, ['sfx 15', 'voice 10']],
    [{ type: 'pressure_step', cell: 18 }, ['sfx 27']],
    [{ type: 'victory_sfx', slot: 3 }, ['sfx 17']],
    [{ type: 'time_up' }, ['stop']],
    [{ type: 'round_over', result: 'draw' }, []],
    [{ type: 'stage', id: 'a2_warn' }, ['sfx 26']],
    [{ type: 'stage', id: 'a8_brake', slot: 0 }, ['sfx 27']],
    [{ type: 'stage', id: 'a6_reverse', slot: 1, cell: 40 }, ['sfx 0a']],
    [{ type: 'stage', id: 'sem_som' }, []],
    [{ type: 'mount', id: 'mount_start', slot: 0 }, []],
    [{ type: 'mount', id: 'mount_ability', slot: 0 }, ['sfx 0c']],
    [{ type: 'stage', id: 'qualquer', sfx: 0x1c, voice: 0x03 }, ['sfx 1c', 'voice 03']],
  ];
  for (const [e, want] of table) {
    it((e as { type: string }).type + ' ' + JSON.stringify(e), () => {
      const { log, s } = recorder();
      new BattleAudio(TABLES).handle(s, ev(e));
      expect(log).toEqual(want);
    });
  }
  it('vários eventos no mesmo tick saem na ordem dos eventos (a fila de 1/tick é do sink)', () => {
    const { log, s } = recorder();
    new BattleAudio().handle(s, ev({ type: 'explosion' }, { type: 'explosion' }, { type: 'bomb_placed' }));
    expect(log).toEqual(['sfx 07', 'sfx 07', 'sfx 0c']);
  });
});

describe('BattleAudio: acerto com atraso', () => {
  it('voz $06 em +2 ticks e SFX $10 em +13 ticks, no sink que recebeu o evento', () => {
    const { log, s } = recorder();
    const b = new BattleAudio();
    b.handle(s, ev({ type: 'player_hit', slot: 1 }));
    const when: Record<string, number> = {};
    for (let t = 1; t <= 20; t++) {
      const n = log.length;
      b.tick();
      for (const l of log.slice(n)) when[l] = t;
    }
    expect(when).toEqual({ 'voice 06': HIT_VOICE_DELAY, 'sfx 10': HIT_SFX_DELAY });
    expect([HIT_VOICE_DELAY, HIT_SFX_DELAY]).toEqual([2, 13]);
  });
  it('reset descarta os pendentes; o limite é de 64 pendentes', () => {
    const { log, s } = recorder();
    const b = new BattleAudio();
    b.handle(s, ev({ type: 'player_hit', slot: 0 }));
    b.reset();
    for (let t = 0; t < 20; t++) b.tick();
    expect(log).toEqual([]);
    for (let i = 0; i < 40; i++) b.handle(s, ev({ type: 'player_hit', slot: 0 }));
    for (let t = 0; t < 20; t++) b.tick();
    expect(log).toHaveLength(64);
  });
});
```

`web/tests/audio/cues.test.ts`:
```ts
import { CUES, CuePlayer, MUSIC_BANK, VOICE_BANK, type Bank, type CueScript } from '../../src/audio/cues';
import type { AudioSink } from '../../src/audio/sink';

describe('roteiros de transição', () => {
  const scripts = CUES as Record<string, CueScript>;
  for (const [name, sc] of Object.entries(scripts)) {
    it(`${name}: cada música e cada voz tocam com o banco certo`, () => {
      let bank: Bank = sc.startBank;
      for (const c of [...sc.cues].sort((a, b) => a.at - b.at)) {
        if (c.kind === 'bank') bank = c.id;
        if (c.kind === 'music') expect(MUSIC_BANK[c.id], `música $${c.id.toString(16)}`).toBe(bank);
        if (c.kind === 'voice') expect(VOICE_BANK[c.id], `voz $${c.id.toString(16)}`).toBe(bank);
      }
    });
  }
  it('fase → partida e TIME UP com os frames medidos [AUD §2]', () => {
    const f = (sc: CueScript) => sc.cues.map(c => `${c.at}:${c.kind}${'id' in c ? ' ' + c.id.toString(16) : ''}`);
    expect(f(CUES.stageToBattle)).toEqual(['0:sfx 2', '48:music 13', '208:voice 7', '310:fade', '511:bank 2f', '523:music 14']);
    expect(f(CUES.timeUpDraw)).toEqual(['0:stop', '161:fade', '218:bank 30', '228:music 18', '426:voice e']);
    expect(f(CUES.roundWin)).toEqual(['0:sfx 17', '97:fade', '113:bank 30', '154:music 15']);
  });
  it('CuePlayer emite cada item no frame certo', () => {
    const got: string[] = [];
    const s: AudioSink = {
      bank: id => { got.push(`${frame} bank ${id}`); }, music: id => { got.push(`${frame} music ${id}`); }, sfx: id => { got.push(`${frame} sfx ${id}`); },
      voice: id => { got.push(`${frame} voice ${id}`); }, stop: () => { got.push(`${frame} stop`); }, fade: () => { got.push(`${frame} fade`); }, tick: () => {},
    };
    let frame = 0;
    const p = new CuePlayer(s, CUES.nextRound);
    while (p.tick()) frame++;
    expect(got).toEqual([`0 bank ${0x2f}`, `12 music ${0x14}`]);
  });
});
```

Run: `cd web && npx vitest run tests/audio/events.test.ts tests/audio/cues.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar `web/src/audio/events.ts`**

```ts
/**
 * GameEvent → SFX/voz (§3.15 [AUD §3]). Registrado no `setGameEventAudio` do plano 10: `handle(sink, ev)`
 * roda a cada passo da partida com eventos. Os atrasos (acerto) contam ticks de jogo por `tick()`,
 * que o RomAudioSink chama 1× por tick (opção `onTick`), e saem no mesmo sink que recebeu o evento.
 * Eventos `{type: 'stage' | 'mount', id}` (planos 8 e 9) tocam pelas tabelas deles (`STAGE_SFX`,
 * `MOUNT_SFX`, injetadas no construtor; `null` = sem som). Um campo numérico `sfx`/`voice` no evento
 * também toca esses IDs.
 */
import type { AudioSink } from './sink';
import type { GameEvent } from '../core/types';

export const SKULL_FIRST = 0x21, SKULL_LAST = 0x2b;
export const HIT_VOICE_DELAY = 2;          // voz $06 2 ticks depois do acerto
export const HIT_SFX_DELAY = 13;           // SFX $10 ≈ 11 ticks depois da voz
export const MAX_PENDING = 64;

export interface EventSoundTables {
  stage: Readonly<Record<string, number>>;            // STAGE_SFX (plano 8, core/stages/events.ts)
  mount: Readonly<Record<string, number | null>>;     // MOUNT_SFX (plano 9, core/mounts/events.ts)
}

type Loose = { type: string; id?: unknown; item?: unknown; sfx?: unknown; voice?: unknown };
interface Pending { at: number; sink: AudioSink; kind: 'sfx' | 'voice'; id: number }

export class BattleAudio {
  private readonly tables: EventSoundTables;
  private now = 0;
  private pending: Pending[] = [];

  constructor(tables: EventSoundTables = { stage: {}, mount: {} }) { this.tables = tables; }

  reset(): void { this.pending = []; }

  handle(s: AudioSink, events: readonly GameEvent[]): void {
    for (const raw of events) {
      const e = raw as unknown as Loose;
      switch (e.type) {
        case 'bomb_placed': s.sfx(0x0c); break;
        case 'explosion': s.sfx(0x07); break;
        case 'item_picked': {
          const it = typeof e.item === 'number' ? e.item : 0;
          s.sfx(it >= SKULL_FIRST && it <= SKULL_LAST ? 0x0a : 0x08);
          break;
        }
        case 'disease_passed': s.sfx(0x0a); s.voice(0x04); break;
        case 'footstep': s.sfx(0x0b); break;
        case 'bomb_kicked': s.sfx(0x0d); break;
        case 'punch': case 'p_punch': s.sfx(0x0d); s.voice(0x03); break;
        case 'throw': s.sfx(0x0e); s.voice(0x03); break;
        case 'bomb_bounce': s.sfx(0x0e); break;
        case 'bomb_landed': s.sfx(0x0f); break;
        case 'player_hit':
          this.later(s, HIT_VOICE_DELAY, 'voice', 0x06);
          this.later(s, HIT_SFX_DELAY, 'sfx', 0x10);
          break;
        case 'stunned': s.sfx(0x12); s.voice(0x02); break;
        case 'hurry': s.sfx(0x15); s.voice(0x10); break;
        case 'pressure_step': s.sfx(0x27); break;
        case 'victory_sfx': s.sfx(0x17); break;
        case 'time_up': s.stop(); break;
        default: {
          const id = typeof e.id === 'string' ? e.id : '';
          const known = e.type === 'stage' ? this.tables.stage[id] : e.type === 'mount' ? this.tables.mount[id] : undefined;
          const sfx = typeof e.sfx === 'number' ? e.sfx : known ?? undefined;
          const voice = typeof e.voice === 'number' ? e.voice : undefined;
          if (sfx !== undefined) s.sfx(sfx);
          if (voice !== undefined) s.voice(voice);
        }
      }
    }
  }

  /** 1× por tick de jogo: avança o relógio e solta os atrasados que venceram. */
  tick(): void {
    this.now++;
    if (!this.pending.length) return;
    const due = this.pending.filter(p => p.at <= this.now);
    if (!due.length) return;
    this.pending = this.pending.filter(p => p.at > this.now);
    for (const p of due) { if (p.kind === 'sfx') p.sink.sfx(p.id); else p.sink.voice(p.id); }
  }

  private later(sink: AudioSink, delay: number, kind: 'sfx' | 'voice', id: number): void {
    if (this.pending.length >= MAX_PENDING) this.pending.shift();
    this.pending.push({ at: this.now + delay, sink, kind, id });
  }
}
```

- [ ] **Step 3: Implementar `web/src/audio/cues.ts`**

```ts
/**
 * Roteiros de som das transições, em frames de tela a partir do 1º evento [AUD §2], e os bancos
 * exigidos por música e voz [AUD §3]. O plano 10 pode tocá-los com `CuePlayer` ou chamar o seu
 * `AudioDirector` nos mesmos frames; o teste garante que cada voz/música toca com o banco certo.
 */
import type { AudioSink } from './sink';

export type Bank = 0x2f | 0x30;
export const MUSIC_BANK: Record<number, Bank> = { 0x01: 0x30, 0x12: 0x30, 0x13: 0x30, 0x14: 0x2f, 0x15: 0x30, 0x16: 0x30, 0x18: 0x30 };
export const VOICE_BANK: Record<number, Bank> = { 0x01: 0x30, 0x02: 0x2f, 0x03: 0x2f, 0x04: 0x2f, 0x06: 0x2f, 0x07: 0x30, 0x0a: 0x30, 0x0e: 0x30, 0x10: 0x2f };

export type Cue =
  | { at: number; kind: 'sfx' | 'music' | 'voice'; id: number }
  | { at: number; kind: 'bank'; id: Bank }
  | { at: number; kind: 'fade' | 'stop' };

export interface CueScript { startBank: Bank; cues: Cue[] }

export const CUES = {
  /** Fase escolhida → partida (§6.7): SFX $02, jingle $13, voz $07, FADE, banco $2F, música $14. */
  stageToBattle: { startBank: 0x30, cues: [
    { at: 0, kind: 'sfx', id: 0x02 }, { at: 48, kind: 'music', id: 0x13 }, { at: 208, kind: 'voice', id: 0x07 },
    { at: 310, kind: 'fade' }, { at: 511, kind: 'bank', id: 0x2f }, { at: 523, kind: 'music', id: 0x14 },
  ] },
  /** Rodada com vencedor (§6.10), a partir do SFX $17. */
  roundWin: { startBank: 0x2f, cues: [
    { at: 0, kind: 'sfx', id: 0x17 }, { at: 97, kind: 'fade' }, { at: 113, kind: 'bank', id: 0x30 }, { at: 154, kind: 'music', id: 0x15 },
  ] },
  /** Próxima rodada, sem repetir o $13 (os +12 f entre banco e música são 🟡, iguais aos 511→523). */
  nextRound: { startBank: 0x30, cues: [{ at: 0, kind: 'bank', id: 0x2f }, { at: 12, kind: 'music', id: 0x14 }] },
  /** Última coroa (§6.12): como roundWin + música $16 (+671) e voz $0A (+955). */
  matchVictory: { startBank: 0x2f, cues: [
    { at: 0, kind: 'sfx', id: 0x17 }, { at: 97, kind: 'fade' }, { at: 113, kind: 'bank', id: 0x30 }, { at: 154, kind: 'music', id: 0x15 },
    { at: 671, kind: 'music', id: 0x16 }, { at: 955, kind: 'voice', id: 0x0a },
  ] },
  /** TIME UP → EMPATE (§6.11): STOP em 0:00, FADE +161, banco $30 +218, música $18 +228, voz $0E +426. */
  timeUpDraw: { startBank: 0x2f, cues: [
    { at: 0, kind: 'stop' }, { at: 161, kind: 'fade' }, { at: 218, kind: 'bank', id: 0x30 },
    { at: 228, kind: 'music', id: 0x18 }, { at: 426, kind: 'voice', id: 0x0e },
  ] },
  /** Todos mortos → EMPATE: FADE, banco $30, música $18 (mesmos intervalos do TIME UP, 🟡). */
  allDeadDraw: { startBank: 0x2f, cues: [
    { at: 0, kind: 'fade' }, { at: 57, kind: 'bank', id: 0x30 }, { at: 67, kind: 'music', id: 0x18 }, { at: 265, kind: 'voice', id: 0x0e },
  ] },
} satisfies Record<string, CueScript>;

export class CuePlayer {
  private readonly sink: AudioSink;
  private readonly cues: Cue[];
  private f = 0;
  private i = 0;
  constructor(sink: AudioSink, script: CueScript) { this.sink = sink; this.cues = [...script.cues].sort((a, b) => a.at - b.at); }
  /** 1× por frame de tela. Devolve false quando o roteiro acabou. */
  tick(): boolean {
    while (this.i < this.cues.length && this.cues[this.i].at <= this.f) {
      const c = this.cues[this.i++];
      switch (c.kind) {
        case 'sfx': this.sink.sfx(c.id); break;
        case 'music': this.sink.music(c.id); break;
        case 'voice': this.sink.voice(c.id); break;
        case 'bank': this.sink.bank(c.id); break;
        case 'fade': this.sink.fade(); break;
        case 'stop': this.sink.stop(); break;
      }
    }
    this.f++;
    return this.i < this.cues.length;
  }
}
```

- [ ] **Step 4: Rodar**

Run: `cd web && npx vitest run tests/audio/events.test.ts tests/audio/cues.test.ts && npx tsc --noEmit`
Expected: 38 testes PASS (30 de eventos + 8 de roteiros).

- [ ] **Step 5: Commit**

```sh
cd web && git add src/audio/events.ts src/audio/cues.ts tests/audio/events.test.ts tests/audio/cues.test.ts
git commit -m "feat(audio): GameEvent → SFX/voz (§3.15, arenas, montarias, acerto com atraso) e roteiros com banco certo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Onda 5

### Task 11: Fábrica do sink, registro no jogo e aceite

**Onda 5. Depende de T8, T9 e T10 e dos planos 5 (`rom/state.ts`), 8 (`core/stages/events.ts`), 9 (`core/mounts/events.ts`) e 10 (`app/audio.ts`: `registerAudioFactory`, `setGameEventAudio`, `AudioDirector`; `main.ts`) mesclados.**

**Possui:**
- `web/src/audio/factory.ts`
- `web/src/audio/register.ts`
- `web/tests/audio/factory.test.ts`
- **1 linha** acrescentada em `web/src/main.ts`: `import './audio/register';`, como combinado no plano 10 (R26, T22, item 6 da integração).

**Interfaces:**
- Produz: `createAudioFactory(deps): () => Promise<AudioSink>`, `AudioFactoryDeps` e `RomBytes`.
- Produz: o módulo de efeito `register.ts`.

**Regras:**
- **Quem liga o som.** O plano 10 chama a fábrica depois do 1º gesto (`keydown`/`pointerdown`) e a cada `onRomChange`, e passa o resultado ao `AudioDirector.setSink`. O director repete banco, música e volume.
- **Comportamento da fábrica:**
  - sem ROM → `NoopSink`;
  - mesma ROM → o mesmo sink;
  - ROM nova ou esquecida → fecha o cliente antigo;
  - erro (sem AudioWorklet, contexto recusado) → `NoopSink` + aviso;
  - chamadas sobrepostas são serializadas.
- **Ordem ao criar o cliente.** `boot` antes de tudo. Depois o director manda o banco e a música atuais, e o motor os enfileira atrás do boot.
- **Fatias.** `slicesFromView(romState.assets.rom)`: o `RomView` do plano 5 tem `bytes(endereço, n)`, que devolve cópia. O `AudioRomSlices` do plano 5 não é usado (ver "Decisões", D11).

- [ ] **Step 1: Escrever o teste `web/tests/audio/factory.test.ts`**

```ts
import { createAudioFactory, type RomBytes } from '../../src/audio/factory';
import { RomAudioSink } from '../../src/audio/rom-sink';
import { NoopSink } from '../../src/audio/sink';
import type { AudioClientLike } from '../../src/audio/client';
import type { AudioCmd } from '../../src/audio/engine/commands';

function fakeRom(): RomBytes {
  const rom = new Uint8Array(0x400000);
  return { bytes: (a, n) => rom.subarray(a - 0xc00000, a - 0xc00000 + n) };
}

function setup() {
  let rom: RomBytes | null = null;
  const clients: { sent: AudioCmd[]; closed: boolean; c0: number; data: number }[] = [];
  let ticks = 0;
  const factory = createAudioFactory({
    currentRom: () => rom,
    createClient: async s => {
      const c = { sent: [] as AudioCmd[], closed: false, c0: s.c0.length, data: s.data.length };
      clients.push(c);
      const api: AudioClientLike = { send: cmd => { c.sent.push(cmd); }, setGain: () => {}, close: async () => { c.closed = true; } };
      return api;
    },
    onTick: () => { ticks++; },
  });
  return { factory, clients, setRom: (r: RomBytes | null) => { rom = r; }, ticks: () => ticks };
}

describe('createAudioFactory (registerAudioFactory do plano 10)', () => {
  it('sem ROM devolve NoopSink e não cria cliente', async () => {
    const t = setup();
    expect(await t.factory()).toBeInstanceOf(NoopSink);
    expect(t.clients).toHaveLength(0);
  });
  it('com ROM: cliente com as fatias certas, boot primeiro, e o mesmo sink enquanto a ROM não muda', async () => {
    const t = setup();
    t.setRom(fakeRom());
    const a = await t.factory();
    expect(a).toBeInstanceOf(RomAudioSink);
    expect(t.clients).toHaveLength(1);
    expect([t.clients[0].c0, t.clients[0].data]).toEqual([1627, 367765]);
    expect(t.clients[0].sent).toEqual([{ t: 'boot' }]);
    expect(await t.factory()).toBe(a);
    a.tick();
    expect(t.ticks()).toBe(1);
  });
  it('ROM trocada ou esquecida fecha o cliente anterior', async () => {
    const t = setup();
    t.setRom(fakeRom()); await t.factory();
    t.setRom(fakeRom()); await t.factory();
    expect(t.clients.map(c => c.closed)).toEqual([true, false]);
    t.setRom(null);
    expect(await t.factory()).toBeInstanceOf(NoopSink);
    expect(t.clients[1].closed).toBe(true);
  });
  it('chamadas sobrepostas não criam dois clientes', async () => {
    const t = setup();
    t.setRom(fakeRom());
    const [a, b] = await Promise.all([t.factory(), t.factory()]);
    expect(a).toBe(b);
    expect(t.clients).toHaveLength(1);
  });
  it('erro ao criar o cliente: NoopSink e onError', async () => {
    const errs: unknown[] = [];
    const f = createAudioFactory({ currentRom: fakeRom, createClient: async () => { throw new Error('sem AudioWorklet'); }, onError: e => { errs.push(e); } });
    expect(await f()).toBeInstanceOf(NoopSink);
    expect(errs).toHaveLength(1);
  });
});
```

Run: `cd web && npx vitest run tests/audio/factory.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: Implementar `web/src/audio/factory.ts`**

```ts
/**
 * Fábrica do sink real para o `registerAudioFactory` do plano 10 (chamada depois do 1º gesto e a cada
 * mudança de ROM). Sem ROM: NoopSink. Mesma ROM: o mesmo sink. ROM nova: fecha o cliente antigo e cria
 * outro (os samples vêm da ROM). Chamadas sobrepostas são serializadas.
 */
import { NoopSink, type AudioSink } from './sink';
import { RomAudioSink } from './rom-sink';
import { slicesFromView, type AudioSlices } from './host/image';
import type { AudioClientLike } from './client';

export interface RomBytes { bytes(addr: number, n: number): Uint8Array }
export interface AudioFactoryDeps {
  currentRom(): RomBytes | null;
  createClient(s: AudioSlices): Promise<AudioClientLike>;
  /** chamado 1× por tick de jogo pelo RomAudioSink (atrasos do BattleAudio) */
  onTick?(): void;
  onError?(e: unknown): void;
}

export function createAudioFactory(d: AudioFactoryDeps): () => Promise<AudioSink> {
  let cur: { rom: RomBytes; client: AudioClientLike; sink: RomAudioSink } | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const make = async (): Promise<AudioSink> => {
    const rom = d.currentRom();
    if (cur && cur.rom === rom) return cur.sink;
    if (cur) { const old = cur; cur = null; await old.client.close(); }
    if (!rom) return new NoopSink();
    try {
      const client = await d.createClient(slicesFromView(rom));
      client.send({ t: 'boot' });
      const sink = new RomAudioSink(client, { onTick: d.onTick });
      cur = { rom, client, sink };
      return sink;
    } catch (e) {
      d.onError?.(e);
      return new NoopSink();
    }
  };
  return () => { const p = chain.then(make); chain = p.catch(() => undefined); return p; };
}
```

Conferir que `web/src/audio/host/image.ts` exporta `slicesFromView` (vem da T4):
```ts
/** Mesmas fatias a partir do `RomView` do plano 5 (`bytes(endereçoSNES, n)`), sem depender do tipo dele. */
export function slicesFromView(v: { bytes(addr: number, n: number): Uint8Array }): AudioSlices {
  return { c0: v.bytes(C0_START, C0_END - C0_START).slice(), data: v.bytes(DATA_START, DATA_END - DATA_START).slice() };
}
```

- [ ] **Step 3: Implementar `web/src/audio/register.ts`**

Antes, abra `web/src/app/audio.ts` (plano 10), `web/src/rom/state.ts` (plano 5), `web/src/core/stages/events.ts` (plano 8) e `web/src/core/mounts/events.ts` (plano 9) e confira os nomes. Se um nome diferir, ajuste só o import. Se o plano 8 ou o 9 ainda não estiver mesclado, use `{}` no lugar da tabela dele e registre no PR.

```ts
/**
 * Liga o som original ao jogo. Importado 1 vez pelo main.ts (`import './audio/register';`), como
 * combinado com o plano 10 (R26 e T22 dele): registra a fábrica do sink real e o mapeamento dos eventos.
 */
import { registerAudioFactory, setGameEventAudio } from '../app/audio';
import { romState } from '../rom/state';
import { STAGE_SFX } from '../core/stages/events';
import { MOUNT_SFX } from '../core/mounts/events';
import { AudioClient } from './client';
import { BattleAudio } from './events';
import { createAudioFactory } from './factory';

const battle = new BattleAudio({ stage: STAGE_SFX, mount: MOUNT_SFX });

registerAudioFactory(createAudioFactory({
  currentRom: () => romState.assets?.rom ?? null,
  createClient: s => AudioClient.create(s, m => {
    if (import.meta.env.DEV && m.t === 'stats' && (m.errors || m.droppedSfx)) console.warn('áudio:', m);
  }),
  onTick: () => battle.tick(),
  onError: e => console.warn('Som original indisponível:', e),
}));
setGameEventAudio((sink, ev) => battle.handle(sink, ev));
```

- [ ] **Step 4: Gancho no `web/src/main.ts`**

Acrescente uma linha, junto dos outros imports:
```ts
import './audio/register';
```

- [ ] **Step 5: Conferir a integração com o plano 10.** Leia o código mesclado e confira os pontos abaixo. Se faltar algo, é uma linha em arquivo do plano 10: registre no PR e combine com o dono.
  1. O `AudioDirector.tick()` roda 1× por update em todas as telas (fila de SFX e atrasos do acerto).
  2. A partida chama `app.audio.playEvents(ev)` a cada passo.
  3. As trocas de banco e música do plano 10 batem com `CUES`:
     - fase → partida: `$02`, `$13` +48, `$07` +208, fade +310, `$2F` +511, `$14` +523;
     - vitória: `$17`, fade +97, `$30` +113, `$15` +154;
     - TIME UP: stop, fade +161, `$30` +218, `$18` +228, `$0E` +426;
     - VICTORY: `$16` e `$0A`;
     - próxima rodada: `$2F` + `$14` sem `$13`.

     Diferenças vão para o PR.
  4. Na partida o banco é `$2F`, e nas telas de menu e de resultado, `$30`.

- [ ] **Step 6: Rodar tudo**

Run:
```sh
cd web && npx vitest run && npx tsc --noEmit && npm run build && ls dist/assets | grep worklet
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/audio
```
Expected:
- tudo verde; `worklet-….js` presente;
- com a ROM, todos os testes de áudio passam, inclusive `golden-host` e `perf`.

- [ ] **Step 7: Verificação auditiva manual (aceite da §11)**

Run: `cd web && npm run dev`, abrir o endereço, carregar a ROM e clicar. Conferir, comparando com `analise/extraido/audio/*.wav` e com o jogo:

| Tela / evento | Esperado |
|---|---|
| Título | música `$01` |
| Menus do Battle | música `$12`; cursor `$01`, confirmar `$02`, voltar `$03` |
| Fase → partida | `$02`, jingle `$13` (+48 f), voz "BATTLE START!" `$07` (+208), fade, banco `$2F`, música `$14` (≈ 1,1 s depois do pedido) |
| Partida | bomba `$0C`, explosão `$07` (5 bombas encadeadas soam em 5 frames seguidos), item `$08`, caveira `$0A`, passos `$0B`, chute `$0D`, soco `$0D` + voz, luva `$0E` + voz, morte (voz `$06` e depois `$10`) |
| 1:00 | SFX `$15` + voz "HURRY!" `$10`; `$27` a cada bloco de pressão |
| Vitória da rodada | `$17`, fade, banco `$30`, placar `$15`; a próxima rodada volta a `$2F` + `$14` sem o `$13` |
| TIME UP | a música corta (sem apito), fade, `$18` e voz `$0E` |
| VICTORY | `$16` e voz `$0A` |
| Pausa | `$04` |
| Arenas 2 e 8 | aviso `$26`; freio `$27` |
| Opções: volume | música/efeitos a 0 silencia; o ganho segue o maior dos dois |
| Sem ROM | silêncio total, sem erros no console |

Anote no PR o que foi ouvido e a taxa do contexto (32 kHz ou reamostrado).

- [ ] **Step 8: Commit**

```sh
cd web && git add src/audio/factory.ts src/audio/register.ts src/main.ts tests/audio/factory.test.ts
git commit -m "feat(audio): liga o som original ao jogo (fábrica do sink e eventos registrados no plano 10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Integração com os outros planos (o que cada um precisa saber)

- **Plano 5:**
  - consumidos: `AudioSink` e `NoopSink` (classe) de `src/audio/sink.ts`, `romState.assets.rom` (com `bytes(endereço, n)`) e `onRomChange`, este indiretamente, pelo plano 10;
  - o `AudioRomSlices`/`audioData()` não é usado: as fatias são lidas pelo `RomView`, por `slicesFromView`, com os mesmos intervalos da §2.3.
- **Plano 10** (já previsto no plano dele: R25, R26, T22):
  - o `AudioDirector` é o *proxy* (lembra banco e música, repassa volume, chama `tick()`);
  - o plano 11 só registra, com `registerAudioFactory` e `setGameEventAudio`, por 1 linha no `main.ts`: `import './audio/register'`;
  - para os atrasos do acerto, o `tick()` do director precisa rodar 1× por tick de jogo durante a partida.
- **Planos 8 e 9:** `STAGE_SFX` e `MOUNT_SFX` entram como tabelas no `BattleAudio`. Ids novos com som só precisam entrar nessas tabelas.

## Decisões sobre lacunas da spec

| # | Lacuna | Decisão |
|---|---|---|
| D1 | §8.1 pede `snes_spc` em WASM, sem toolchain | APU em TS: SMP nosso (a) + porte LGPL só do `SPC_DSP` (b). `vendor/snes_spc/` guarda licença, aviso e fonte C++ correspondente. `public/audio/` sem uso. WASM via `@yowasp/clang` vira plano B (Riscos) |
| D2 | A16: licença "do pacote inteiro" | Só o `SPC_DSP.cpp/.h` é usado, e o cabeçalho diz LGPL-2.1+. O resto do snes_spc e o snes9x (não comercial) não entram no jogo; o snes9x só serve à ferramenta local de testes |
| D3 | Modelo de tempo do SMP e corridas do host | Instruções atômicas + regras (a) e (b) do host, iguais no TS e na referência. Validado: RAM da §10.2 exata e áudio igual ao do jogo (+1.290,9 ms constante, r = 1,00000) |
| D4 | IPL de 64 bytes | Entra no código (`apu/ipl.ts`). É firmware do hardware do SNES (documentado na fullsnes), não dado da Hudson/Konami (§1.2.2 fala de ROM do jogo) |
| D5 | Onde ficam fixtures, scripts e ferramenta | `tests/fixtures/rom/audio-*.json` (prefixo do plano 11, como §10.1), `scripts/audio-golden/` e `analise/investigacao/audio/spctrace*` |
| D6 | Como as telas chegam ao sink | Pelo `AudioDirector` do plano 10: a fábrica (`registerAudioFactory`) e os eventos (`setGameEventAudio`) são registrados em `src/audio/register.ts`, importado por 1 linha no `main.ts` |
| D7 | Sons das arenas e montarias (§3.15 "ver lá") | Tabelas `STAGE_SFX` (plano 8) e `MOUNT_SFX` (plano 9) injetadas no `BattleAudio`; também vale um campo numérico `sfx`/`voice` no evento |
| D8 | Flag `$CA` ("descarta tudo menos `$13`") | Implementado no `RomAudioSink.dropAllButSfx13` e testado. Não é ligado (quando o jogo o liga não foi medido; `$13` não é usado no Battle) |
| D9 | Estouro da fila de 64 | Descarta o novo (🟡) |
| D10 | STOP durante uma voz em stream | Mantém o comportamento do `spchost`: STOP zera pendentes, e o stream já iniciado termina de ser enviado |
| D11 | `AudioRomSlices` do plano 5 × fatias do plano 11 | O plano 11 lê as fatias pelo `RomView.bytes`. Mesmos intervalos, sem depender do formato `{cpu, data}` |
| D12 | Reamostragem | Primeiro `AudioContext({ sampleRate: 32000 })` (o navegador reamostra); senão, Hermite no worklet |
| D13 | "PCM determinístico" (§11) | Mais forte que determinismo: hash **igual ao da referência** (bit a bit) por segundo, nos roteiros `batalha` e `fluxo` |
| D14 | Intervalos de `nextRound`/`allDeadDraw` | Provisórios: 12 f entre banco e música, e os mesmos intervalos do TIME UP (🟡) |
| D15 | Orçamento do stream (A16) | O do `spchost`, 4 pedaços no 1º de cada 4 NMIs e 1 nos outros (🟡); só muda com medição nova |
| D16 | Volume separado de música e efeitos (R25 do plano 10) | O DSP entrega um sinal só. Ganho geral = `max(música, efeitos)` num `GainNode` |
| D17 | Ovos (`$30–$3F`) em `item_picked` | SFX `$08` |

## Aceite do plano (§11, linha 11)

| Critério | Onde | Comando |
|---|---|---|
| Golden da RAM do APU (§10.2): driver 10.295 (10.075 + 220), `$2E` 5.366, `$2F` 4.515, seq. `$14` 4.064, DIR 144, samples 31.158, 0 diferenças | T6 `golden-host.test.ts` | `SB4_ROM=… npx vitest run tests/audio/golden-host.test.ts` |
| Fila de 1 SFX por tick (5 explosões no mesmo tick → 5 ticks) | T9 `rom-sink.test.ts`; 1 por NMI no worklet: T7 | `npx vitest run tests/audio/rom-sink.test.ts tests/audio/engine.test.ts` |
| STOP antes de música e bloco | T4 `host.test.ts` (`$13`, `$93` antes do `$10`) | `npx vitest run tests/audio/host.test.ts` |
| Banco certo por tela | T10 `cues.test.ts` (banco × música/voz em todos os roteiros) + conferência da T11 (Step 5) contra as *cues* do plano 10 | `npx vitest run tests/audio/cues.test.ts` |
| Voz ignorada com stream ativo | T4 (host), T7 (motor) e roteiro `fluxo` (voz `$06` durante a `$10`) | `npx vitest run tests/audio/host.test.ts tests/audio/engine.test.ts` |
| PCM determinístico: hash do 1º segundo da `$14` a partir do `boot` = referência | T6 `batalha`, `pcmSha1PerSecond[0]` = `26d26780f5dd5cc3570322db3c894598f17fc93d` | `SB4_ROM=… npx vitest run tests/audio/golden-host.test.ts` |
| Verificação auditiva manual contra o jogo | T11, Step 7 | `npm run dev` |
| Geral | `npm test` e `npm run build` verdes; `npx tsc --noEmit` limpo; worklet em *chunk* separado | `npx vitest run && npx tsc --noEmit && npm run build` |

## Riscos

- **Desempenho do TS no AudioWorklet.** A emulação precisa rodar acima do tempo real, no pior caso durante o upload de música (geradores com *yield* a cada 8 ciclos). O teste da T6 exige ≥ 2× no Node; a meta é ≥ 10×. Se não chegar lá:
  1. otimizar o `smp-ops` (switch plano, sem *closures*) e o DSP (sem alocação por amostra);
  2. fazer o motor rodar o host em lotes maiores de ciclos quando não há porta a esperar;
  3. plano B: compilar o mesmo SMP/DSP para WASM com `@yowasp/clang` (npm), mantendo os mesmos goldens.
- **SMP "da documentação".** A ordem dos acessos vem de um gabarito medido na referência, e não de um documento. O teste de padrão e os 4.064 casos pegam qualquer desvio. Divergências só em ciclos internos (`i`) não alteram o PCM, mas o gabarito exige igualdade total; não relaxe o teste.
- **Porte do DSP.** Um erro sutil (cast, ordem de fases) aparece como hash diferente. As 6 cenas separam envelope, eco, ruído/PMOD e KON/KOFF fora de fase. Use `first` e o índice da 1ª amostra diferente.
- **Vite + AudioWorklet em dev.** `?worker&url` serve o módulo com `import` em dev. Se algum navegador recusar, a saída é carregar o *chunk* do build (`npm run build && npm run preview`) ou montar o worklet com `?url` a partir de um `.js` gerado.
- **Latência.** A música `$14` começa ≈ 1,1–1,3 s depois do pedido, igual ao jogo (o upload leva 1,13 s de APU). Não é defeito. O plano 10 pede a música no mesmo frame do jogo.
- **Corridas do host em outras telas.** As regras (a) e (b) foram validadas nos roteiros `batalha` e `fluxo` (todas as operações: boot, bancos `$2F`/`$30`, músicas `$01`, `$12`–`$16`, `$18`, SFX, vozes, fade e STOP). Um `HostTimeout` em uso real deixa o motor mudo (`broken`), sem travar o jogo, e aparece nas estatísticas em dev.
- **Licença.** O jogo passa a distribuir código LGPL (o DSP portado), no *chunk* do worklet. Cumprir o `NOTICE.txt` (fonte no repositório, módulo substituível) antes de publicar.
- **Nomes dos outros planos.** `registerAudioFactory`, `setGameEventAudio`, `romState.assets.rom`, `STAGE_SFX` e `MOUNT_SFX` foram lidos dos planos 5, 8, 9 e 10 escritos em paralelo. Se mudarem no merge, só os imports do `register.ts` mudam; a lógica testada (`factory.ts`, `events.ts`) é injetada.
