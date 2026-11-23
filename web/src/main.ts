import { App } from './app/app';
import { browserStorage, defaultSettings, loadSettings, saveSettings } from './app/settings';
import { startLoop } from './app/loop';
import { createStats } from './app/stats';
import { initOnline } from './net/online';
import { installTouchControls } from './input/touch';
import { onlineScreen } from './screens/online';
import { FADE_IN_1 } from './app/fade';
import { startRealAudio } from './app/audio';
import { OwnMusic } from './audio/own-music';
import { resumeAudio } from './audio/register';
import { createAudioStarter } from './audio/starter';
import { bootPack, bootTrace, onRomChange, romState } from './app/rom-api';
import { parseConfig } from './game/config';
import { createMatchSession, carry, sessionSeed, type MatchSession } from './game/match-session';
import { seedStagePick } from './game/stage-choice';
import { InputManager, buildInput, emptyDevices, idleInput, withEscapeAsBack } from './input/input';
import { createDisplay, fitOptionsFor, resolveScreenKind, resolveScreenMode, screenModeFromUrl } from './render/display';
import { present } from './render/fx/present';
import { SpriteBank } from './render/sprite-bank';
import { titleScreen } from './screens/title';
import { battleScreen } from './screens/battle';
import { hdBegin } from './render/hd-menu';
import { hdArtFromUrl, hdBattleBegin, resolveHdArt, useHdArt } from './render/hdart/mode';
import { detectClipSupport } from './clip/support';
import { ClipController, clipFileName, clipTitle } from './clip/controller';
import { ClipRecorder } from './clip/recorder';
import { ClipCanvas } from './clip/canvas';
import { ClipAudioMix } from './clip/audio-mix';
import { deliverClip } from './clip/deliver';
import { ClipFolder } from './clip/folder';
import { drawClipToast } from './clip/toast';
import { audioOutput, type AudioOutput } from './audio/output';
import { setTouchClip } from './input/touch';
import type { BattleScreen } from './screens/battle';

const store = browserStorage();
const params = new URLSearchParams(window.location.search);
// ?reset: descarta as configurações salvas (recuperação de um estado ruim, ex.: teclas remapeadas
// para algo inutilizável) e já grava o padrão de volta.
const settings = params.has('reset') ? defaultSettings() : loadSettings(store);
if (params.has('reset')) saveSettings(store, settings);
// Semente sorteada a cada abertura (a do boot, $0012, repetia a 1ª partida); ?seed=N fixa.
carry.seed = sessionSeed(window.location.search);
// Fase ALEATÓRIO da seleção de fase: Math.random; com ?seed=N, sorteios reproduzíveis a partir de N.
seedStagePick(window.location.search);

const input = new InputManager(window, settings.keymaps);
input.setPadmaps(settings.padmaps);
input.setExtraKeymap(settings.online.keymap);
input.setClipBinding(settings.options.clipKey, settings.options.clipPad);
const app = new App(settings, {
  save: s => { saveSettings(store, s); online.syncAccount(); },
  setKeymaps: m => input.setKeymaps(m),
  applyInput: s => {
    input.setKeymaps(s.keymaps); input.setPadmaps(s.padmaps); input.setExtraKeymap(s.online.keymap);
    input.setClipBinding(s.options.clipKey, s.options.clipPad);
  },
  seed: () => 0x0012,
});
app.audio.setVolume(settings.options.musicVol / 10, settings.options.sfxVol / 10);
// MÚSICA PRÓPRIA (Opções): faixas do jogador guardadas no navegador, no lugar da música da batalha.
const ownMusic = new OwnMusic();
app.audio.setOwnMusic(ownMusic, settings.options.ownMusic);
void ownMusic.load();

// Gráficos e som originais embutidos (public/rom-pack.dat): ninguém precisa carregar a ROM. Até o pacote chegar (ou
// se ele falhar), as telas usam a arte por código. Em dev, ?romtrace=<url da ROM> usa a ROM real rastreando o que é
// lido (scripts/snapshots.mjs com SB4_TRACE, para regerar o pacote).
const romTraceUrl = import.meta.env.DEV ? params.get('romtrace') : null;
const romRanges = romTraceUrl ? bootTrace(romTraceUrl) : null;
if (!romTraceUrl) void bootPack(`${import.meta.env.BASE_URL}rom-pack.dat`);

