import type { Adapter, MenuDay, MenuItem, RestaurantMeta } from '../types.ts';
import { addDays, currentWeek, dayOfWeek } from '../util/dates.ts';
import { getText } from '../util/http.ts';

/** Montako päivää eteenpäin päiviä tuotetaan. scrape.ts leikkaa ylimääräiset. */
const GENERATE_DAYS = 28;

/**
 * Lista joko sellaisenaan (sama joka päivä) tai viikonpäivittäin, kun ravintola
 * kierrättää samaa viikkolistaa: avain 1 = maanantai … 7 = sunnuntai.
 */
type StaticItems = MenuItem[] | Record<number, MenuItem[]>;

interface StaticOptions extends RestaurantMeta {
  items: StaticItems;
  /** Sama huomautus joka päivälle, esim. mitä hintaan sisältyy. */
  note?: string;
  /**
   * Päivät joina lounasta tarjoillaan. Oletus ma–pe, tai viikonpäivittäisessä
   * listassa ne päivät joille on kirjoitettu ruokia.
   */
  weekdays?: number[];
  /**
   * Teksti arkipäiville joina lounasta ei ole. Ilman tätä sivu sanoo "ei listaa
   * tälle päivälle", mikä antaa ymmärtää että tieto puuttuu — vaikka tosiasiassa
   * lounasta ei yksinkertaisesti tarjoilla.
   */
  closedNote?: string;
  /**
   * Merkkijonot joiden pitää löytyä ravintolan sivulta. Jos jokin katoaa,
   * haku epäonnistuu ja ravintola merkitään vanhentuneeksi.
   */
  canaries?: string[];
}

/**
 * Ravintola jonka lounas ei vaihdu päivittäin — tyypillisesti buffet, jossa on
 * sama tarjonta joka arkipäivä. Listaa ei ole mitään mieltä hakea joka aamu,
 * joten se kirjoitetaan tähän adapteriin.
 *
 * Ongelma staattisessa listassa on se, että se valehtelee huomaamatta: hinta
 * nousee tai lounasaika muuttuu, eikä mikään kerro siitä. Siksi `canaries`:
 * adapteri hakee sivun ja tarkistaa että odotetut merkkijonot ovat yhä siellä.
 * Kun ne katoavat, ravintola saa "vanha tieto" -merkinnän ja ajon lokiin tulee
 * virhe — eli tieto siitä että tämä tiedosto pitää päivittää.
 */
export function staticMenu(options: StaticOptions): Adapter {
  const { items, note, weekdays, closedNote, canaries = [], ...meta } = options;

  const sameEveryDay = Array.isArray(items);
  const itemsFor = (dow: number): MenuItem[] =>
    sameEveryDay ? items : (items[dow] ?? []);

  // Viikonpäivittäisessä listassa tarjoilupäivät voi päätellä listasta itsestään.
  const serving =
    weekdays ??
    (sameEveryDay
      ? [1, 2, 3, 4, 5]
      : Object.keys(items).map(Number).filter((d) => itemsFor(d).length > 0).sort());

  return {
    ...meta,
    async fetch(): Promise<MenuDay[]> {
      if (canaries.length > 0) await checkCanaries(meta.url, canaries);

      const start = currentWeek()[0]!;
      const days: MenuDay[] = [];
      for (let i = 0; i < GENERATE_DAYS; i++) {
        const date = addDays(start, i);
        const dow = dayOfWeek(date);

        const dayItems = serving.includes(dow) ? itemsFor(dow) : [];
        if (dayItems.length > 0) {
          days.push({ date, items: dayItems, ...(note ? { note } : {}) });
          continue;
        }
        // Arkipäivä jona lounasta ei tarjoilla: sanotaan se ääneen.
        if (closedNote && dow <= 5) {
          days.push({ date, items: [], closed: true, note: closedNote });
        }
      }
      return days;
    },
  };
}

async function checkCanaries(url: string, canaries: string[]): Promise<void> {
  const text = stripTags(await getText(url));
  const missing = canaries.filter((canary) => !text.includes(canary));
  if (missing.length > 0) {
    throw new Error(
      `Sivun sisältö on muuttunut, tarkista adapterin tiedot. ` +
        `Puuttuu: ${missing.map((m) => JSON.stringify(m)).join(', ')}`,
    );
  }
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ');
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', euro: '€',
  auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', aring: 'å', Aring: 'Å',
  rsquo: '’', lsquo: '‘', ldquo: '”', rdquo: '”', ndash: '–', mdash: '—', bull: '•',
};

/**
 * Osa sivuista kirjoittaa ääkköset entiteetteinä (&auml;). Ilman purkamista
 * kanarialinnuksi ei kelpaisi yksikään suomenkielinen merkkijono, mikä on
 * hankala ansa — merkkijono näyttää sivulla oikealta mutta ei löydy koskaan.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body] ?? match;
  });
}
