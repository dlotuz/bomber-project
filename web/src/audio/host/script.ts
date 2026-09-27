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
