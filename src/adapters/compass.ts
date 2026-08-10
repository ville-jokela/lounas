import type { Adapter, MenuDay, MenuItem, RestaurantMeta } from '../types.ts';
import { addDays, currentWeek } from '../util/dates.ts';
import { getJson } from '../util/http.ts';
import { clean, isMeaningful } from '../util/text.ts';

/**
 * Compass Group / Food & Co. Ravintolan sivulla lista on upotettuna
 * window.__INITIAL_MENU__ -muuttujaan, mutta samat tiedot saa siistimmin
 * rajapinnasta, jota sivu itse käyttää:
 *
 *   /menuapi/week-menus?costCenter=<numero>&language=fi&date=<viikon maanantai>
 *
 * costCenter löytyy ravintolan sivun lähdekoodista (`"costCenter":"3231"`).
 * Huomaa että vanhempi /menuapi/feed/json käyttää nimeä costNumber ja palauttaa
 * vain yhden päivän — week-menus on se jota kannattaa käyttää.
 *
 * Rajapinta antaa yhden viikon kerrallaan, joten haetaan kuluva ja seuraava.
 * Seuraava viikko on usein vielä tyhjä; se ei ole virhe.
 */
const API = 'https://www.compass-group.fi/menuapi/week-menus';

/**
 * Compassin omat merkinnät. Sivulla ei ole selitettä, joten vain yleisesti
 * tunnetut ruokavaliokoodit otetaan mukaan. Loput (*, A, ILM, VS) jätetään
 * pois: niiden merkitystä ei voi lukea sivulta, eikä suodatinriville haluta
 * koodeja joita kukaan ei osaa tulkita.
 */
const DIETS: Record<string, string> = {
  G: 'G',
  L: 'L',
  VL: 'VL',
  M: 'M',
  Veg: 'VEG',
  VEG: 'VEG',
};

export function compass(meta: RestaurantMeta & { costCenter: string }): Adapter {
  const { costCenter, ...rest } = meta;

  return {
    ...rest,
    async fetch(): Promise<MenuDay[]> {
      const monday = currentWeek()[0]!;
      const days: MenuDay[] = [];
      let firstWeekFailed = false;

      for (const [index, weekStart] of [monday, addDays(monday, 7)].entries()) {
        const url = `${API}?costCenter=${encodeURIComponent(costCenter)}&language=fi&date=${weekStart}`;
        let week: WeekResponse;
        try {
          week = await getJson<WeekResponse>(url);
        } catch (err) {
          // Kuluvan viikon epäonnistuminen on virhe, seuraavan ei.
          if (index === 0) firstWeekFailed = true;
          continue;
        }
        for (const day of week.menus ?? []) days.push(...toDay(day));
      }

      if (firstWeekFailed) throw new Error('Kuluvan viikon haku epäonnistui');
      if (days.length === 0) throw new Error('Rajapinta ei palauttanut yhtään päivää');
      return days;
    },
  };
}

function toDay(day: ApiDay): MenuDay[] {
  const date = (day.date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const items = (day.menuPackages ?? [])
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .flatMap(toItems);

  return items.length > 0 ? [{ date, items }] : [];
}

function toItems(pkg: ApiPackage): MenuItem[] {
  const { label, price } = splitPackagePrice(pkg.name ?? '');

  return (pkg.meals ?? [])
    .map((meal) => clean(meal.name ?? ''))
    .map((name, i) => ({ name, meal: pkg.meals![i]! }))
    .filter(({ name }) => isMeaningful(name))
    .map(({ name, meal }) => {
      const item: MenuItem = {
        name,
        diets: [...new Set((meal.diets ?? []).map((d) => DIETS[d]).filter(Boolean))] as string[],
      };
      if (price) item.price = price;
      if (label) item.category = label;
      return item;
    });
}

/**
 * Kokonaisuuden nimessä on hinta mukana: "So Good 14.00€",
 * "KAHVILASTA - Päivän pinsa 5,90€/11,90€". Erotellaan, jotta otsikko pysyy
 * luettavana ja hinta näkyy samassa muodossa kuin muilla ravintoloilla.
 */
function splitPackagePrice(raw: string): { label: string; price?: string } {
  const text = clean(raw);
  const match = text.match(/^(.*?)[\s–-]*((?:\d+[.,]\d{2}\s*€)(?:\s*\/\s*\d+[.,]\d{2}\s*€)*)$/);
  if (!match) return { label: text };

  const price = match[2]!.replace(/\./g, ',').replace(/\s*€/g, ' €').replace(/\s*\/\s*/g, ' / ');
  return { label: clean(match[1]!), price: clean(price) };
}

interface ApiMeal {
  name?: string;
  diets?: string[];
}
interface ApiPackage {
  sortOrder?: number;
  name?: string;
  meals?: ApiMeal[];
}
interface ApiDay {
  date?: string;
  menuPackages?: ApiPackage[];
}
interface WeekResponse {
  weekNumber?: number;
  menus?: ApiDay[];
}
