// Contas da sala online: usuário + senha, e um bloco de dados por conta (controles, opções, nome e personagem) que o
// jogo grava e devolve no login. Fica num JSON em disco (SALA_DATA, padrão server/data/contas.json); a senha é guardada
// só como hash (scrypt com sal). Sessões são tokens aleatórios, guardados no navegador para entrar sozinho.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const USER_MIN = 3, USER_MAX = 12, PASS_MIN = 4, PASS_MAX = 16;
const DATA_MAX = 128 * 1024;
const TOKENS_PER_USER = 5;

export const cleanUser = u => String(u ?? '').toUpperCase().replace(/[^A-Z0-9 .-]/g, '').trim().slice(0, USER_MAX);

const hash = (pass, salt) => scryptSync(String(pass), salt, 32);

export class Accounts {
  /** @param {string} file caminho do JSON (null = só em memória, para testes) */
  constructor(file) {
    this.file = file;
    /** @type {{ users: Record<string, { salt: string, hash: string, data: string | null }>, tokens: Record<string, string> }} */
    this.db = { users: {}, tokens: {} };
    if (file && existsSync(file)) {
      try { this.db = JSON.parse(readFileSync(file, 'utf8')); } catch { /* arquivo ruim: começa vazio */ }
      this.db.users ??= {}; this.db.tokens ??= {};
    }
  }

  persist() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.db));
    renameSync(tmp, this.file);
  }

  issue(user) {
    const mine = Object.keys(this.db.tokens).filter(t => this.db.tokens[t] === user);
    for (const t of mine.slice(0, Math.max(0, mine.length - TOKENS_PER_USER + 1))) delete this.db.tokens[t];
    const token = randomBytes(24).toString('hex');
    this.db.tokens[token] = user;
    return token;
  }

  /** @returns {{ ok: true, user: string, token: string, data: string | null } | { ok: false, msg: string }} */
  register(rawUser, pass, data) {
    const user = cleanUser(rawUser);
    if (user.length < USER_MIN) return { ok: false, msg: `Usuário: de ${USER_MIN} a ${USER_MAX} caracteres.` };
    const p = String(pass ?? '');
    if (p.length < PASS_MIN || p.length > PASS_MAX) return { ok: false, msg: `Senha: de ${PASS_MIN} a ${PASS_MAX} caracteres.` };
    if (this.db.users[user]) return { ok: false, msg: 'Esse usuário já existe.' };
    const salt = randomBytes(16).toString('hex');
    this.db.users[user] = { salt, hash: hash(p, salt).toString('hex'), data: typeof data === 'string' && data.length <= DATA_MAX ? data : null };
    const token = this.issue(user);
    this.persist();
    return { ok: true, user, token, data: this.db.users[user].data };
  }

  login(rawUser, pass) {
    const user = cleanUser(rawUser), u = this.db.users[user];
    const bad = { ok: false, msg: 'Usuário ou senha incorretos.' };
    if (!u) return bad;
    const want = Buffer.from(u.hash, 'hex'), got = hash(String(pass ?? ''), u.salt);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return bad;
    const token = this.issue(user);
    this.persist();
    return { ok: true, user, token, data: u.data };
  }

  resume(token) {
    const user = this.db.tokens[String(token ?? '')];
    if (!user || !this.db.users[user]) return { ok: false, msg: 'Sessão expirada.' };
    return { ok: true, user, token: String(token), data: this.db.users[user].data };
  }

  logout(token) {
    if (this.db.tokens[token]) { delete this.db.tokens[token]; this.persist(); }
  }

  /** Grava o bloco de dados da conta (string JSON). */
  save(user, data) {
    const u = this.db.users[user];
    if (!u || typeof data !== 'string' || data.length > DATA_MAX) return false;
    u.data = data;
    this.persist();
    return true;
  }
}
