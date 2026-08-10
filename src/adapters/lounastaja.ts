import type { Adapter, MenuDay, MenuItem, RestaurantMeta } from '../types.ts';
import { getJson } from '../util/http.ts';
import { clean } from '../util/text.ts';

/**
 * lounastaja.app on suomalainen lounaslistapalvelu, jota moni ravintola käyttää.
 * Ravintolan sivulla on widget:
 *
 *   <div data-lounastaja-widget-id="..." data-api-key="5612c69a-...">
 *   <script src="https://lounastaja.app/widget/base.min.js">
 *
 * Widget tarjoaa itse "jsonWeekFeedUrl"-osoitteen, eli tämä JSON-syöte on
 * tarkoitettu ulkopuoliseen käyttöön — sitä ei tarvitse kaivaa HTML:stä.
 * data-api-key on julkinen widget-avain, ei salaisuus; se näkyy sivun lähdekoodissa.
 *
 * Rajoite: rajapinta antaa vain kuluvan viikon ("active"). Viikko vaihtuu
 * maanantaina, joten viikonloppuna seuraavan viikon listaa ei ole vielä saatavilla.
 */
const API = 'https://lounastaja.app/api/v1';

export function lounastaja(meta: RestaurantMeta & { apiKey: string }): Adapter {
  const { apiKey, ...rest } = meta;
  return {
    ...rest,
    async fetch(): Promise<MenuDay[]> {
      const url = `${API}/week/${apiKey}/active?language=fi`;
      const res = await getJson<LounastajaResponse>(url);
      if (!res.success || !res.data) {
        throw new Error(res.message ?? 'lounastaja palautti success=false');
      }
      return res.data.week.days
        // Piilotetut päivät ovat ravintolan itsensä pois kytkemiä.
        .filter((day) => !day.isHidden)
        .map(toDay);
    },
  };
}

function toDay(day: LounastajaDay): MenuDay {
  const result: MenuDay = {
    date: day.dateString,
    items: day.lunches.map(toItem),
  };
  if (day.isClosed) {
    result.closed = true;
    result.note = clean(day.closedText?.fi ?? '') || 'Suljettu';
  }
  return result;
}

function toItem(lunch: LounastajaLunch): MenuItem {
  const { category, name } = splitCategory(clean(lunch.title?.fi ?? ''));
  const description = clean(lunch.description?.fi ?? '');

  const item: MenuItem = {
    name: description ? `${name} — ${description}` : name,
    diets: (lunch.allergens ?? [])
      .map((a) => clean(a.abbreviation?.fi ?? ''))
      .filter(Boolean),
  };
  if (category) item.category = category;

  const price = lunch.normalPrice;
  if (price?.price) item.price = clean(`${price.price} ${price.unit?.fi ?? '€'}`);

  return item;
}

/**
 * Tampella kirjoittaa ruokalajin tyypin otsikon eteen versaalilla:
 * "LÄMMIN RUOKA: Pasta di Carne..." -> category "Lämmin ruoka".
 * Jos kaksoispistettä ei ole tai etuosa ei ole versaalia, nimi jää sellaisenaan.
 */
function splitCategory(title: string): { category?: string; name: string } {
  const m = title.match(/^([A-ZÄÖÅ][A-ZÄÖÅ0-9\s-]{2,30}):\s*(.+)$/);
  if (!m) return { name: title };
  const [, rawCategory, name] = m;
  return { category: sentenceCase(clean(rawCategory!)), name: clean(name!) };
}

function sentenceCase(text: string): string {
  return text.charAt(0) + text.slice(1).toLowerCase();
}

interface LounastajaResponse {
  success: boolean;
  message: string | null;
  data: { week: { days: LounastajaDay[] } } | null;
}

interface LounastajaDay {
  dateString: string;
  isHidden: boolean;
  isClosed: boolean;
  closedText?: Localized | null;
  lunches: LounastajaLunch[];
}

interface LounastajaLunch {
  title?: Localized;
  description?: Localized;
  allergens?: { abbreviation?: Localized }[];
  normalPrice?: { price?: string; unit?: Localized } | null;
}

interface Localized {
  fi?: string | null;
  en?: string | null;
}
