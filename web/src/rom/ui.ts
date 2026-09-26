// Painel de carga da ROM (spec §2.3): camada DOM fora do canvas. A lógica fica no controlador (testável sem DOM).
import type { ValidateResult } from './validate';
import { bootRom, registerRomDialog, useRomBytes } from './state';

export const PANEL_TEXT = {
  intro: 'Crown Blast usa os gráficos e sons da sua cópia de Super Bomberman 4 (USA, com tradução). Arraste o arquivo .sfc aqui ou clique para escolher.',
  escolher: 'Escolher arquivo',
  semRom: 'Jogar sem a ROM',
  verificando: 'Verificando a ROM…',
} as const;

export interface PanelView { visible: boolean; busy: boolean; message: string; error: string | null }
export type PanelKeyAction = 'open' | 'skip' | null;

/** Teclas do painel aberto: Enter/Espaço abrem o seletor (é gesto do usuário), Esc = jogar sem a ROM. */
export function panelKeyAction(key: string): PanelKeyAction {
  if (key === 'Enter' || key === ' ') return 'open';
  if (key === 'Escape') return 'skip';
  return null;
}

export interface PanelDeps { useBytes(b: Uint8Array): Promise<ValidateResult>; render(v: PanelView): void }

export function createRomPanelController(deps: PanelDeps) {
  let view: PanelView = { visible: false, busy: false, message: PANEL_TEXT.intro, error: null };
  const set = (p: Partial<PanelView>) => { view = { ...view, ...p }; deps.render(view); };
  return {
    get view(): PanelView { return view; },
    show(): void { set({ visible: true, busy: false, error: null, message: PANEL_TEXT.intro }); },
    skip(): void { if (!view.busy) set({ visible: false, error: null }); },
    async file(bytes: Uint8Array): Promise<ValidateResult> {
      set({ busy: true, error: null, message: PANEL_TEXT.verificando });
      const r = await deps.useBytes(bytes);
      set(r.ok ? { busy: false, visible: false, message: PANEL_TEXT.intro } : { busy: false, message: PANEL_TEXT.intro, error: r.mensagem });
      return r;
    },
    /** Ação da tecla com o painel aberto (null = ignorar); fechado, nunca age. */
    key(k: string): PanelKeyAction { return view.visible && !view.busy ? panelKeyAction(k) : null; },
  };
}

/** Monta o painel no documento. Enquanto aberto, engole as teclas (o jogo não as vê). */
export function installRomPanel(doc: Document): { show(): void; hide(): void } {
  const root = doc.createElement('div');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Carregar a ROM');
  root.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.85);z-index:10;font:16px system-ui,sans-serif;color:#fff';
  const box = doc.createElement('div');
  box.style.cssText = 'max-width:520px;padding:24px;border:2px dashed #888;border-radius:8px;background:#111;text-align:center';
  const msg = doc.createElement('p'), err = doc.createElement('p');
  err.setAttribute('role', 'alert'); err.style.color = '#ff6b6b';
  const input = doc.createElement('input');
  input.type = 'file'; input.accept = '.sfc,.smc'; input.style.display = 'none';
  const pick = doc.createElement('button'), skip = doc.createElement('button');
  pick.textContent = PANEL_TEXT.escolher; skip.textContent = PANEL_TEXT.semRom;
  for (const b of [pick, skip]) b.style.cssText = 'margin:8px;padding:8px 16px;font:inherit;cursor:pointer';
  box.append(msg, err, pick, skip, input); root.append(box); doc.body.append(root);

  const ctl = createRomPanelController({
    useBytes: b => useRomBytes(b),
    render: v => {
      root.style.display = v.visible ? 'flex' : 'none';
      msg.textContent = v.message; err.textContent = v.error ?? '';
      pick.disabled = skip.disabled = v.busy;
    },
  });
  const readFile = async (f: File | undefined | null) => { if (f) await ctl.file(new Uint8Array(await f.arrayBuffer())); };
  pick.addEventListener('click', () => input.click());
  skip.addEventListener('click', () => ctl.skip());
  input.addEventListener('change', () => { void readFile(input.files?.[0]); input.value = ''; });
  root.addEventListener('dragover', e => { e.preventDefault(); });
  root.addEventListener('drop', e => { e.preventDefault(); void readFile(e.dataTransfer?.files[0]); });
  root.addEventListener('click', e => { if (e.target === root || e.target === box || e.target === msg) input.click(); });
  doc.defaultView?.addEventListener('keydown', e => {
    if (!ctl.view.visible) return;
    const a = ctl.key(e.key);
    if (e.key !== 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); }
    if (a === 'open') input.click();
    else if (a === 'skip') ctl.skip();
  }, { capture: true });
  return { show: () => ctl.show(), hide: () => ctl.skip() };
}

/** Gancho do main.ts: registra o painel, carrega a ROM guardada e, sem ela, abre o painel se `autoShow`. */
export async function startRomUi(doc: Document, opts: { autoShow: boolean }): Promise<void> {
  const panel = installRomPanel(doc);
  registerRomDialog(() => panel.show());
  const had = await bootRom();
  if (!had && opts.autoShow) panel.show();
}
