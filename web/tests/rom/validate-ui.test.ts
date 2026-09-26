import { createRomPanelController, panelKeyAction, isPassthroughKey, isRomFileSize, PANEL_TEXT, type PanelView } from '../../src/rom/ui';
import { mensagemDe, ROM_SIZE, type ValidateResult } from '../../src/rom/validate';

function setup(result: ValidateResult) {
  const views: PanelView[] = [];
  const got: Uint8Array[] = [];
  const ctl = createRomPanelController({ useBytes: async b => { got.push(b); return result; }, render: v => views.push(v) });
  return { ctl, views, got };
}
const OK: ValidateResult = { ok: true, rom: new Uint8Array(1), sha1: 'x' };
const BAD: ValidateResult = { ok: false, motivo: 'hash', mensagem: mensagemDe('hash') };

describe('painel da ROM (controlador)', () => {
  it('textos PT-BR da spec §2.3', () => {
    expect(PANEL_TEXT.intro).toBe('Crown Blast usa os gráficos e sons da sua cópia de Super Bomberman 4 (USA, com tradução). Arraste o arquivo .sfc aqui ou clique para escolher.');
    expect([PANEL_TEXT.escolher, PANEL_TEXT.semRom]).toEqual(['Escolher arquivo', 'Jogar sem a ROM']);
  });
  it('começa fechado; show abre com o texto de introdução', () => {
    const { ctl, views } = setup(OK);
    expect(ctl.view.visible).toBe(false);
    ctl.show();
    expect(views.at(-1)).toEqual({ visible: true, busy: false, message: PANEL_TEXT.intro, error: null });
  });
  it('arquivo válido: mostra "verificando" e fecha', async () => {
    const { ctl, views, got } = setup(OK);
    ctl.show();
    const r = await ctl.file(new Uint8Array([1, 2]));
    expect(r.ok).toBe(true);
    expect(got).toEqual([new Uint8Array([1, 2])]);
    expect(views.map(v => [v.visible, v.busy, v.message === PANEL_TEXT.verificando])).toEqual([[true, false, false], [true, true, true], [false, false, false]]);
  });
  it('arquivo inválido: o erro aparece no próprio painel, que continua aberto', async () => {
    const { ctl } = setup(BAD);
    ctl.show();
    await ctl.file(new Uint8Array(3));
    expect(ctl.view).toEqual({ visible: true, busy: false, message: PANEL_TEXT.intro, error: mensagemDe('hash') });
    ctl.show();
    expect(ctl.view.error).toBeNull();
  });
  it('teclas: Enter/Espaço abrem o seletor, Esc joga sem ROM; fechado não reage', () => {
    expect([panelKeyAction('Enter'), panelKeyAction(' '), panelKeyAction('Escape'), panelKeyAction('a')]).toEqual(['open', 'open', 'skip', null]);
    const { ctl } = setup(OK);
    expect(ctl.key('Enter')).toBeNull();
    ctl.show();
    expect(ctl.key('Enter')).toBe('open');
    ctl.skip();
    expect(ctl.view.visible).toBe(false);
  });
  it('ocupado (verificando): teclas e "jogar sem" não agem', async () => {
    let release!: (r: ValidateResult) => void;
    const ctl = createRomPanelController({ useBytes: () => new Promise(r => { release = r; }), render: () => {} });
    ctl.show();
    const p = ctl.file(new Uint8Array(1));
    expect(ctl.key('Escape')).toBeNull();
    ctl.skip();
    expect(ctl.view.visible).toBe(true);
    release(OK); await p;
    expect(ctl.view.visible).toBe(false);
  });
  it('rejeita (item 1, falha inesperada): sai de "busy" e volta a aceitar Esc/skip, não trava aberto', async () => {
    const ctl = createRomPanelController({ useBytes: () => Promise.reject(new Error('boom')), render: () => {} });
    ctl.show();
    const r = await ctl.file(new Uint8Array(1));
    expect(r.ok).toBe(false);
    expect(ctl.view.busy).toBe(false);
    expect(ctl.view.visible).toBe(true);
    expect(ctl.view.error).toBeTruthy();
    expect(ctl.key('Escape')).toBe('skip');
    ctl.skip();
    expect(ctl.view.visible).toBe(false);
  });
  it('rejeita sem crypto.subtle: mensagem específica de HTTPS/localhost', async () => {
    const c = globalThis.crypto as unknown as { subtle?: unknown };
    Object.defineProperty(c, 'subtle', { value: undefined, configurable: true });
    try {
      const ctl = createRomPanelController({ useBytes: () => Promise.reject(new Error('boom')), render: () => {} });
      ctl.show();
      const r = await ctl.file(new Uint8Array(1));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensagem).toBe(PANEL_TEXT.semCripto);
      expect(ctl.view.error).toBe(PANEL_TEXT.semCripto);
      expect(ctl.view.busy).toBe(false);
    } finally { delete c.subtle; }
  });
  it('reject: recusa sem chamar useBytes (ex.: tamanho já errado)', () => {
    const { ctl, got } = setup(OK);
    ctl.show();
    ctl.reject(mensagemDe('tamanho'));
    expect(ctl.view).toEqual({ visible: true, busy: false, message: PANEL_TEXT.intro, error: mensagemDe('tamanho') });
    expect(got).toEqual([]);
  });
});

describe('isPassthroughKey (item 2: Enter/Espaço no botão focado; atalhos do navegador)', () => {
  const mods = { ctrlKey: false, metaKey: false, altKey: false };
  it('Ctrl/Meta/Alt e F1–F12 nunca são engolidos', () => {
    expect(isPassthroughKey({ key: 'r', ctrlKey: false, metaKey: true, altKey: false }, false)).toBe(true);
    expect(isPassthroughKey({ key: 'F5', ...mods }, false)).toBe(true);
    expect(isPassthroughKey({ key: 'F12', ...mods }, false)).toBe(true);
    expect(isPassthroughKey({ key: 'a', ...mods }, false)).toBe(false);
  });
  it('Enter/Espaço com botão focado deixa o clique nativo agir; sem foco, abre o seletor', () => {
    expect(isPassthroughKey({ key: 'Enter', ...mods }, true)).toBe(true);
    expect(isPassthroughKey({ key: ' ', ...mods }, true)).toBe(true);
    expect(isPassthroughKey({ key: 'Enter', ...mods }, false)).toBe(false);
  });
  it('Escape nunca é passthrough (mesmo com botão focado)', () => {
    expect(isPassthroughKey({ key: 'Escape', ...mods }, true)).toBe(false);
  });
});

describe('isRomFileSize (item 7: tamanho antes de ler o arquivo)', () => {
  it('aceita 4 MiB e 4 MiB + 512 (cabeçalho de copiadora); rejeita o resto', () => {
    expect(isRomFileSize(ROM_SIZE)).toBe(true);
    expect(isRomFileSize(ROM_SIZE + 512)).toBe(true);
    expect(isRomFileSize(ROM_SIZE - 1)).toBe(false);
    expect(isRomFileSize(ROM_SIZE + 1)).toBe(false);
    expect(isRomFileSize(0)).toBe(false);
  });
});
