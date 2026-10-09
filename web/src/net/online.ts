// Cliente da sala online (server/sala.mjs). A tela é screens/online.ts (criar/entrar, vagas, personagens, regras do
// anfitrião); aqui ficam a conexão, o estado da sala e, na partida, o lockstep — o App inteiro (batalha, placar, empate,
// vitória, pausa) roda com a entrada combinada de todos, tick a tick, em cada navegador. Quando a partida termina (tela
// de fase ou título), todo mundo volta para a tela da sala.
import type { App } from '../app/app';
import type { SpriteBank } from '../render/sprite-bank';
import { configFromSetup, type SetupLike, type SlotKind } from '../game/config';
import { createMatchSession, type MatchSession } from '../game/match-session';
import { battleScreen } from '../screens/battle';
import { onlineScreen } from '../screens/online';
import { BANK, MUSIC } from '../app/audio';
import { hashState } from '../core/hash';
import { drawText } from '../render/text/text';
import { S } from '../render/text/strings';
import { Lockstep } from './lockstep';
import { standing } from '../core/state';
import { entX, entY } from '../render/fx/coords';
import { PLAYER_COLORS } from '../render/draw-game';
import { BTN } from '../core/types';
import { hasPowerKey } from '../input/input';

export interface Lobby {
  stage: number; mode: 'ffa' | 'team'; teams: number[]; slots: SlotKind[]; chars: number[]; names: string[];
  /** Vaga com tecla/botão próprio do P no CONTROLE ONLINE de quem está nela (cada um informa o seu). */
  powerKey?: boolean[];
  rules: { cpuLevel: 0 | 1 | 2; matches: number; timeIdx: number; suddenDeath: boolean; badBomber: boolean };
}
export interface Room { code: string; you: number; host: boolean; lobby: Lobby; playing: boolean }
interface Extras { gloveEscape: number; throwStun: boolean; sleepTicks: number; allMounts: boolean; randomSpawns: boolean }
type ServerMsg =
  | ({ t: 'room' } & Room)
  | { t: 'start'; lobby: Lobby; seed: number; delay: number; you: number; extras: Extras }
  | { t: 'in'; s: number; k: number; b: number }
  | { t: 'drop'; s: number; k: number }
  | { t: 'hash'; s: number; k: number; h: string }
  | { t: 'pong'; c: number }
  | { t: 'net'; pings: (number | null)[]; delays: number[] }
  | { t: 'error'; msg: string }
  | { t: 'closed'; msg: string };

/** Nome em cima da cabeça: tamanho e altura acima do centro do jogador (px da base), a pé e montado. */
const NAME_SIZE = 7, NAME_UP = 19, NAME_UP_MOUNTED = 27;
/** A cada quantos ticks da batalha os navegadores conferem o estado (hash) entre si. */
const HASH_EVERY = 120;
const NAME_KEY = 'crown-sala-nome';

export class OnlineClient {
  /** Sala em que este navegador está (null = fora de sala). */
  room: Room | null = null;
  /** Conectando ao servidor (antes da 1ª resposta). */
  connecting = false;
  /** Última mensagem para o jogador (erro, sala fechada, conexão caiu); a tela mostra no rodapé. */
  message = '';
  desync: string | null = null;
  /** Ping até o servidor da sala, em ms (média móvel; null sem conexão). O contador do topo da tela mostra. */
  ping: number | null = null;
  /** Ping de cada vaga até a sala (o servidor manda a cada 2 s; null = vaga sem humano ou sem medida). */
  pings: (number | null)[] = [null, null, null, null, null];
  private ws: WebSocket | null = null;
  private ls: Lockstep | null = null;
  private ms: MatchSession | null = null;
  private stalled = 0;
  private waitingFor: string[] = [];
  private readonly myHashes = new Map<number, string>();
  private hashed: { round: object | null; tick: number } = { round: null, tick: -1 };   // a pausa repete o tick

  constructor(private readonly app: App) {}

  get playing(): boolean { return this.ls !== null; }
  /** Tick do lockstep (−1 fora da partida). */
  get tick(): number { return this.ls?.tick ?? -1; }

