import * as cheerio from 'cheerio';
import type { Adapter, MenuDay, MenuItem } from '../types.ts';
import { parseFinnishDate } from '../util/dates.ts';
import { getText } from '../util/http.ts';
import { clean, isMeaningful, splitTrailingDiets } from '../util/text.ts';

/**
 * Museoravintola Valssi (Museokeskus Vapriikki). Lista on siististi jäsennelty:
 * <h3>maanantaina 10.8.</h3> ja sen jälkeen <p>, jossa ruoat on eroteltu
 * <br>-tageilla. Päivämäärä luetaan otsikosta.
 *
 * Valssi tarjoilee lounasta myös viikonloppuisin, joten päiviä tulee seitsemän.
 * Sivusto näyttää vain arkipäivät, mutta viikonloppu jää syötteeseen.
 *
 * HUOM. "EG" EI tarkoita gluteenitonta. Ravintolan oma selite:
 * "EG = käytetty gluteenittomia raaka-aineita, ei gluteeniton
 * (kontaminaatioriski)". Sitä ei siis saa kääntää G:ksi — keliaakikolle se
 * olisi vaarallinen virhe. Merkintä säilytetään omanaan.
 */
const WEEKDAY = /(maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai)/i;

/** Sivun oman selitteen mukaiset merkinnät. */
const DIET_CODES = ['L', 'VL', 'M', 'VE', 'EG'];

/** VE on sama kuin muiden ravintoloiden VEG. EG jätetään tarkoituksella omakseen. */
const ALIASES: Record<string, string> = { VE: 'VEG' };

/** Rivin alussa oleva ryhmittely, esim. "Kasvisruoka: Kasvispullat VE, EG". */
const CATEGORY_PREFIX = /^(Kasvisruoka|Jälkiruoka|Keitto|Salaatti)\s*:\s*(.+)$/i;

export const valssi: Adapter = {
  id: 'valssi',
  name: 'Museoravintola Valssi',
  url: 'https://www.vapriikki.fi/vieraile/museoravintola-valssi/lounaslista/',
  area: 'Alaverstaanraitti 5 (Vapriikki)',
  lunchHours: 'ma–pe 10.45–14, la–su 12–15',
  price: '12,90 € / keittolounas 9,50 €',
  coords: { lat: 61.5029803, lng: 23.7601459 },

  async fetch(): Promise<MenuDay[]> {
    const $ = cheerio.load(await getText(this.url));

    const days: MenuDay[] = [];
    let current: MenuDay | undefined;

    for (const node of $('h3, p').toArray()) {
      const el = $(node);

      if (el.is('h3')) {
        current = undefined;
        const text = clean(el.text());
        if (!WEEKDAY.test(text)) continue;
        const date = parseFinnishDate(text);
        if (!date) continue;
        current = { date, items: [] };
        days.push(current);
        continue;
      }

      if (!current || current.items.length > 0) continue;
      // Ruoat ovat yhdessä kappaleessa <br>-tageilla eroteltuina.
      current.items.push(
        ...toLines($.html(el))
          .filter(isMeaningful)
          .map(toItem),
      );
    }

    const withItems = days.filter((day) => day.items.length > 0);
    if (withItems.length === 0) throw new Error('Päivälistoja ei löytynyt sivulta');
    return withItems;
  },
};

function toLines(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map(clean)
    .filter(Boolean);
}

function toItem(raw: string): MenuItem {
  const grouped = raw.match(CATEGORY_PREFIX);
  const body = grouped ? grouped[2]! : raw;

  const { name, diets } = splitTrailingDiets(body, DIET_CODES);
  const item: MenuItem = { name, diets: diets.map((d) => ALIASES[d] ?? d) };
  if (grouped) item.category = clean(grouped[1]!);
  return item;
}
