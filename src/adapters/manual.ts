import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Adapter, MenuDay, RestaurantMeta } from '../types.ts';

const MANUAL_DIR = fileURLToPath(new URL('../../data/manual/', import.meta.url));

/**
 * Ravintola jonka lista syötetään käsin. Kaikki paikat eivät julkaise listaa
 * koneluettavassa muodossa — osa vain Facebookissa tai kuvana — joten näille
 * pidetään JSON-tiedostoa hakemistossa data/manual/.
 *
 * Tiedoston muoto on sama kuin MenuDay[]:
 *   [{ "date": "2026-08-10", "items": [{ "name": "Lohikeitto", "diets": ["G"] }] }]
 */
export function manual(meta: RestaurantMeta): Adapter {
  return {
    ...meta,
    async fetch(): Promise<MenuDay[]> {
      const path = `${MANUAL_DIR}${meta.id}.json`;
      try {
        return JSON.parse(await readFile(path, 'utf8')) as MenuDay[];
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}
