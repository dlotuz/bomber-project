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
