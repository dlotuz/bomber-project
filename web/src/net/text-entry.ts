// Digitação dentro do jogo (nome e código da sala): um <input> invisível recebe as teclas — o leitor de teclado do jogo
// ignora campos editáveis, e no celular o foco abre o teclado — e a tela desenha o texto no próprio jogo. Enter
// confirma, Esc cancela.

export interface TextEntry {
  /** Texto atual (já filtrado). */
  readonly value: string;
  /** null = ainda digitando; true = confirmou (Enter); false = cancelou (Esc ou perdeu o foco). */
  readonly done: boolean | null;
  close(): void;
}

/** Só letras sem acento, números, espaço e - . (a fonte do jogo tem esses glifos), em maiúsculas. */
export const cleanEntry = (s: string, max: number): string => s.toUpperCase().replace(/[^A-Z0-9 .-]/g, '').slice(0, max);

/** Tela de toque: o teclado do celular só abre com um toque no campo, então ele aparece de verdade, com OK e cancelar. */
const touchOnly = (doc: Document): boolean => !!doc.defaultView?.matchMedia?.('(pointer: coarse)').matches
  || new URLSearchParams(doc.defaultView?.location.search ?? '').has('touch');

export function startTextEntry(initial: string, max: number, doc: Document = document): TextEntry {
  const input = doc.createElement('input');
  const sheet = touchOnly(doc) ? doc.createElement('div') : null;
  if (sheet) {
    Object.assign(sheet.style, {
      position: 'fixed', inset: '0', zIndex: '50', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap', alignContent: 'center', background: 'rgba(0,0,20,0.85)', padding: '16px',
    });
    Object.assign(input.style, {
      font: '700 24px system-ui, sans-serif', textTransform: 'uppercase', padding: '12px', width: 'min(80vw, 360px)',
      borderRadius: '10px', border: '3px solid #ffe46b', background: '#10286e', color: '#fff', textAlign: 'center',
    });
  } else {
    Object.assign(input.style, { position: 'fixed', left: '-1000px', top: '0', opacity: '0', width: '10px' });
  }
  input.maxLength = max;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'characters');
  input.value = cleanEntry(initial, max);
  let done: boolean | null = null;
  if (sheet) {
    const mk = (text: string, value: boolean): HTMLButtonElement => {
      const b = doc.createElement('button');
      b.type = 'button'; b.textContent = text;
      Object.assign(b.style, { font: '700 20px system-ui, sans-serif', padding: '12px 26px', borderRadius: '10px', border: '0',
        background: value ? '#ffe46b' : '#8fd8ff', color: '#000' });
      b.addEventListener('pointerdown', e => { done = value; e.preventDefault(); });
      return b;
    };
    sheet.append(input, doc.createElement('br'), mk('OK', true), mk('CANCELAR', false));
    doc.body.append(sheet);
  } else doc.body.append(input);
  input.addEventListener('input', () => { input.value = cleanEntry(input.value, max); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { done = true; e.preventDefault(); }
    else if (e.key === 'Escape') { done = false; e.preventDefault(); }
  });
  if (!sheet) input.addEventListener('blur', () => { if (done === null) done = false; });
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  return {
    get value() { return cleanEntry(input.value, max); },
    get done() { return done; },
    close() { input.remove(); sheet?.remove(); },
  };
}
