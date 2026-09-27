import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

const WEB = fileURLToPath(new URL('.', import.meta.url));
const walk = (rel: string): string[] => readdirSync(WEB + rel).flatMap(f => {
  const p = `${rel}/${f}`;
  return statSync(WEB + p).isDirectory() ? walk(p) : [p];
});

/** LGPL do módulo S-DSP (plano 11, I2): publica com o jogo a fonte correspondente do worklet de áudio. */
function audioSource(): Plugin {
  return {
    name: 'crown-audio-source',
    apply: 'build',
    generateBundle() {
      const files = [...walk('src/audio'), ...walk('vendor/snes_spc'), 'package.json', 'tsconfig.json', 'vite.config.ts'];
      for (const f of files) this.emitFile({ type: 'asset', fileName: `licenses/fonte/web/${f}`, source: readFileSync(WEB + f) });
      this.emitFile({ type: 'asset', fileName: 'licenses/fonte/ARQUIVOS.txt', source: files.map(f => `web/${f}\n`).join('') });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [audioSource()],
  // O worklet sai em ES module com o DSP (LGPL) num arquivo próprio, substituível (assets/spc-dsp-*.js).
  worker: {
    format: 'es',
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes('/audio/apu/dsp/') ? 'spc-dsp' : undefined) } },
  },
  test: { globals: true, include: ['tests/**/*.test.ts'] },
});
