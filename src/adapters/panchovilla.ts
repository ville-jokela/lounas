import * as cheerio from 'cheerio';
import type { Adapter, MenuDay, MenuItem, RestaurantMeta } from '../types.ts';
import { parseFinnishDate } from '../util/dates.ts';
import { getText } from '../util/http.ts';
import { clean, isMeaningful } from '../util/text.ts';

/**
 * Pancho Villa. Lista on valmiina sivun HTML:ssä ja siististi luokiteltuna:
 * jokainen päivä on oma lohkonsa, jossa on <h3>-otsikko ja .lunch-item-rivit.
 *
 * Otsikossa lukee päivämäärä, ja kuluvan päivän kohdalla viikonpäivän tilalla
 * lukee "Tänään" ("Tänään 10.8."). Päivä luetaan siis päivämäärästä eikä
 * viikonpäivän nimestä — muuten tämä päivä jäisi tunnistamatta.
 *
 * Ketjulla on ravintoloita ympäri Suomen, joten adapteri on tehdas.
 */

/** Hinta annoksen nimen perässä, mahdollisesti kaksi ("13,70 € / 16,50 €"). */
const TRAILING_PRICE = /^(.*?)[\s]*((?:\d+[,.]\d{2}\s*€)(?:\s*\/\s*\d+[,.]\d{2}\s*€)*)$/;

export function panchoVilla(meta: RestaurantMeta): Adapter {
  return {
    ...meta,
    async fetch(): Promise<MenuDay[]> {
      const $ = cheerio.load(await getText(meta.url));

      const days: MenuDay[] = [];
      for (const block of $('#lunch .wp-block-details').toArray()) {
        const el = $(block);
        const date = parseFinnishDate(clean(el.find('h3').first().text()));
        if (!date) continue;

        const items = el
          .find('.lunch-item')
          .toArray()
          .map((node) => toItem($(node)))
          .filter((item): item is MenuItem => item !== null);

        if (items.length > 0) days.push({ date, items });
      }

      if (days.length === 0) throw new Error('Lounaslohkoja ei löytynyt sivulta');
      return days;
    },
  };
}

/** Valinta sellaisena kuin $() sen palauttaa. */
type Selection = ReturnType<cheerio.CheerioAPI>;

function toItem(el: Selection): MenuItem | null {
  const titleEl = el.find('.lunch-item__title').first().clone();

  // Merkinnät ovat otsikon sisällä omassa spanissaan; irrotetaan ennen tekstiä.
  const diets = clean(titleEl.find('.lunch-item__diets').text())
    .split(/[,\s]+/)
    .map((d) => d.trim().toUpperCase())
    .filter(Boolean);
  titleEl.find('.lunch-item__diets').remove();

  const { name, price } = splitPrice(clean(titleEl.text()));
  if (!isMeaningful(name)) return null;

  const description = clean(el.find('.lunch-item__content').first().text());
  const item: MenuItem = {
    name: description ? `${name} — ${description}` : name,
    diets: diets.map((d) => (d === 'VE' ? 'VEG' : d)),
  };
  if (price) item.price = price;
  return item;
}

function splitPrice(raw: string): { name: string; price?: string } {
  const match = raw.match(TRAILING_PRICE);
  if (!match) return { name: raw };

  const price = match[2]!
    .replace(/\./g, ',')
    .replace(/\s*€/g, ' €')
    .replace(/\s*\/\s*/g, ' / ');
  return { name: clean(match[1]!), price: clean(price) };
}
