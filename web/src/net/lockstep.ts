// Lockstep da sala online: todos os navegadores rodam o mesmo App com a mesma entrada por tick. O botão local apertado
// no tick T vale no tick T + delay (o tempo de ele chegar aos outros); o tick só roda quando os botões de todos os
// humanos ainda na partida chegaram. Os ticks 0..start−1 rodam sem botões. Determinístico: nada aqui lê o relógio.
//
// O atraso de cada um pode ser diferente e mudar durante a partida (o servidor recalcula pelo ping, `setDelay`): ele só
// decide em que tick o botão LOCAL vale, e cada botão viaja com o seu tick — todos continuam rodando a mesma entrada.
// Ao aumentar, os ticks pulados recebem o mesmo botão (ninguém fica esperando um tick que nunca seria mandado); ao
// diminuir, o tick já mandado vale e os botões lidos até o novo atraso alcançá-lo são descartados (1 tick por vez).
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

  /** Atraso atual do botão local, em ticks (muda com `setDelay`). */
  delay: number;
  /** Primeiro tick que espera botões (o atraso do início da partida, igual em todos). */
  readonly start: number;
  /** Atraso atual de cada vaga, como o servidor informou (para saber se este navegador ficou para trás). */
  private readonly delays: number[];

  /** `humans[s]`: a vaga s é de um jogador humano (o local, `me`, ou remoto) cujos botões a partida espera. */
  constructor(delay: number, readonly me: number, private readonly humans: readonly boolean[]) {
    this.delay = delay; this.start = delay; this.delays = [delay, delay, delay, delay, delay];
    this.sentUpTo = delay - 1;
  }

  /** Novo atraso do botão local (o servidor manda o alvo pelo ping): anda no máximo 1 tick por chamada, entre 1 e 30. */
  setDelay(target: number): void {
    if (!Number.isFinite(target)) return;
    const t = Math.min(30, Math.max(1, Math.round(target)));
    this.delay += Math.sign(t - this.delay);
    this.delays[this.me] = this.delay;
  }

  /** Atraso atual de cada vaga (o servidor manda junto com o ping de cada um). */
  setDelays(ds: readonly number[]): void {
    ds.forEach((d, s) => { if (s !== this.me && Number.isFinite(d)) this.delays[s] = d; });
  }

  /** Botões locais lidos agora: valem no tick + delay. Devolve o que mandar aos outros — vazio se esse tick já foi
   *  mandado (o atraso diminuiu), mais de um se o atraso aumentou (os ticks pulados levam o mesmo botão). */
  local(bits: number): { k: number; b: number }[] {
    const k = this.tick + this.delay;
    const out: { k: number; b: number }[] = [];
    for (let kk = this.sentUpTo + 1; kk <= k; kk++) { this.at(kk)[this.me] = bits; out.push({ k: kk, b: bits }); }
    if (k > this.sentUpTo) this.sentUpTo = k;
    return out;
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
    return others.length > 0 && others.every(s => this.newest[s] >= this.tick + this.delays[s] + 2);
  }

  /** O jogador da vaga saiu: a partir do tick k, ela não é mais esperada (vira CPU em quem roda a partida). */
  drop(slot: number, k: number): void { this.dropAt[slot] = k; }

  /** Vagas que ainda faltam para rodar o tick atual (vazio = pronto). */
  missing(): number[] {
    if (this.tick < this.start) return [];
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
