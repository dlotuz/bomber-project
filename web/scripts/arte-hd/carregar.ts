// Carrega módulos de src/ (TypeScript com imports sem extensão) a partir de um script Node, pelo executor do Vite.
// Os scripts desta pasta rodam com `node scripts/arte-hd/<script>.ts` (Node 24 já remove os tipos sozinho).
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

/** Pasta `web/` (com barra no fim). */
export const WEB = fileURLToPath(new URL('../../', import.meta.url));

/** Importa `web/<rel>` com o Vite (sem ler vite.config: só precisa resolver TS). */
export async function importar<T>(rel: string): Promise<T> {
  const { module } = await runnerImport<T>(WEB + rel, { configFile: false, logLevel: 'silent', root: WEB });
  return module;
}
