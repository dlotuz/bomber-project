// Lockstep da sala online: todos os navegadores rodam o mesmo App com a mesma entrada por tick. O botão local apertado
// no tick T vale no tick T + delay (o tempo de ele chegar aos outros); o tick só roda quando os botões de todos os
// humanos ainda na partida chegaram. Os ticks 0..delay−1 rodam sem botões. Determinístico: nada aqui lê o relógio.
import type { MenuInput } from '../input/input';

export interface LockstepTick { input: MenuInput; dropped: number[] }

export class Lockstep {
  /** Próximo tick a rodar. */
  tick = 0;
  private readonly table = new Map<number, (number | undefined)[]>();
  private readonly dropAt: (number | null)[] = [null, null, null, null, null];
  private prev = [0, 0, 0, 0, 0];
  private sentUpTo = -1;
  /** Maior tick já recebido de cada jogador (até onde ele já chegou: o tick dele + atraso). */
  private readonly newest = [-1, -1, -1, -1, -1];

  /** `humans[s]`: a vaga s é de um jogador humano (o local, `me`, ou remoto) cujos botões a partida espera. */
  constructor(readonly delay: number, readonly me: number, private readonly humans: readonly boolean[]) {}

  /** Botões locais lidos agora: valem no tick + delay. Devolve o que mandar aos outros (null = esse tick já foi). */
  local(bits: number): { k: number; b: number } | null {
    const k = this.tick + this.delay;
    if (k <= this.sentUpTo) return null;
    this.sentUpTo = k;
    this.at(k)[this.me] = bits;
    return { k, b: bits };
  }

  /** Botões de outro jogador para o tick k. */
  remote(slot: number, k: number, bits: number): void {
    this.newest[slot] = Math.max(this.newest[slot], k);
    if (k >= this.tick) this.at(k)[slot] = bits;
  }

  /** Todos os outros jogadores esperados já estão pelo menos 2 ticks à frente deste navegador (ficou para trás: pode
   *  rodar um tick a mais neste passo para alcançá-los). Sem outros jogadores, nunca. */
  behind(): boolean {
    const others = [0, 1, 2, 3, 4].filter(s => s !== this.me && this.awaited(s));
    return others.length > 0 && others.every(s => this.newest[s] >= this.tick + this.delay + 2);
  }

  /** O jogador da vaga saiu: a partir do tick k, ela não é mais esperada (vira CPU em quem roda a partida). */
  drop(slot: number, k: number): void { this.dropAt[slot] = k; }

  /** Vagas que ainda faltam para rodar o tick atual (vazio = pronto). */
  missing(): number[] {
    if (this.tick < this.delay) return [];
    const row = this.table.get(this.tick);
    return [0, 1, 2, 3, 4].filter(s => this.awaited(s) && row?.[s] === undefined);
  }

  /** A entrada do tick atual, se todos os botões chegaram (e avança); senão null. */
  next(): LockstepTick | null {
    if (this.missing().length) return null;
    const row = this.table.get(this.tick) ?? [];
    const dropped = [0, 1, 2, 3, 4].filter(s => this.dropAt[s] === this.tick);
    const pads = [0, 1, 2, 3, 4].map(s => (this.humans[s] && this.awaited(s) ? row[s] ?? 0 : 0));
    const pressed = pads.map((b, s) => b & ~this.prev[s]);
    this.prev = pads;
    this.table.delete(this.tick);
    this.tick++;
    return {
      dropped,
      input: {
        pads, pressed, any: pads.reduce((a, b) => a | b, 0), pressedAny: pressed.reduce((a, b) => a | b, 0), key: null,
        connected: [true, true, true, true, true], esc: false, padButton: null,
      },
    };
  }

  private awaited(s: number): boolean {
    return this.humans[s] && (this.dropAt[s] === null || this.tick < this.dropAt[s]!);
  }

  private at(k: number): (number | undefined)[] {
    let row = this.table.get(k);
    if (!row) { row = [undefined, undefined, undefined, undefined, undefined]; this.table.set(k, row); }
    return row;
  }
}
