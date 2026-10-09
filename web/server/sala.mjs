// Servidor da sala online: serve o jogo (web/dist) e, em /ws, as salas por WebSocket. Lockstep: cada navegador roda o
// mesmo núcleo determinístico; o servidor só repassa a sala (nomes, personagens, regras) e, na partida, os botões de cada
// jogador por tick. Uso: node server/sala.mjs  (PORT, padrão 8787; npm run sala sobe junto o túnel público).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { MIN_DELAY, RTT_WINDOW, rttOf, delaysFor } from './delay.mjs';

const DIST = process.env.SALA_DIST ? join(process.env.SALA_DIST, '/') : fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
/** Atraso de entrada (ticks): o botão apertado no tick T vale no T + atraso em todos os navegadores. Fixo com
 *  SALA_DELAY; senão escolhido no início da partida pelo ping medido de cada um (delayFor). */
const FIXED_DELAY = process.env.SALA_DELAY ? Number(process.env.SALA_DELAY) : null;
/** Atraso do início da partida (os ticks 0..atraso−1 rodam sem botões em todos): o maior entre os jogadores. */
function delayFor(room) {
  const ds = delaysFor(room.peers, FIXED_DELAY);
  return Math.max(...[...room.peers].map(p => ds[p.slot] ?? MIN_DELAY), MIN_DELAY);
}
/** A cada 2 s: o ping de cada vaga e o atraso de cada um (na partida o navegador anda 1 tick por vez até ele). */
function broadcastNet(room) {
  const pings = [null, null, null, null, null];
  for (const p of room.peers) if (p.slot >= 0) { const r = rttOf(p); pings[p.slot] = r === null ? null : Math.round(r); }
  const msg = JSON.stringify({ t: 'net', pings, delays: delaysFor(room.peers, FIXED_DELAY) });
  for (const p of room.peers) if (p.ws.readyState === 1) p.ws.send(msg);
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  '.dat': 'application/octet-stream', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const http = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(normalize(DIST))) { res.writeHead(403).end(); return; }
    if (path.endsWith('/') || !(await stat(file).catch(() => null))?.isFile()) file = join(DIST, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('não encontrado (rode npm run build antes)');
  }
});

// ------------------------------------------------------------------------------------------------------------- salas

/** @type {Map<string, Room>} */
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}
/**
 * @typedef {{ ws: import('ws').WebSocket, name: string, slot: number }} Peer
 * @typedef {{ code: string, host: Peer, peers: Set<Peer>, lobby: Lobby, game: null | { last: number[], delay: number } }} Room
 * @typedef {{ stage: number, mode: 'ffa' | 'team', teams: number[], slots: ('human'|'cpu'|'off')[], chars: number[],
 *   names: string[], rules: { cpuLevel: number, matches: number, timeIdx: number, suddenDeath: boolean, badBomber: boolean } }} Lobby
 */
function newLobby() {
  return {
    stage: 1, mode: 'ffa', teams: [0, 1, 0, 1, 0], slots: ['human', 'cpu', 'cpu', 'off', 'off'], chars: [0, 1, 2, 3, 4],
    names: ['', '', '', '', ''], rules: { cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false },
    powerKey: [false, false, false, false, false],
  };
}
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
function broadcastRoom(room) {
  for (const p of room.peers) send(p.ws, { t: 'room', code: room.code, you: p.slot, host: p === room.host, lobby: room.lobby, playing: !!room.game });
}
const clampInt = (v, min, max, def) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : def);
const cleanName = n => String(n ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 12).trim();

/** Primeira vaga sem humano (CPU ou vazia) vira do novo jogador. */
function takeSlot(room) {
  for (let s = 0; s < 5; s++) if (room.lobby.slots[s] !== 'human') { room.lobby.slots[s] = 'human'; return s; }
  return -1;
}

function leave(peer) {
  const room = peer.room;
  if (!room) return;
  peer.room = null;
  room.peers.delete(peer);
  if (peer === room.host || room.peers.size === 0) {
    for (const p of room.peers) { send(p.ws, { t: 'closed', msg: 'O anfitrião saiu; a sala foi fechada.' }); p.room = null; }
    rooms.delete(room.code);
    return;
  }
  if (room.game) {
    // na partida: a vaga vira CPU a partir do tick seguinte ao último botão repassado dela (o mesmo em todos). Nenhum
    // navegador passou desse tick (faltava o botão dela), nem do tick `delay` (o 1º que espera botões).
    const at = Math.max(room.game.last[peer.slot] + 1, room.game.delay);
    for (const p of room.peers) send(p.ws, { t: 'drop', s: peer.slot, k: at });
    room.lobby.slots[peer.slot] = 'cpu';
  } else {
    room.lobby.slots[peer.slot] = 'off';
  }
  room.lobby.names[peer.slot] = '';
  room.lobby.powerKey[peer.slot] = false;
  broadcastRoom(room);
}

