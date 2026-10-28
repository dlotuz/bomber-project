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
import { Accounts } from './contas.mjs';
import { CHAR_MAX } from './chars.mjs';

const DIST = process.env.SALA_DIST ? join(process.env.SALA_DIST, '/') : fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
/** Contas (usuário, senha e dados do jogador): JSON em disco; SALA_DATA troca o caminho. */
const accounts = new Accounts(process.env.SALA_DATA ?? fileURLToPath(new URL('./data/contas.json', import.meta.url)));
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
 * @typedef {{ code: string, name: string, password: string, quick: boolean, host: Peer, peers: Set<Peer>, lobby: Lobby,
 *   game: null | { last: number[], delay: number } }} Room
 * @typedef {{ stage: number, mode: 'ffa' | 'team', teams: number[], slots: ('human'|'cpu'|'off')[], chars: number[],
 *   names: string[], rules: { cpuLevel: number, matches: number, timeIdx: number, suddenDeath: boolean, badBomber: boolean } }} Lobby
 */
function newLobby() {
  return {
    stage: 1, mode: 'ffa', teams: [0, 1, 0, 1, 0], slots: ['human', 'cpu', 'cpu', 'off', 'off'], chars: [0, 1, 2, 3, 4],
    names: ['', '', '', '', ''], rules: { cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false },
    powerKey: [false, false, false, false, false],
    ready: [false, false, false, false, false],   // PRONTO de cada jogador (o anfitrião não precisa: é ele quem inicia)
  };
}
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
function broadcastRoom(room) {
  for (const p of room.peers) {
    send(p.ws, { t: 'room', code: room.code, name: room.name, locked: !!room.password, quick: room.quick, hostSlot: room.host.slot, you: p.slot, host: p === room.host, lobby: room.lobby, playing: !!room.game });
  }
}
/** Salas abertas para a lista de JOGAR COM AMIGOS (a partida rapida nao aparece: ja nasce em jogo). */
function roomList() {
  return [...rooms.values()].filter(r => !r.quick).map(r => ({
    code: r.code, name: r.name, players: r.lobby.slots.filter(k => k === 'human').length, max: 5, locked: !!r.password, playing: !!r.game,
  }));
}
/** Regras extras (luva, arremesso, soneca, montarias, spawns) vindas das Opcoes do anfitriao, ou os padroes. */
function cleanExtras(x = {}) {
  return {
    gloveEscape: clampInt(x.gloveEscape, 1, 30, 10), throwStun: !!x.throwStun, sleepTicks: clampInt(x.sleepTicks, 0, 3600, 180),
    allMounts: x.allMounts !== false, randomSpawns: !!x.randomSpawns,
  };
}
/** Comeca a partida da sala: a mesma semente, atraso e regras para todos. */
function startGame(room, extras) {
  room.game = { last: [-1, -1, -1, -1, -1], delay: 0 };
  const seed = randomInt(0x10000);
  const delay = room.game.delay = delayFor(room);
  console.log(`sala ${room.code}${room.quick ? ' (rapida)' : ''}: partida com ${room.peers.size} jogador(es), atraso ${delay} ticks`);
  for (const p of room.peers) send(p.ws, { t: 'start', lobby: room.lobby, seed, delay, you: p.slot, extras });
  broadcastRoom(room);
}
const clampInt = (v, min, max, def) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : def);
const cleanName = n => String(n ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 12).trim();
const cleanPassword = n => String(n ?? '').slice(0, 8);

// ------------------------------------------------------------------------------------------------ partida rapida
/** Fila da partida rapida: com 2 ou mais na fila comeca uma contagem; ao zerar (ou ao chegar em 5) todos jogam. */
const QUICK_WAIT = Number(process.env.SALA_QUICK_WAIT ?? 10);
const QUICK_MAX = 5;
/** Fases que a partida rapida sorteia (as mesmas visiveis da selecao de fase: VISIBLE_STAGES em src/game/stages.ts). */
const QUICK_STAGES = [1, 11, 12, 13, 14, 15, 16, 17, 18];
/** @type {any[]} */
const queue = [];
let queueLeft = null, queueTimer = null;
function queueBroadcast() {
  for (const p of queue) send(p.ws, { t: 'queue', n: queue.length, left: queueLeft });
}
function queueStop() { if (queueTimer) clearInterval(queueTimer); queueTimer = null; queueLeft = null; }
function queueUpdate() {
  if (queue.length >= QUICK_MAX) { queueMatch(); return; }
  if (queue.length >= 2 && queueLeft === null) {
    queueLeft = QUICK_WAIT;
    queueTimer = setInterval(() => { queueLeft = Math.max(0, queueLeft - 1); if (queueLeft === 0) queueMatch(); else queueBroadcast(); }, 1000);
    queueTimer.unref?.();
  } else if (queue.length < 2) queueStop();
  queueBroadcast();
}
function queueMatch() {
  queueStop();
  const group = queue.splice(0, QUICK_MAX).filter(p => p.ws.readyState === 1);
  if (group.length < 2) { queue.unshift(...group); queueUpdate(); return; }
  const lobby = newLobby();
  lobby.stage = QUICK_STAGES[randomInt(QUICK_STAGES.length)];
  lobby.slots = ['off', 'off', 'off', 'off', 'off'];
  const room = { code: newCode(), name: 'PARTIDA RÁPIDA', password: '', quick: true, host: group[0], peers: new Set(group), lobby, game: null };
  rooms.set(room.code, room);
  group.forEach((p, s) => {
    p.room = room; p.slot = s;
    lobby.slots[s] = 'human'; lobby.names[s] = p.name || `P${s + 1}`; lobby.chars[s] = p.char; lobby.powerKey[s] = p.power;
  });
  startGame(room, cleanExtras());
  if (queue.length) queueUpdate();
}
function unqueue(peer) {
  const i = queue.indexOf(peer);
  if (i < 0) return;
  queue.splice(i, 1);
  queueUpdate();
}

