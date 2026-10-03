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

export function startTextEntry(initial: string, max: number, doc: Document = document): TextEntry {
  const input = doc.createElement('input');
  Object.assign(input.style, { position: 'fixed', left: '-1000px', top: '0', opacity: '0', width: '10px' });
  input.maxLength = max;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'characters');
  input.value = cleanEntry(initial, max);
  doc.body.append(input);
  let done: boolean | null = null;
  input.addEventListener('input', () => { input.value = cleanEntry(input.value, max); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { done = true; e.preventDefault(); }
    else if (e.key === 'Escape') { done = false; e.preventDefault(); }
  });
  input.addEventListener('blur', () => { if (done === null) done = false; });
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  return {
    get value() { return cleanEntry(input.value, max); },
    get done() { return done; },
    close() { input.remove(); },
  };
}