// Áudio só depois do 1º gesto (§6.1); trocar de ROM recria o sink (os samples vêm da ROM). Cada gesto
// (tecla, ponteiro, toque/clique ou botão do controle, no loop) também pede resume() ao AudioContext.
const audioStart = createAudioStarter({
  start: () => startRealAudio(app.audio),
  resume: resumeAudio,
  warn: e => console.warn('Crown Blast: áudio indisponível.', e),
});
for (const ev of ['keydown', 'pointerdown', 'pointerup', 'click'] as const) window.addEventListener(ev, () => audioStart.gesture());
onRomChange(() => audioStart.romChanged());

// Arte HD (opção 5): `?arte=hd` (pacote provisório) ou `?arte=<nome>` carrega web/public/arte-hd/<nome>/ e
// `?arte=rom` desliga; sem o parâmetro, a arte HD fica desligada. O pacote chega em segundo plano; até
// lá (ou se falhar) a partida usa a ROM/arte simples.
const urlArt = hdArtFromUrl(location.search);

const display = createDisplay(document.getElementById('screen') as HTMLCanvasElement, () => fitOptionsFor(app.settings.options.screen, location.search));
const ctx = display.ctx;
const bank = new SpriteBank();
// CLIPE (Opções > Clipe): grava os últimos segundos da partida (só no Chrome: quadro-chave periódico, src/clip/support.ts).
// O quadro do clipe sai do #screen já apresentado; o som, do APU e da MÚSICA PRÓPRIA. O botão é lido aqui, no próprio
// aparelho (InputManager.takeClip), fora do lockstep: na sala online, só quem apertou grava.
const clipSupport = detectClipSupport();
app.clipSupported = clipSupport.ok;
const clipFolder = new ClipFolder();
app.clipFolder = clipFolder;
void clipFolder.load();
const clipCanvas = new ClipCanvas();
let clipMix: { out: AudioOutput; mix: ClipAudioMix } | null = null;
const clipAudio = (): ClipAudioMix | null => {
  const out = audioOutput();
  if (!out) return null;
  if (clipMix?.out !== out) {
    clipMix = { out, mix: new ClipAudioMix(out.ctx, out.node) };
    if (ownMusic.element) clipMix.mix.attach(ownMusic.element);
  }
  return clipMix.mix;
};
ownMusic.onElement(el => clipMix?.mix.attach(el));
const battleNow = (): BattleScreen | null => (app.screen.id === 'battle' ? (app.screen as BattleScreen) : null);
const clip = new ClipController({
  supported: clipSupport.ok,
  options: () => app.settings.options,
  battle: () => { const b = battleNow(); return b ? { paused: b.paused, stage: b.ms.cfg.stage } : null; },
  hidden: () => document.hidden,
  audioKey: audioOutput,
  now: () => performance.now(),
  newRecorder: keep => new ClipRecorder(clipSupport.mime!, keep, () => {
    const t = clipAudio()?.track;
    return t ? [clipCanvas.videoTrack(), t] : [clipCanvas.videoTrack()];
  }),
  deliver: async (blob, name) => {
    const f = await clipFolder.save(blob, name);   // pasta escolhida nas Opções; sem ela (ou sem permissão), Downloads
    if (f === 'saved') return 'folder';
    const how = await deliverClip(blob, name);
    return f === 'denied' && how === 'downloaded' ? 'noFolder' : how;
  },
  fileName: stage => clipFileName(new Date(), stage, clipSupport.mime ?? ''),
  title: stage => clipTitle(new Date(), stage),
});
// a aba escondida para o requestAnimationFrame (e o render): a pausa do gravador vem pelo evento
document.addEventListener('visibilitychange', () => clip.update());