/** ALEATORIO na fase da sala (RANDOM_STAGE em src/game/stage-choice.ts). */
const RANDOM_STAGE = 0;
/** Fase e regras vindas do cliente (ao criar a sala e em CONFIGURAÇÕES): valores fora do limite voltam ao atual. */
function applyConfig(L, n = {}) {
  L.stage = clampInt(n.stage, 1, 18, L.stage);   // 11 a 18: cópias da 1 com outras cores/ambientação (src/game/stages.ts)
  if (n.stage === RANDOM_STAGE) L.stage = RANDOM_STAGE;   // ALEATORIO: cada cliente sorteia da semente do 'start' (a mesma)
  const r = n.rules ?? {};
  L.rules = {
    cpuLevel: clampInt(r.cpuLevel, 0, 2, L.rules.cpuLevel), matches: clampInt(r.matches, 1, 5, L.rules.matches),
    timeIdx: clampInt(r.timeIdx, 0, 4, L.rules.timeIdx), suddenDeath: !!r.suddenDeath, badBomber: !!r.badBomber,
  };
}

/** Humanos (fora o anfitrião) que ainda não estão PRONTOS — a partida só começa sem nenhum. CPU não conta. */
export function notReady(room) {
  return [...room.peers].filter(p => p !== room.host && p.slot >= 0 && !room.lobby.ready[p.slot]).map(p => p.slot).sort((a, b) => a - b);
}

/** Primeira vaga sem humano (CPU ou vazia) vira do novo jogador. */
function takeSlot(room) {
  for (let s = 0; s < 5; s++) if (room.lobby.slots[s] !== 'human') { room.lobby.slots[s] = 'human'; return s; }
  return -1;
}

