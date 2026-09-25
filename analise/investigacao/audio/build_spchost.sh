#!/bin/zsh
# compila o spchost (PoC) contra o SMP/DSP do snes9x (cópia em scratchpad/rom-audio/snes9x)
S=/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/rom-audio/snes9x
O=/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/rom-audio/spchost
FL=(-I$S -I$S/apu -I$S/apu/bapu -I$S/libretro -I$S/libretro/libretro-common/include -std=c++14 -O2 -DRIGHTSHIFT_IS_SAR -D__LIBRETRO__ -DHAVE_STDINT_H -DHAVE_STRINGS_H -fno-rtti -fno-exceptions -w)
H=${0:A:h}; mkdir -p $O; cd $O
[ -f smp.o ] || c++ $FL -c $S/apu/bapu/smp/smp.cpp -o smp.o
[ -f smp_state.o ] || c++ $FL -c $S/apu/bapu/smp/smp_state.cpp -o smp_state.o
[ -f sdsp.o ] || c++ $FL -c $S/apu/bapu/dsp/sdsp.cpp -o sdsp.o
c++ $FL "$H/spchost.cpp" smp.o smp_state.o sdsp.o -o spchost
