import { App } from './app/app';
import { browserStorage, defaultSettings, loadSettings, saveSettings } from './app/settings';
import { startLoop } from './app/loop';
import { FADE_IN_1 } from './app/fade';
import { startRealAudio } from './app/audio';
import { resumeAudio } from './audio/register';
import { createAudioStarter } from './audio/starter';
import { onRomChange, romState } from './app/rom-api';
import { parseConfig } from './game/config';
import { createMatchSession, carry, type MatchSession } from './game/match-session';
import { InputManager, buildInput, emptyDevices, idleInput, withEscapeAsBack } from './input/input';
import { createDisplay, fitOptionsFor, resolveScreenKind, resolveScreenMode, screenModeFromUrl } from './render/display';
import { present } from './render/fx/present';
import { SpriteBank } from './render/sprite-bank';
import { titleScreen } from './screens/title';
import { battleScreen } from './screens/battle';
import { startRomUi } from './rom/ui';
import { hdBegin } from './render/hd-menu';
import { hdArtFromUrl, hdBattleBegin, resolveHdArt, useHdArt } from './render/hdart/mode';

const store = browserStorage();
const params = new URLSearchParams(window.location.search);
// ?reset: descarta as configurações salvas (recuperação de um estado ruim, ex.: teclas remapeadas
// para algo inutilizável) e já grava o padrão de volta.
const settings = params.has('reset') ? defaultSettings() : loadSettings(store);
if (params.has('reset')) saveSettings(store, settings);
// R23: a sessão começa com a semente do boot ($0012); ?seed=N troca.
if (params.has('seed')) carry.seed = Number.parseInt(params.get('seed')!, 10) & 0xffff;

const input = new InputManager(window, settings.keymaps);
input.setPadmaps(settings.padmaps);
const app = new App(settings, {
  save: s => saveSettings(store, s),
  setKeymaps: m => input.setKeymaps(m),
  applyInput: s => { input.setKeymaps(s.keymaps); input.setPadmaps(s.padmaps); },
  seed: () => 0x0012,
});
app.audio.setVolume(settings.options.musicVol / 10, settings.options.sfxVol / 10);

// Painel da ROM (plano 5): usa a ROM guardada ou, sem ela, pede o arquivo (não abre sozinho em ?debug/?quick).
void startRomUi(document, { autoShow: !params.has('debug') && !params.has('quick') });

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
  present(display, fxOff ? null : app.screen.fx?.() ?? null, app.brightness() / 15, resolveScreenMode(urlMode, app.settings.options, resolveScreenKind(location.search, app.settings.options.screen)));
};
// ?quick abre direto numa partida com as regras da URL (ver parseConfig); sem ele, começa no título.
if (params.has('quick')) app.go(battleScreen(app, createMatchSession(parseConfig(window.location.search))));
else app.transition(() => titleScreen(app), { out: [], black: 0, in: FADE_IN_1 });

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe em dev com ?debug.
// `hold(true)` para o relógio do loop e `step(n, btn, slot)` avança n ticks à mão (o 1º com `btn` recém-apertado
// em qualquer controle e no do jogador `slot`), para fotografar um frame exato.
let held = false;
if (import.meta.env.DEV && params.has('debug')) {
  (window as unknown as { __crown: unknown }).__crown = {
    app, rom: romState,
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
  app.update(inp);
  prev = cur;
}, render);