function leave(peer) {
  unqueue(peer);
  const room = peer.room;
  if (!room) return;
  peer.room = null;
  room.peers.delete(peer);
  if (room.peers.size === 0) { rooms.delete(room.code); return; }
  if (peer === room.host) {   // o anfitrião saiu: o jogador de menor vaga assume (na partida, ele manda o fim dela)
    const next = [...room.peers].filter(p => p.slot >= 0).sort((a, b) => a.slot - b.slot)[0];
    if (!next) { rooms.delete(room.code); return; }
    room.host = next;
    for (const p of room.peers) send(p.ws, { t: 'notice', msg: `${next.name || `${next.slot + 1}P`} agora é o anfitrião.` });
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
  room.lobby.ready[peer.slot] = false;
  broadcastRoom(room);
}

const wss = new WebSocketServer({ server: http, path: '/ws' });
wss.on('connection', ws => {
  /** @type {Peer & { room: Room | null }} */
  const peer = { ws, name: '', slot: -1, room: null, rtts: [], char: 0, power: false };
  ws.on('message', data => {
    let m;
    try { m = JSON.parse(String(data)); } catch { return; }
    const room = peer.room;
    switch (m.t) {
      case 'create': {
        if (room) return;
        unqueue(peer);
        const code = newCode();
        const r = { code, name: cleanName(m.roomName) || `SALA ${code}`, password: cleanPassword(m.password), quick: false,
          host: peer, peers: new Set([peer]), lobby: newLobby(), game: null };
        rooms.set(r.code, r);
        peer.room = r; peer.slot = 0; peer.name = cleanName(m.name) || 'P1';
        r.lobby.names[0] = peer.name;
        r.lobby.chars[0] = clampInt(m.char, 0, CHAR_MAX, r.lobby.chars[0]);
        r.lobby.powerKey[0] = !!m.power;
        applyConfig(r.lobby, m.lobby);   // fase e regras já escolhidas na criação
        broadcastRoom(r);
        break;
      }
      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.code ?? '').toUpperCase());
        if (!r) { send(ws, { t: 'error', msg: 'Sala não encontrada.' }); return; }
        if (r.quick) { send(ws, { t: 'error', msg: 'Sala não encontrada.' }); return; }
        if (r.password && r.password !== cleanPassword(m.password)) {
          send(ws, { t: 'error', msg: m.password ? 'Senha incorreta.' : 'Essa sala pede senha.' });
          return;
        }
        if (r.game) { send(ws, { t: 'error', msg: 'A partida já começou; espere ela acabar.' }); return; }
        const s = takeSlot(r);
        if (s < 0) { send(ws, { t: 'error', msg: 'A sala está cheia (5 jogadores).' }); return; }
        r.peers.add(peer); peer.room = r; peer.slot = s; peer.name = cleanName(m.name) || `P${s + 1}`;
        r.lobby.names[s] = peer.name; r.lobby.powerKey[s] = !!m.power; r.lobby.ready[s] = false;
        r.lobby.chars[s] = clampInt(m.char, 0, CHAR_MAX, r.lobby.chars[s]);
        broadcastRoom(r);
        break;
      }
      case 'register': case 'login': case 'resume': {   // conta: entra (ou cria) e devolve os dados guardados
        if ((peer.authFails ?? 0) >= 8) { ws.close(); return; }
        const r = m.t === 'register' ? accounts.register(m.user, m.pass, m.data)
          : m.t === 'login' ? accounts.login(m.user, m.pass) : accounts.resume(m.token);
        if (!r.ok) { peer.authFails = (peer.authFails ?? 0) + 1; send(ws, { t: 'autherror', msg: r.msg, on: m.t }); break; }
        peer.user = r.user; peer.token = r.token;
        send(ws, { t: 'account', user: r.user, token: r.token, data: r.data, on: m.t });
        break;
      }
      case 'logout': {
        if (peer.token) accounts.logout(peer.token);
        peer.user = null; peer.token = null;
        send(ws, { t: 'account', user: null, token: null, data: null, on: 'logout' });
        break;
      }
      case 'save': {   // grava os dados da conta (controles, opcoes, nome, personagem)
        if (peer.user) accounts.save(peer.user, m.data);
        break;
      }
      case 'list': {   // lista de salas (JOGAR COM AMIGOS); nao precisa estar em sala
        send(ws, { t: 'rooms', rooms: roomList() });
        break;
      }
      case 'quick': {  // entra na fila da partida rapida
        if (queue.includes(peer)) return;
        if (room) { if (!room.quick) return; leave(peer); }   // sobra de uma partida rapida que acabou
        peer.name = cleanName(m.name) || 'P';
        peer.char = clampInt(m.char, 0, CHAR_MAX, 0);
        peer.power = !!m.power;
        queue.push(peer);
        queueUpdate();
        break;
      }
      case 'power': {  // cada um informa se o CONTROLE ONLINE dele tem tecla própria do P
        if (!room || room.game) return;
        room.lobby.powerKey[peer.slot] = !!m.on;
        broadcastRoom(room);
        break;
      }
      case 'ready': {  // cada jogador marca/desmarca PRONTO
        if (!room || room.game || peer === room.host) return;
        room.lobby.ready[peer.slot] = !!m.on;
        broadcastRoom(room);
        break;
      }
      case 'char': {   // cada um escolhe o próprio personagem
        if (!room || room.game) return;
        room.lobby.chars[peer.slot] = clampInt(m.c, 0, CHAR_MAX, room.lobby.chars[peer.slot]);
        broadcastRoom(room);
        break;
      }
      case 'lobby': {  // só o anfitrião: arena, regras, vagas sem humano (CPU/vazia), times e personagens das CPUs
        if (!room || room.game || peer !== room.host) return;
        const L = room.lobby, n = m.lobby ?? {};
        applyConfig(L, n);
        L.mode = n.mode === 'team' ? 'team' : 'ffa';
        if (Array.isArray(n.slots)) n.slots.forEach((k, s) => { if (s < 5 && L.slots[s] !== 'human' && (k === 'cpu' || k === 'off')) L.slots[s] = k; });
        if (Array.isArray(n.teams)) n.teams.forEach((v, s) => { if (s < 5) L.teams[s] = v === 1 ? 1 : 0; });
        if (Array.isArray(n.chars)) n.chars.forEach((c, s) => { if (s < 5 && L.slots[s] !== 'human') L.chars[s] = clampInt(c, 0, CHAR_MAX, L.chars[s]); });
        broadcastRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.game || peer !== room.host) return;
        if (room.lobby.slots.filter(k => k !== 'off').length < 2) { send(ws, { t: 'error', msg: 'Precisa de pelo menos 2 jogadores (humanos ou CPU).' }); return; }
        const waiting = notReady(room);
        if (waiting.length) { send(ws, { t: 'error', msg: `Falta ficar pronto: ${waiting.map(s => room.lobby.names[s] || `${s + 1}P`).join(', ')}.` }); return; }
        // regras extras das Opcoes do anfitriao (luva, arremesso, soneca, montarias, spawns): iguais para todos
        startGame(room, cleanExtras(m.extras));
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
        if (room.quick) {   // partida rapida: acabou, a sala some e todo mundo volta ao menu (pode entrar na fila de novo)
          for (const p of room.peers) { send(p.ws, { t: 'closed', msg: '' }); p.room = null; p.slot = -1; }
          rooms.delete(room.code);
          break;
        }
        room.lobby.ready = [false, false, false, false, false];   // a próxima partida pede PRONTO de novo
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
