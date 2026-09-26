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