const wss = new WebSocketServer({ server: http, path: '/ws' });
wss.on('connection', ws => {
  /** @type {Peer & { room: Room | null }} */
  const peer = { ws, name: '', slot: -1, room: null, rtts: [] };
  ws.on('message', data => {
    let m;
    try { m = JSON.parse(String(data)); } catch { return; }
    const room = peer.room;
    switch (m.t) {
      case 'create': {
        if (room) return;
        const r = { code: newCode(), host: peer, peers: new Set([peer]), lobby: newLobby(), game: null };
        rooms.set(r.code, r);
        peer.room = r; peer.slot = 0; peer.name = cleanName(m.name) || 'P1';
        r.lobby.names[0] = peer.name;
        broadcastRoom(r);
        break;
      }
      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.code ?? '').toUpperCase());
        if (!r) { send(ws, { t: 'error', msg: 'Sala não encontrada.' }); return; }
        if (r.game) { send(ws, { t: 'error', msg: 'A partida já começou; espere ela acabar.' }); return; }
        const s = takeSlot(r);
        if (s < 0) { send(ws, { t: 'error', msg: 'A sala está cheia (5 jogadores).' }); return; }
        r.peers.add(peer); peer.room = r; peer.slot = s; peer.name = cleanName(m.name) || `P${s + 1}`;
        r.lobby.names[s] = peer.name; r.lobby.powerKey[s] = false;
        broadcastRoom(r);
        break;
      }
      case 'power': {  // cada um informa se o CONTROLE ONLINE dele tem tecla própria do P
        if (!room || room.game) return;
        room.lobby.powerKey[peer.slot] = !!m.on;
        broadcastRoom(room);
        break;
      }
      case 'char': {   // cada um escolhe o próprio personagem
        if (!room || room.game) return;
        room.lobby.chars[peer.slot] = clampInt(m.c, 0, 5, room.lobby.chars[peer.slot]);
        broadcastRoom(room);
        break;
      }
      case 'lobby': {  // só o anfitrião: arena, regras, vagas sem humano (CPU/vazia), times e personagens das CPUs
        if (!room || room.game || peer !== room.host) return;
        const L = room.lobby, n = m.lobby ?? {};
        L.stage = clampInt(n.stage, 1, 13, L.stage);   // 11 a 13: cópias da 1 com outras cores (src/game/stages.ts)
        L.mode = n.mode === 'team' ? 'team' : 'ffa';
        if (Array.isArray(n.slots)) n.slots.forEach((k, s) => { if (s < 5 && L.slots[s] !== 'human' && (k === 'cpu' || k === 'off')) L.slots[s] = k; });
        if (Array.isArray(n.teams)) n.teams.forEach((v, s) => { if (s < 5) L.teams[s] = v === 1 ? 1 : 0; });
        if (Array.isArray(n.chars)) n.chars.forEach((c, s) => { if (s < 5 && L.slots[s] !== 'human') L.chars[s] = clampInt(c, 0, 5, L.chars[s]); });
        const r = n.rules ?? {};
        L.rules = {
          cpuLevel: clampInt(r.cpuLevel, 0, 2, L.rules.cpuLevel), matches: clampInt(r.matches, 1, 5, L.rules.matches),
          timeIdx: clampInt(r.timeIdx, 0, 4, L.rules.timeIdx), suddenDeath: !!r.suddenDeath, badBomber: !!r.badBomber,
        };
        broadcastRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.game || peer !== room.host) return;
        if (room.lobby.slots.filter(k => k !== 'off').length < 2) { send(ws, { t: 'error', msg: 'Precisa de pelo menos 2 jogadores (humanos ou CPU).' }); return; }
        room.game = { last: [-1, -1, -1, -1, -1], delay: 0 };
        const seed = randomInt(0x10000);
        // regras extras das Opções do anfitrião (luva, arremesso, soneca, montarias, spawns): iguais para todos
        const x = m.extras ?? {};
        const extras = {
          gloveEscape: clampInt(x.gloveEscape, 1, 30, 10), throwStun: !!x.throwStun, sleepTicks: clampInt(x.sleepTicks, 0, 3600, 180),
          allMounts: x.allMounts !== false, randomSpawns: !!x.randomSpawns,
        };
        const delay = room.game.delay = delayFor(room);
        console.log(`sala ${room.code}: partida com ${room.peers.size} jogador(es), atraso ${delay} ticks`);
        for (const p of room.peers) send(p.ws, { t: 'start', lobby: room.lobby, seed, delay, you: p.slot, extras });
        broadcastRoom(room);
        break;
      }
      case 'in': {     // botões do tick k (já com o atraso) — repassa aos outros
        if (!room?.game || !Number.isInteger(m.k)) return;
        room.game.last[peer.slot] = Math.max(room.game.last[peer.slot], m.k);
        const out = JSON.stringify({ t: 'in', s: peer.slot, k: m.k, b: m.b | 0 });
        for (const p of room.peers) if (p !== peer && p.ws.readyState === 1) p.ws.send(out);
        break;
      }
      case 'hash': {   // conferência de dessincronização: repassa
        if (!room?.game) return;
        for (const p of room.peers) if (p !== peer) send(p.ws, { t: 'hash', s: peer.slot, k: m.k, h: m.h });
        break;
      }
      case 'end': {    // fim da partida (o anfitrião avisa): volta todo mundo para a sala
        if (!room?.game || peer !== room.host) return;
        room.game = null;
        broadcastRoom(room);
        break;
      }
      case 'ping': send(ws, { t: 'pong', c: m.c }); break;   // o navegador mede o ping e manda em 'rtt'
      case 'rtt': if (Number.isFinite(m.ms) && m.ms >= 0) { peer.rtts.push(m.ms); if (peer.rtts.length > RTT_WINDOW) peer.rtts.shift(); } break;
      case 'leave': leave(peer); break;
      default: break;
    }
  });
  ws.on('close', () => leave(peer));
});

setInterval(() => { for (const room of rooms.values()) broadcastNet(room); }, 2000).unref();

http.listen(PORT, () => console.log(`sala: http://localhost:${PORT}/  (WebSocket em /ws, atraso ${FIXED_DELAY ?? 'pelo ping'}${FIXED_DELAY !== null ? ' ticks' : ''})`));
