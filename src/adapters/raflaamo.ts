import type { Adapter, MenuDay, MenuItem, RestaurantMeta } from '../types.ts';
import { addDays } from '../util/dates.ts';
import { getText } from '../util/http.ts';
import { clean, isMeaningful, splitTrailingDiets } from '../util/text.ts';

/**
 * Raflaamo.fi (S-ryhmä). Sivu on Next.js-sovellus, jossa ruokalista renderöidään
 * vasta selaimessa — pelkkä HTML ei siis riitä. Data on kuitenkin mukana
 * ensimmäisessä vastauksessa: Apollo upottaa GraphQL-välimuistinsa sivulle
 * ApolloSSRDataTransport-skriptiin, ja sieltä löytyy "weeklyLunchMenu".
 *
 * Sivulla on viikkovalitsin, mutta valintaa ei tarvitse tehdä: kaikkien
 * kolmen viikon listat tulevat samassa vastauksessa. scrape.ts karsii
 * ylimääräiset päivät.
 *
 * Rakenne viikkoa kohti:
 *   date: { start, end }                    viikon maanantai ja sunnuntai
 *   dailyMenuAvailabilities.<viikonpäivä>   päivän oma lista
 *   availableWithDailyMenus                 joka päivä tarjolla olevat annokset
 *
 * Päivän varsinaiset ruoat eivät ole omina kenttinään vaan noutopöytäannoksen
 * kuvauksessa monirivisenä tekstinä. Rivit joiden lopussa on
 * ruokavaliomerkintä ovat ruokia, muut ovat kuvailua.
 */

const DAY_KEYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

/** Merkinnät sellaisina kuin ne kirjoitetaan annoskuvauksiin. */
const INLINE_CODES = ['L', 'VL', 'G', 'GP', 'VE', 'VEP', 'M', 'K', 'T', 'PÄ'];

/**
 * GraphQL palauttaa ruokavaliot enumeina. Tuntemattomat jätetään pois, jotta
 * suodatinpainikkeisiin ei ilmesty koodinimiä.
 */
const DIET_ENUM: Record<string, string> = {
  GLUTEN_FREE: 'G',
  GLUTEN_FREE_ON_REQUEST: 'G*',
  LACTOSE_FREE: 'L',
  LOW_LACTOSE: 'VL',
  MILK_FREE: 'M',
  DAIRY_FREE: 'M',
  VEGAN: 'VEG',
  VEGAN_ON_REQUEST: 'VEG*',
  VEGETARIAN: 'K',
  SPICY: 'T',
};

/** Lyhenteet kuvausteksteissä samaan muotoon kuin muillakin ravintoloilla. */
const INLINE_ALIASES: Record<string, string> = { VE: 'VEG', VEP: 'VEG*', GP: 'G*' };

export function raflaamo(meta: RestaurantMeta): Adapter {
  return {
    ...meta,
    async fetch(): Promise<MenuDay[]> {
      const html = await getText(meta.url);
      const weeks = extractWeeklyLunchMenu(html);

      const days: MenuDay[] = [];
      for (const week of weeks) {
        const monday = week.date?.start;
        if (!monday) continue;

        // Joka päivä tarjolla olevat annokset toistuvat viikon jokaisella päivällä.
        const standingName = clean(week.availableWithDailyMenus?.name?.default ?? '');
        const standing = portionsOf(week.availableWithDailyMenus).flatMap((p) =>
          toItems(p, standingName || 'Tarjolla aina'),
        );

        DAY_KEYS.forEach((key, index) => {
          const menu = week.dailyMenuAvailabilities?.[key]?.menu;
          const items = portionsOf(menu).flatMap((p) => toItems(p));
          if (items.length === 0) return;
          days.push({ date: addDays(monday, index), items: [...items, ...standing] });
        });
      }

      if (days.length === 0) throw new Error('weeklyLunchMenu ei sisältänyt yhtään päivää');
      return days;
    },
  };
}

/**
 * Poimii weeklyLunchMenu-taulukon sivun Apollo-datasta. Taulukko luetaan
 * sulkeita laskemalla, koska ympärillä oleva data on liian iso ja liian
 * sotkuinen kokonaan jäsennettäväksi.
 *
 * Apollo tallentaa saman kyselyn välimuistiin moneen kertaan — sivulla on
 * toistakymmentä weeklyLunchMenu-kopiota. Vain yhdessä niistä on päivien
 * listat; muissa on samat viikot mutta tyhjät päivät. Kopioiden järjestys
 * vaihtelee pyyntöjen välillä, joten ensimmäinen osuma ei kelpaa: kaikki
 * käydään läpi ja niistä valitaan sisällökkäin.
 */
