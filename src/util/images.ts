import { createHash } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { MenuImage } from '../types.ts';
import { get } from './http.ts';

const IMAGE_DIR = fileURLToPath(new URL('../../site/data/images/', import.meta.url));
/** Polku sellaisena kuin selain sen näkee, suhteessa site/index.html:ään. */
const PUBLIC_PREFIX = 'data/images/';

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Lataa kuvan repoon ja palauttaa MenuImagen, joka osoittaa paikalliseen
 * kopioon. Näin sivusto ei kuormita ravintolan palvelinta eikä hajoa kun
 * ravintola vaihtaa tiedoston nimeä.
 *
 * Tiedostonimi on sisällön tiiviste, joten muuttumaton viikkolista ei tuota
 * uutta committia.
 */
export async function downloadImage(
  image: MenuImage & { url: string },
  restaurantId: string,
): Promise<MenuImage> {
  const res = await get(image.url, { timeoutMs: 30_000 });
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
  const extension = EXTENSIONS[contentType];
  if (!extension) {
    throw new Error(`Odottamaton kuvatyyppi ${contentType || '(tyhjä)'} — ${image.url}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const filename = `${restaurantId}-${hash}.${extension}`;

  await mkdir(IMAGE_DIR, { recursive: true });
  await writeFile(`${IMAGE_DIR}${filename}`, bytes);

  return {
    ...image,
    url: `${PUBLIC_PREFIX}${filename}`,
    sourceUrl: image.url,
  };
}

/**
 * Poistaa kuvat joihin syöte ei enää viittaa. Ilman tätä repoon kertyisi uusi
 * kuva joka viikko ikuisesti.
 */
export async function pruneImages(keep: Iterable<string>): Promise<number> {
  const wanted = new Set([...keep].map((url) => url.replace(PUBLIC_PREFIX, '')));
  let removed = 0;
  let existing: string[];
  try {
    existing = await readdir(IMAGE_DIR);
  } catch {
    return 0;
  }
  for (const file of existing) {
    if (!wanted.has(file)) {
      await unlink(`${IMAGE_DIR}${file}`);
      removed++;
    }
  }
  return removed;
}
