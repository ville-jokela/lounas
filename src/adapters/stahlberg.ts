import * as cheerio from 'cheerio';
import type { Adapter, MenuDay, MenuItem, RestaurantMeta } from '../types.ts';
import { getText } from '../util/http.ts';
import { clean, isMeaningful, splitTrailingDiets } from '../util/text.ts';

/**
 * Ståhlbergin lounaskahvilat. Ketjulla on toimipisteitä ympäri Pirkanmaata ja
 * jokaisella on samanlainen sivu, joten uusi paikka on yksi rivi
 * src/adapters/index.ts:ään — parseria ei tarvitse kirjoittaa uudelleen.
 *
 * Sivun rakenne: jokaista päivää kohti on <h3>-otsikko ("Maanantai
 * 10:30-15:00") ja sen vieressä päivämäärä, ja ruoat ovat omassa
 * taulukossaan (table.ruokalista).
 *
 * Otsikko ja taulukko ovat eri haaroissa elementtipuuta, joten niitä ei voi
 * hakea toistensa sisältä. Sen sijaan molemmat käydään läpi
 * dokumenttijärjestyksessä: otsikko avaa päivän, seuraava taulukko täyttää sen.
 */

/** Sivun oman allergeeniselitteen merkinnät. */
const DIET_CODES = ['L', 'VL', 'G', 'VE', 'VEG', 'M', 'MU'];
const WEEKDAY = /(maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai)/i;
const FULL_DATE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;

export function stahlberg(meta: RestaurantMeta): Adapter {
  return {
    ...meta,
    async fetch(): Promise<MenuDay[]> {
      const $ = cheerio.load(await getText(meta.url));

      const days: MenuDay[] = [];
      let current: MenuDay | undefined;

      for (const node of $('h3, table.ruokalista').toArray()) {
        const el = $(node);

        if (el.is('h3')) {
          current = undefined;
          if (!WEEKDAY.test(el.text())) continue;
          // Päivämäärä on otsikon vieressä samassa laatikossa, ei otsikossa.
          const date = toIsoDate(el.parent().text());
          if (!date) continue;
          current = { date, items: [] };
          days.push(current);
          continue;
        }

        if (!current) continue;
        current.items.push(
          ...el
            .find('td')
            .toArray()
            .map((td) => clean($(td).text()))
            .filter(isMeaningful)
            .map(toItem),
        );
      }

      const withItems = days.filter((day) => day.items.length > 0);
      if (withItems.length === 0) throw new Error('Päivälistoja ei löytynyt sivulta');
      return withItems;
    },
  };
}

function toIsoDate(text: string): string | null {
  const m = text.match(FULL_DATE);
  if (!m) return null;
  const [, day, month, year] = m;
  return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
}

function toItem(raw: string): MenuItem {
  const { name, diets } = splitTrailingDiets(raw, DIET_CODES);
  const item: MenuItem = {
    name,
    // Sivu kirjoittaa vegaanisen milloin "VE", milloin "Veg" — sama asia.
    diets: diets.map((d) => (d === 'VE' ? 'VEG' : d)),
  };
  // "Jälkiruoka: Mangorahka" on oma ryhmänsä, ei pääruoka.
  const dessert = name.match(/^Jälkiruoka:\s*(.+)$/i);
  if (dessert) {
    item.name = clean(dessert[1]!);
    item.category = 'Jälkiruoka';
  }
  return item;
}