function extractWeeklyLunchMenu(html: string): Week[] {
  const KEY = '"weeklyLunchMenu":';

  let best: Week[] = [];
  let bestDays = 0;
  let anyFound = false;

  let at = -1;
  while ((at = html.indexOf(KEY, at + 1)) !== -1) {
    const raw = readJsonValue(html, at + KEY.length);
    if (!raw) continue;

    let weeks: Week[];
    try {
      weeks = JSON.parse(raw) as Week[];
    } catch {
      continue; // Katkennut tai muuten kelvoton kopio, kokeillaan seuraavaa.
    }
    anyFound = true;

    const days = countDays(weeks);
    if (days > bestDays) {
      bestDays = days;
      best = weeks;
    }
  }

  if (!anyFound) {
    throw new Error('weeklyLunchMenu puuttuu sivulta — rakenne on voinut muuttua');
  }
  if (bestDays === 0) {
    throw new Error('weeklyLunchMenu löytyi, mutta yksikään kopio ei sisältänyt päiviä');
  }
  return best;
}

function countDays(weeks: Week[]): number {
  return weeks.reduce(
    (total, week) =>
      total +
      Object.values(week.dailyMenuAvailabilities ?? {}).filter((day) => day?.menu).length,
    0,
  );
}

/** Lukee tasapainotetun JSON-arvon, ohittaen merkkijonojen sisällön. */
function readJsonValue(text: string, start: number): string | null {
  const open = text[start];
  if (open !== '[' && open !== '{') return null;
  const close = open === '[' ? ']' : '}';

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === open) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function portionsOf(menu: Menu | null | undefined): Portion[] {
  return (menu?.menuSections ?? []).flatMap((section) => section.portions ?? []);
}

/**
 * Yksi annos tuottaa yhden rivin itsestään ja lisäksi yhden per kuvauksessa
 * lueteltu ruoka.
 */
function toItems(portion: Portion, category?: string): MenuItem[] {
  const lines = (portion.shortDescription?.default ?? '')
    .split('\n')
    .map(clean)
    .filter(Boolean);

  const dishes: MenuItem[] = [];
  const prose: string[] = [];
  for (const line of lines) {
    const parsed = parseInlineDiets(line);
    if (parsed.diets.length > 0 && isMeaningful(parsed.name)) dishes.push(parsed);
    else prose.push(line);
  }

  const name = clean(portion.name?.default ?? '');
  const head: MenuItem = {
    name: prose.length > 0 ? `${name} — ${prose.join(' ')}` : name,
    diets: (portion.diet ?? []).map((d) => DIET_ENUM[d]).filter((d): d is string => Boolean(d)),
  };
  const price = toPrice(portion.price?.normal);
  if (price) head.price = price;
  if (category) head.category = category;

  // Päivän ruoat kuuluvat sen annoksen alle jonka kuvauksessa ne lueteltiin.
  for (const dish of dishes) dish.category = category ?? name;

  return isMeaningful(head.name) ? [head, ...dishes] : dishes;
}

function parseInlineDiets(line: string): MenuItem {
  // Merkinnät voivat olla sulkeissa: "Ohukaisia ja mansikkahilloa (GP, VEP)".
  const unwrapped = line.replace(/\(\s*([A-ZÄÖ*,\s]+)\s*\)\s*$/, ' $1');
  const { name, diets } = splitTrailingDiets(unwrapped, INLINE_CODES);
  return { name, diets: diets.map((d) => INLINE_ALIASES[d] ?? d) };
}

/** Hinnat tulevat sentteinä. */
function toPrice(cents: number | null | undefined): string | undefined {
  if (typeof cents !== 'number' || cents <= 0) return undefined;
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

interface Localized { default?: string | null }
interface Portion {
  name?: Localized;
  shortDescription?: Localized;
  diet?: string[];
  price?: { normal?: number | null } | null;
}
interface Menu {
  name?: Localized;
  menuSections?: { portions?: Portion[] }[];
}
interface Week {
  date?: { start?: string; end?: string };
  availableWithDailyMenus?: Menu | null;
  dailyMenuAvailabilities?: Record<string, { menu?: Menu | null } | null> | null;
}
