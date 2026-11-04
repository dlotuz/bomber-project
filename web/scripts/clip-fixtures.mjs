// Gera as gravações curtas do Chrome usadas pelos testes do leitor de clipe (tests/clip/*.test.ts): um canvas
// desenhado por código (sem nada da ROM) e um tom senoidal, gravados pelo MediaRecorder do mesmo jeito que o jogo
// grava (pedaços de 1 s, quadro-chave a cada 1 s). Requer o Google Chrome (playwright-core, channel 'chrome').
// Uso: node scripts/clip-fixtures.mjs [pasta de saída] (padrão tests/fixtures/clip).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = process.argv[2] ?? fileURLToPath(new URL('../tests/fixtures/clip/', import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="160" height="120"></canvas>');
const formats = [['mp4', 'video/mp4;codecs=avc1,mp4a.40.2'], ['webm', 'video/webm;codecs=vp8,opus']];
for (const [ext, mime] of formats) {
  const bytes = await page.evaluate(async mime => {
    const c = document.getElementById('c'), g = c.getContext('2d');
    const ac = new AudioContext({ sampleRate: 32000 });
    const osc = ac.createOscillator(), dest = ac.createMediaStreamDestination();
    osc.frequency.value = 440; osc.connect(dest); osc.start();
    const stream = c.captureStream(30);
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 150_000, audioBitsPerSecond: 32_000, videoKeyFrameIntervalDuration: 1000 });
    const parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    let f = 0, run = true;
    const draw = () => {   // quadrados que andam: cada quadro difere do anterior
      g.fillStyle = '#123'; g.fillRect(0, 0, 160, 120);
      for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(${i * 70} 80% 55%)`; g.fillRect((f * (i + 1)) % 150, 20 * i + 5, 12, 12); }
      f++;
      if (run) requestAnimationFrame(draw);
    };
    draw();
    rec.start(1000);
    await new Promise(r => setTimeout(r, 4200));
    run = false;
    await new Promise(r => { rec.onstop = r; rec.stop(); });
    osc.stop(); await ac.close();
    return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
  }, mime);
  writeFileSync(`${out}/chrome.${ext}`, Uint8Array.from(bytes));
  console.log(`${out}/chrome.${ext}: ${bytes.length} bytes`);
}
await browser.close();