  get name(): string { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } }
  set name(n: string) { try { localStorage.setItem(NAME_KEY, n); } catch { /* sem storage */ } }

  /** Link de convite da sala atual. */
  invite(): string { return this.room ? `${location.origin}${location.pathname}?sala=${this.room.code}` : ''; }

  create(): void { this.connect({ t: 'create', name: this.name }); }
  join(code: string): void { this.connect({ t: 'join', code, name: this.name }); }
  setChar(c: number): void { this.send({ t: 'char', c }); }
  setLobby(patch: Partial<Lobby>): void { if (this.room) this.send({ t: 'lobby', lobby: { ...this.room.lobby, ...patch } }); }
  leave(): void { this.send({ t: 'leave' }); this.ws?.close(); this.ws = null; this.room = null; this.connecting = false; }
  /** Só o anfitrião: começa a partida com as regras extras das Opções dele (iguais para todos). */
  start(): void {
    const o = this.app.settings.options;
    this.send({ t: 'start', extras: { gloveEscape: o.gloveEscape, throwStun: o.throwStun, sleepTicks: o.sleepSec * 60, allMounts: o.allMounts, randomSpawns: o.randomSpawns } });
  }

  /** Avisa a sala se o CONTROLE ONLINE deste jogador tem tecla própria do P (todos montam a partida com a mesma regra). */
  private syncPower(): void {
    const room = this.room;
    if (!room || room.playing || room.you < 0) return;
    const oc = this.app.settings.online;
    const mine = hasPowerKey(oc.device, oc.keymap, oc.padmap);
    if ((room.lobby.powerKey?.[room.you] ?? false) !== mine) this.send({ t: 'power', on: mine });
  }

  // ---------------------------------------------------------------------------------------------------- conexão
  private send(m: object): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  private connect(first: object): void {
    this.message = '';
    this.ws?.close();
    this.connecting = true;
    const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    this.ws = sock;
    sock.onopen = () => {
      sock.send(JSON.stringify(first));
      // ping até a sala (também na partida, para o contador): o servidor escolhe o atraso do lockstep pelo pior par
      const ping = (): void => {
        if (this.ws !== sock || sock.readyState !== WebSocket.OPEN) return;
        this.send({ t: 'ping', c: performance.now() });
        this.syncPower();   // trocou a tecla do P na tela de controles: a sala fica sabendo
        setTimeout(ping, 1000);
      };
      ping();
    };
    sock.onmessage = e => this.receive(JSON.parse(String(e.data)) as ServerMsg);
    sock.onclose = () => {
      if (this.ws !== sock) return;
      this.ws = null; this.connecting = false; this.ping = null; this.pings = [null, null, null, null, null];
      const was = this.room !== null || this.ls !== null;
      this.room = null;
      if (this.ls) this.finish(S.online.lost);
      else if (was) this.message = S.online.lost;
    };
    sock.onerror = () => { if (this.ws === sock && !this.room) { this.message = S.online.noServer; this.connecting = false; } };
  }

  private receive(m: ServerMsg): void {
    switch (m.t) {
      case 'room': this.room = { code: m.code, you: m.you, host: m.host, lobby: m.lobby, playing: m.playing }; this.connecting = false; this.syncPower(); break;
      case 'pong': {
        const ms = performance.now() - m.c;
        this.ping = this.ping === null ? ms : 0.7 * this.ping + 0.3 * ms;
        this.send({ t: 'rtt', ms });
        break;
      }
      case 'error': this.message = m.msg.toUpperCase(); this.connecting = false; break;
      case 'closed': this.room = null; this.message = m.msg.toUpperCase(); if (this.ls) this.finish(this.message); break;
      case 'start': this.begin(m); break;
      case 'in': this.ls?.remote(m.s, m.k, m.b); break;
      case 'net': {   // ping de todos e o atraso de cada um, recalculados pelo servidor
        this.pings = m.pings;
        if (this.ls) { this.ls.setDelays(m.delays); this.ls.setDelay(m.delays[this.ls.me]); }
        break;
      }
      case 'drop': this.ls?.drop(m.s, m.k); break;
      case 'hash': {
        const mine = this.myHashes.get(m.k);
        if (mine !== undefined && mine !== m.h && !this.desync) {
          this.desync = S.online.desync;
          console.warn(`Crown Blast (sala): estados diferentes no tick ${m.k} (jogador ${m.s + 1}).`);
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------- partida
  private begin(m: Extract<ServerMsg, { t: 'start' }>): void {
    const L = m.lobby, x = m.extras;
    const setup: SetupLike = { mode: L.mode, slots: L.slots, teams: L.teams, chars: L.chars, stage: L.stage, rules: { ...L.rules, racer: false } };
    // todos com a mesma configuração: semente do servidor, dispositivos neutros (sem pausa por controle desconectado)
    const cfg = configFromSetup(setup, x.randomSpawns, ['kb', 'kb', 'kb', 'kb', 'kb'], m.seed, {
      gloveEscape: x.gloveEscape, throwStun: x.throwStun, sleepTicks: x.sleepTicks, allMounts: x.allMounts,
      powerKey: [0, 1, 2, 3, 4].map(s => !!L.powerKey?.[s] && L.slots[s] === 'human'),
    });
    this.ls = new Lockstep(m.delay, m.you, cfg.humans);
    this.ms = createMatchSession(cfg);
    this.myHashes.clear(); this.desync = null; this.stalled = 0; this.hashed = { round: null, tick: -1 };
    this.app.audio.bank(BANK.battle);
    this.app.audio.music(MUSIC.battle);
    this.app.go(battleScreen(this.app, this.ms));
  }

  private finish(why: string | null): void {
    if (this.room?.host && this.ws) this.send({ t: 'end' });
    this.ls = null; this.ms = null; this.waitingFor = [];
    if (why) this.message = why;
    this.app.audio.fade();
    this.app.go(onlineScreen(this.app));
  }

  /** Um passo do loop na partida: manda o botão local (`bits`, do controle da sala online) e roda o tick quando os de
   *  todos chegaram. */
  step(bits: number): void {
    const ls = this.ls;
    if (!ls) return;
    // até 2 ticks por passo: o 2º só se este navegador ficou para trás de todos os outros (alcança sem passar dos 60 Hz)
    // sem pausa na sala online: o START de ninguém (nem do anfitrião) vale na batalha
    if (this.app.screen.id === 'battle') bits &= ~BTN.START;
    for (let n = 0; n < 2; n++) {
      for (const out of ls.local(bits)) this.send({ t: 'in', k: out.k, b: out.b });
      const t = ls.next();
      if (!t) {
        if (n === 0 && ++this.stalled > 20) this.waitingFor = ls.missing().map(s => this.room?.lobby.names[s] || `${s + 1}P`);
        return;
      }
      this.stalled = 0; this.waitingFor = [];
      if (this.ms) for (const s of t.dropped) this.ms.cfg.humans[s] = false;   // saiu: a CPU assume a vaga (mesmo tick em todos)
      this.app.update(t.input);
      const round = this.ms?.round;
      if (this.app.screen.id === 'battle' && round && round.tick % HASH_EVERY === 0
        && (round !== this.hashed.round || round.tick !== this.hashed.tick)) {
        this.hashed = { round, tick: round.tick };
        const h = hashState(round);
        this.myHashes.set(ls.tick, h);
        this.send({ t: 'hash', k: ls.tick, h });
      }
      if (this.app.screen.id === 'stage' || this.app.screen.id === 'title') { this.finish(null); return; }
      if (!ls.behind()) return;
    }
  }

  /** Avisos da partida por cima do jogo: esperando alguém (rede) ou dessincronização. */
  drawOverlay(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    if (!this.ls) return;
    const text = this.waitingFor.length ? S.online.waiting(this.waitingFor.join(', ')) : this.desync;
    if (!text) return;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 256, 11);
    drawText(ctx, bank, 'ascii8', text, 128, 2, { align: 'center', bare: true });
  }

  /** Nome de cada humano em cima da cabeça, na partida: desenhado na tela de saída em resolução nativa (nítido em
   *  qualquer escala), depois do `present` — `L` = onde a imagem do jogo está (escala e deslocamento). */
  drawNames(out: CanvasRenderingContext2D, L: { sx: number; sy: number; ox: number; oy: number }): void {
    const round = this.ms?.round, room = this.room;
    if (!this.ls || !round || !room || this.app.screen.id !== 'battle') return;
    const size = NAME_SIZE * L.sy;
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.font = `700 ${size}px "Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif`;
    out.textAlign = 'center';
    out.textBaseline = 'bottom';
    out.lineJoin = 'round';
    for (const p of round.players) {
      const name = room.lobby.names[p.slot];
      if (!name || !this.ms!.cfg.humans[p.slot] || !standing(p)) continue;
      const x = L.ox + entX(p.x) * L.sx;
      const y = L.oy + (entY(p.y) - (p.z ?? 0) - (p.mount ? NAME_UP_MOUNTED : NAME_UP)) * L.sy;
      out.strokeStyle = 'rgba(0,0,0,0.85)'; out.lineWidth = size * 0.28;
      out.strokeText(name, x, y);
      out.fillStyle = PLAYER_COLORS[p.slot];
      out.fillText(name, x, y);
    }
    out.restore();
  }

  /** Ping de cada humano na sala, para o contador do topo ("1P 3 · 2P 80"): só fora de vaga vazia. */
  peerPings(): { slot: number; ms: number }[] {
    const room = this.room;
    if (!room) return [];
    return this.pings.flatMap((ms, slot) => (ms !== null && room.lobby.slots[slot] === 'human' ? [{ slot, ms }] : []));
  }

  /** Diagnóstico (scripts/sala-e2e.mjs e console). */
  hash(k: number): string | null { return this.myHashes.get(k) ?? null; }
  hashes(): number[] { return [...this.myHashes.keys()]; }
}

let client: OnlineClient | null = null;
/** Cria o cliente da sala (main.ts, uma vez). */
export function initOnline(app: App): OnlineClient {
  const c = new OnlineClient(app);
  client = c;
  if (typeof window === 'undefined') return c;   // testes no Node
  (window as unknown as { __sala: unknown }).__sala = {
    get tick() { return c.tick; }, get screen() { return app.screen.id; }, get desync() { return c.desync; },
    get code() { return c.room?.code ?? null; }, hash: (k: number) => c.hash(k), get hashes() { return c.hashes(); },
    get message() { return c.message; },
    get paused() { return (app.screen as { paused?: boolean }).paused ?? false; },
    get powerKey() { return c.room?.lobby.powerKey ?? null; },
  };
  return c;
}
/** O cliente da sala (as telas usam). */
export function online(): OnlineClient {
  if (!client) throw new Error('sala online sem initOnline');
  return client;
}
