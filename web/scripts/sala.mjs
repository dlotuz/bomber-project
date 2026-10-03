// npm run sala — sobe a sala online na sua máquina: gera o build do jogo (web/dist), roda o servidor da sala
// (server/sala.mjs, porta 8787) e abre um túnel público do Cloudflare (cloudflared, sem conta), mostrando a URL para
// mandar aos outros. Ctrl+C encerra tudo.
//   SALA_NO_BUILD=1   usa o web/dist que já existe
//   SALA_NO_TUNNEL=1  só na rede local (http://<seu-ip>:8787)
//   PORT=<n>          outra porta
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.PORT ?? '8787';
const children = [];
const stopAll = () => { for (const c of children) try { c.kill(); } catch { /* já saiu */ } };
process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('exit', stopAll);

if (!process.env.SALA_NO_BUILD) {
  console.log('gerando o build do jogo…');
  const r = spawnSync(process.execPath, [`${root}node_modules/vite/bin/vite.js`, 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) { console.error('o build falhou'); process.exit(1); }
}

const server = spawn(process.execPath, [`${root}server/sala.mjs`], { cwd: root, stdio: 'inherit', env: { ...process.env, PORT } });
children.push(server);
server.on('exit', code => { console.error(`o servidor da sala saiu (${code})`); stopAll(); process.exit(1); });

const lan = Object.values(networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => `http://${a.address}:${PORT}/`);
if (process.env.SALA_NO_TUNNEL) {
  console.log(`\nSala na rede local: ${lan.join('  ')}\n`);
} else {
  // o instalador do winget não põe no PATH da sessão atual: tenta as pastas dele antes do PATH
  const exe = ['C:/Program Files (x86)/cloudflared/cloudflared.exe', 'C:/Program Files/cloudflared/cloudflared.exe']
    .find(p => existsSync(p)) ?? 'cloudflared';
  const tunnel = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(tunnel);
  let shown = false;
  const scan = buf => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!m || shown) return;
    shown = true;
    console.log(`\n==============================================================`);
    console.log(` Sala online: ${m[0]}`);
    console.log(` Mande esse link; no jogo, clique em "Sala online" (canto de cima).`);
    console.log(` Você também pode abrir em http://localhost:${PORT}/`);
    console.log(`==============================================================\n`);
  };
  tunnel.stdout.on('data', scan);
  tunnel.stderr.on('data', scan);
  tunnel.on('error', () => {
    console.error('cloudflared não encontrado (winget install Cloudflare.cloudflared). Rede local:', lan.join('  '));
  });
  tunnel.on('exit', code => { if (!shown) console.error(`o túnel saiu (${code}) antes de dar a URL`); });
}
