import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { adapters } from './adapters/index.ts';
import { OFFICE } from './config.ts';
import type { Adapter, Feed, MenuDay, MenuImage, MenuResult, RestaurantFeed } from './types.ts';
import { addDays, currentWeek, today } from './util/dates.ts';
import { straightLineDistance, walkingDistance } from './util/distance.ts';
import { downloadImage, pruneImages } from './util/images.ts';

const OUT = fileURLToPath(new URL('../site/data/menus.json', import.meta.url));

/** Kuinka monta päivää eteenpäin listoja säilytetään. */
const HORIZON_DAYS = 14;
/** Montako ravintolaa haetaan yhtä aikaa. Pidetään maltillisena. */
const CONCURRENCY = 4;

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    dry: { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

const selected = values.only
  ? adapters.filter((a) => a.id === values.only)
  : adapters;

if (values.only && selected.length === 0) {
  console.error(`Tuntematon ravintola: ${values.only}`);
  console.error(`Tunnetut: ${adapters.map((a) => a.id).join(', ') || '(ei yhtään)'}`);
  process.exit(1);
}

const previousFeed = await loadPrevious();
const previous = previousFeed?.restaurants ?? [];
const results = await mapWithConcurrency(selected, CONCURRENCY, scrapeOne);

// Kun ajetaan --only, muut ravintolat säilytetään ennallaan.
const byId = new Map(previous.map((r) => [r.id, r]));
for (const r of results) byId.set(r.id, r);
const restaurants = adapters
  .map((a) => byId.get(a.id))
  .filter((r): r is RestaurantFeed => r !== undefined);

await resolveDistances(restaurants);

const feed: Feed = {
  generatedAt: new Date().toISOString(),
  office: { address: OFFICE.address, lat: OFFICE.lat, lng: OFFICE.lng },
  restaurants,
};

const ok = results.filter((r) => r.status === 'ok').length;
const stale = results.filter((r) => r.status === 'stale').length;
const failed = results.filter((r) => r.status === 'error').length;
console.log(`\n${ok} ok, ${stale} vanhentunut, ${failed} epäonnistui`);

if (values.dry) {
  console.log('(--dry: tiedostoa ei kirjoitettu)');
} else {
  // Vain syötteen viittaamat kuvat jäävät; muut ovat vanhoja viikkolistoja.
  const referenced = restaurants.flatMap((r) => (r.images ?? []).map((i: MenuImage) => i.url));
  const removed = await pruneImages(referenced);
  if (removed > 0) console.log(`Poistettu ${removed} vanhaa kuvaa`);

  await mkdir(fileURLToPath(new URL('../site/data/', import.meta.url)), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
  console.log(`Kirjoitettu ${OUT}`);
}

// Epäonnistuminen ei kaada ajoa: vanha data jää näkyviin ja seuraava ajo yrittää
// uudestaan. Vain täysi katastrofi (kaikki epäonnistui) merkitään virheeksi.
if (failed > 0 && failed === selected.length && selected.length > 0) {
  console.error('Kaikkien ravintoloiden haku epäonnistui.');
  process.exit(1);
}

async function scrapeOne(adapter: Adapter): Promise<RestaurantFeed> {
  const prev = previous.find((r) => r.id === adapter.id);
  const meta = {
    id: adapter.id,
    name: adapter.name,
    url: adapter.url,
    ...(adapter.area ? { area: adapter.area } : {}),
    ...(adapter.lunchHours ? { lunchHours: adapter.lunchHours } : {}),
    ...(adapter.price ? { price: adapter.price } : {}),
    ...(adapter.coords ? { coords: adapter.coords } : {}),
  };

  try {
    const result = normalize(await adapter.fetch());
    const days = withinHorizon(result.days);
    const images = await Promise.all(
      (result.images ?? []).map((image) => downloadImage(image, adapter.id)),
    );
    const summary = [
      `${days.length} päivää`,
      ...(images.length > 0 ? [`${images.length} kuvaa`] : []),
    ].join(', ');
    console.log(`  ok    ${adapter.id} — ${summary}`);
    return {
      ...meta,
      days,
      ...(images.length > 0 ? { images } : {}),
      fetchedAt: new Date().toISOString(),
      status: 'ok',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Säilytetään edellinen onnistunut haku, jos siitä on vielä jotain jäljellä.
    const salvaged = withinHorizon(prev?.days ?? []);
    const salvagedImages = prev?.images ?? [];
    const status = salvaged.length > 0 || salvagedImages.length > 0 ? 'stale' : 'error';
    console.warn(`  ${status.padEnd(5)} ${adapter.id} — ${message}`);
    return {
      ...meta,
      days: salvaged,
      ...(salvagedImages.length > 0 ? { images: salvagedImages } : {}),
      fetchedAt: prev?.fetchedAt ?? new Date().toISOString(),
      status,
      error: message,
    };
  }
}

/**
 * Täydentää kävelymatkat toimistolta. Koordinaatit eivät muutu, joten matka
 * lasketaan kerran ja luetaan sen jälkeen edellisestä syötteestä — julkista
 * reitityspalvelua ei ole syytä kuormittaa joka aamu samalla kysymyksellä.
 *
 * Matka lasketaan uudelleen vain jos ravintolan koordinaatit tai toimiston
 * sijainti ovat muuttuneet.
 */
async function resolveDistances(restaurants: RestaurantFeed[]): Promise<void> {
  const officeMoved =
    previousFeed?.office?.lat !== OFFICE.lat || previousFeed?.office?.lng !== OFFICE.lng;
  if (officeMoved && previousFeed?.office) {
    console.log('Toimisto vaihtui — kaikki matkat lasketaan uudelleen.');
  }

  for (const restaurant of restaurants) {
    // Käsin mitattu matka luetaan aina adapterista, ei edellisestä syötteestä,
    // jotta arvon korjaaminen näkyy heti seuraavassa ajossa.
    const override = adapters.find((a) => a.id === restaurant.id)?.walk;
    if (override) {
      restaurant.distance = { ...override, mode: 'manual' };
      continue;
    }

    if (!restaurant.coords) continue;

    const prev = previous.find((r) => r.id === restaurant.id);
    const unchanged =
      !officeMoved &&
      prev?.distance &&
      // Käsin mitattu arvo on juuri poistettu adapterista — reititetään uudelleen.
      prev.distance.mode !== 'manual' &&
      prev.coords?.lat === restaurant.coords.lat &&
      prev.coords?.lng === restaurant.coords.lng;

    if (unchanged) {
      restaurant.distance = prev.distance;
      continue;
    }

    try {
      restaurant.distance = await walkingDistance(OFFICE, restaurant.coords);
      const { meters, minutes } = restaurant.distance;
      console.log(`  matka ${restaurant.id} — ${meters} m, ${minutes} min kävellen`);
    } catch (err) {
      // Reititys on mukavuus, ei vaatimus: linnuntie riittää järjestykseen
      // siihen asti kunnes palvelu vastaa taas.
      restaurant.distance = straightLineDistance(OFFICE, restaurant.coords);
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  matka ${restaurant.id} — reititys ei vastannut (${message}), linnuntie`);
    }
  }
}

/** Adapteri saa palauttaa pelkän päivälistan tai koko MenuResultin. */
function normalize(result: MenuDay[] | MenuResult): MenuResult {
  return Array.isArray(result) ? { days: result } : result;
}

/**
 * Pudottaa liian vanhat ja liian kaukana tulevaisuudessa olevat päivät.
 *
 * Alaraja on kuluvan viikon maanantai, ei tämä päivä: sivulla voi selata koko
 * viikkoa taaksepäin, joten jo menneet arkipäivät pitää säilyttää.
 */
function withinHorizon(days: MenuDay[]): MenuDay[] {
  const from = currentWeek()[0]!;
  const to = addDays(today(), HORIZON_DAYS);
  return days
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date >= from && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function loadPrevious(): Promise<Feed | null> {
  try {
    return JSON.parse(await readFile(OUT, 'utf8')) as Feed;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}