// ?fx=0 desliga os efeitos nesta sessão (debug e capturas fiéis).
const fxOff = params.get('fx') === '0';
// ?bordas=preto|borrado e ?filtro=suave|nitido forçam a apresentação; sem eles, valem as opções (lidas a cada quadro).
const urlMode = screenModeFromUrl(location.search);
const render = (): void => {
  display.refit();   // trocar TELA nas Opções vale na hora
  useHdArt(resolveHdArt(urlArt), import.meta.env.BASE_URL);
  hdBegin();
  hdBattleBegin();
  app.draw(ctx, bank);
  online.drawOverlay(ctx, bank);
  present(display, fxOff ? null : app.screen.fx?.() ?? null, app.brightness() / 15, resolveScreenMode(urlMode, app.settings.options, resolveScreenKind(location.search, app.settings.options.screen)));
  online.drawNames(display.out, display.layout());   // sala online: nome de cada humano em cima da cabeça
  clip.update();
  const L = display.layout();
  if (clip.recording) clipCanvas.compose(display.out.canvas, { x: L.ox, y: L.oy, w: L.gw, h: L.gh });
  const note = clip.toast();
  if (note) drawClipToast(display.out, L, bank, note);   // depois da cópia: o aviso não entra nas gravações
  setTouchClip(clip.available);
  stats.frame();
};
// ?quick abre direto numa partida com as regras da URL (ver parseConfig); sem ele, começa no título.
// Sala online: o cliente (net/online.ts) e a tela (screens/online.ts); ?sala=<código> (link de convite) abre direto nela.
const online = initOnline(app);
// celular/tablet: direcional e botões na tela (viram as teclas do perfil em uso; na partida online, o controle online)
installTouchControls(() => (online.playing ? app.settings.online.keymap : app.settings.keymaps[0]), window, document, () => { void clip.press(); });
void online.restoreAccount();   // sessão da conta guardada neste navegador
// FPS e ping no topo da tela (o ping só com a sala online conectada)
const stats = createStats(document.getElementById('stats'), () => online.ping, () => online.peerPings());
if (params.has('quick') || params.has('cenario')) app.go(battleScreen(app, createMatchSession(parseConfig(window.location.search))));
else if (params.has('sala')) app.transition(() => onlineScreen(app, { code: params.get('sala') ?? '' }), { out: [], black: 0, in: FADE_IN_1 });
else app.transition(() => titleScreen(app), { out: [], black: 0, in: FADE_IN_1 });

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe em dev com ?debug.
// `hold(true)` para o relógio do loop e `step(n, btn, slot)` avança n ticks à mão (o 1º com `btn` recém-apertado
// em qualquer controle e no do jogador `slot`), para fotografar um frame exato.
let held = false;
if (import.meta.env.DEV && params.has('debug')) {
  (window as unknown as { __crown: unknown }).__crown = {
    app, rom: romState,
    /** Faixas da ROM lidas até agora (só com ?romtrace). */
    async romRanges(): Promise<[number, number][] | null> { return (await romRanges)?.() ?? null; },
    get ms(): MatchSession | null { return (app.screen as Partial<{ ms: MatchSession }>).ms ?? null; },
    hold(on: boolean): void { held = on; },
    step(n = 1, btn = 0, slot = 0): void {
      for (let k = 0; k < n; k++) {
        const inp = idleInput();
        if (k === 0 && btn) { inp.any = inp.pressedAny = btn; inp.pads[slot] = inp.pressed[slot] = btn; }
        app.update(inp);
      }
      render();
    },
  };
  // F9: baixa a rodada atual (regras, estado e cérebros da IA) em JSON, para reproduzir um bug fora do navegador.
  window.addEventListener('keydown', e => {
    const ms = (app.screen as Partial<{ ms: MatchSession }>).ms;
    if (e.key !== 'F9' || !ms?.round) return;
    const typed = (_k: string, v: unknown): unknown => (ArrayBuffer.isView(v) ? { ta: v.constructor.name, v: Array.from(v as Int32Array) } : v);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ cfg: ms.cfg, round: ms.round, brains: ms.ai.brains }, typed)]));
    a.download = `partida-${ms.round.clock.sec}s.json`;
    a.click();
  });
}


let prev = emptyDevices();
startLoop(() => {
  if (held) return;
  const cur = input.poll(app.settings.devices);
  const inp = withEscapeAsBack(buildInput(cur, prev, app.settings.devices, input.takeLastKey(),
    { connected: input.connected(), esc: input.escHeld(), padButton: input.takePadButton() }));
  if (inp.pressedAny) audioStart.gesture();        // botão do controle também conta como gesto (M6)
  if (input.takeClip()) void clip.press();         // botão do CLIPE: só neste aparelho, nunca vai para o lockstep
  // partida online: só o controle da sala online (Opções dele na tela da sala) vai para o lockstep
  // (aba escondida: nenhum botão — o jogo segue para os outros sem ninguém "segurando" uma direção)
  if (online.playing) { const oc = app.settings.online; online.step(document.hidden ? 0 : input.readProfile(oc.device, oc.keymap, oc.padmap)); }
  else app.update(inp);
  prev = cur;
}, render, () => online.playing);
