/** Scripts do host usados nos goldens (mesma sintaxe do spchost/spctrace; argumentos em hexadecimal). Módulo folha. */
export const HOST_SCRIPTS: Record<string, string> = {
  /** Aceite da §11: 1º segundo da música $14 a partir do boot. */
  batalha: 'init; blk 2F; mus 14; frames 2; rec; frames 60',
  /** Menus, SFX, vozes (a $06 chega com a $10 ainda em stream e é ignorada), fade, troca de banco e STOP. */
  fluxo: 'init; blk 30; mus 12; frames 30; rec; sfx 1; frames 5; sfx 2; frames 5; stream 7; frames 120; fade; frames 30; blk 2F; mus 14; stream 10; sfx 7; frames 20; stream 6; frames 60; sfx c; frames 10; stop; frames 10',
};
