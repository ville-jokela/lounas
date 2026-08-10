import type { MenuItem } from '../types.ts';

/** Yleisimmät suomalaiset ruokavaliomerkinnät. */
const KNOWN_DIETS = new Set([
  'G', 'L', 'VL', 'M', 'VE', 'VEG', 'A', 'K', 'SO', 'FODMAP', '*',
]);

/** Siivoaa sisennykset, rivinvaihdot ja tuplavälit yhdeksi riviksi. */
export function clean(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();
}

/**
 * Irrottaa ruokavaliomerkinnät nimen perästä.
 * "Lihapullat ja perunamuusia (G, L)" -> { name: "Lihapullat ja perunamuusia", diets: ["G","L"] }
 * Jättää sulkeet rauhaan jos sisältö ei näytä merkinnöiltä ("Kalakeitto (kirjolohi)").
 */
export function splitDiets(raw: string): { name: string; diets: string[] } {
  const text = clean(raw);
  const m = text.match(/[(\[]([^)\]]*)[)\]]\s*$/);
  if (!m) return { name: text, diets: [] };

  const tokens = m[1]!
    .split(/[,\s/|]+/)
    .map((t) => t.trim().toUpperCase().replace(/[.]$/, ''))
    .filter(Boolean);

  if (tokens.length === 0) return { name: text, diets: [] };
  // Kaikkien osien pitää näyttää merkinnältä, muuten sulkeet ovat osa nimeä.
  if (!tokens.every((t) => KNOWN_DIETS.has(t))) return { name: text, diets: [] };

  return { name: clean(text.slice(0, m.index)), diets: tokens };
}

/**
 * Irrottaa rivin lopusta ruokavaliomerkinnät jotka on kirjoitettu ilman
 * sulkeita: "Perunamuusia L, G" -> { name: "Perunamuusia", diets: ["L", "G"] }.
 *
 * Merkinnät annetaan ravintolakohtaisesti, koska jokaisella on oma
 * selitteensä. Pisin vaihtoehto kokeillaan ensin, jotta "VEG" ei jää "VE":ksi
 * eikä "VL" muutu "L":ksi. Kirjainkoolla ei ole väliä — sama sivu kirjoittaa
 * sekä "Veg" että "VEG".
 */
export function splitTrailingDiets(
  raw: string,
  codes: string[],
): { name: string; diets: string[] } {
  const text = clean(raw);
  const alternatives = [...codes]
    .sort((a, b) => b.length - a.length)
    .map((code) => code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(
    `\\s+((?:${alternatives})(?:\\s*,\\s*(?:${alternatives}))*)\\s*$`,
    'i',
  );

  const match = text.match(pattern);
  if (!match) return { name: text, diets: [] };

  return {
    name: clean(text.slice(0, match.index)),
    diets: match[1]!.split(',').map((d) => d.trim().toUpperCase()),
  };
}

/** Irrottaa hinnan ruoan nimen perästä, esim. "Kasvispata 10,90 €". */
export function splitPrice(raw: string): { name: string; price?: string } {
  const text = clean(raw);
  const m = text.match(/(\d{1,2}[,.]\d{2})\s*(?:€|eur)\s*$/i);
  if (!m) return { name: text };
  return { name: clean(text.slice(0, m.index)), price: `${m[1]!.replace('.', ',')} €` };
}

/** Yhdistää yllä olevat: rivi tekstiä -> MenuItem. */
export function toItem(raw: string, category?: string): MenuItem {
  const withoutPrice = splitPrice(raw);
  const { name, diets } = splitDiets(withoutPrice.name);
  const item: MenuItem = { name, diets };
  if (withoutPrice.price) item.price = withoutPrice.price;
  if (category) item.category = category;
  return item;
}

/** Suodattaa pois tyhjät ja roskarivit ("Salaattipöytä", "-", otsikot). */
export function isMeaningful(name: string): boolean {
  const n = clean(name);
  return n.length > 2 && !/^[-–—•*]+$/.test(n);
}
