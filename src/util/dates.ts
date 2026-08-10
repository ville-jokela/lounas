export const TZ = 'Europe/Helsinki';

const ISO_IN_TZ = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** ISO-päivä (YYYY-MM-DD) Suomen aikavyöhykkeessä. GitHub Actions ajaa UTC:ssä. */
export function isoDate(d: Date = new Date()): string {
  return ISO_IN_TZ.format(d);
}

/**
 * Tämä päivä Suomessa.
 *
 * LOUNAS_TODAY=2026-08-07 pakottaa päivän. Tarpeen kehityksessä, koska
 * ravintoloiden rajapinnat tarjoavat vain kuluvan viikon: viikonloppuna ei ole
 * mitään dataa jota vasten parseria voisi kokeilla.
 */
export function today(): string {
  const override = process.env['LOUNAS_TODAY'];
  if (override) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) {
      throw new Error(`LOUNAS_TODAY ei ole muotoa YYYY-MM-DD: ${override}`);
    }
    return override;
  }
  return isoDate();
}

/** ISO-päivä n päivän päästä. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Viikonpäivä ISO-numerona: 1 = maanantai … 7 = sunnuntai. */
export function dayOfWeek(date: string): number {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Kuluvan viikon maanantai—sunnuntai ISO-päivinä. */
export function currentWeek(from: string = today()): string[] {
  const dow = new Date(`${from}T12:00:00Z`).getUTCDay(); // 0 = su
  const monday = addDays(from, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Muuntaa suomalaisen päivämäärän ISO-muotoon. Hyväksyy "10.8.", "10.8.2026",
 * "10.08" jne. Ilman vuotta oletetaan lähin vuosi nykyhetkestä, jotta
 * vuodenvaihde ei riko listaa.
 */
export function parseFinnishDate(text: string, reference: string = today()): string | null {
  const m = text.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(\d{4})?/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  if (yyyy) return `${yyyy}-${pad(month)}-${pad(day)}`;

  const refYear = Number(reference.slice(0, 4));
  const candidates = [refYear - 1, refYear, refYear + 1].map(
    (y) => `${y}-${pad(month)}-${pad(day)}`,
  );
  let best = candidates[1]!;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const distance = Math.abs(Date.parse(c) - Date.parse(reference));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = c;
    }
  }
  return best;
}

const WEEKDAYS: Record<string, number> = {
  ma: 1, maanantai: 1,
  ti: 2, tiistai: 2,
  ke: 3, keskiviikko: 3,
  to: 4, torstai: 4,
  pe: 5, perjantai: 5,
  la: 6, lauantai: 6,
  su: 0, sunnuntai: 0,
};

/** Muuntaa viikonpäivän nimen ("ma", "keskiviikko") kuluvan viikon ISO-päiväksi. */
export function weekdayToDate(name: string, week: string[] = currentWeek()): string | null {
  const key = name.trim().toLowerCase().replace(/[^a-zäö]/g, '');
  const dow = WEEKDAYS[key] ?? WEEKDAYS[key.slice(0, 2)];
  if (dow === undefined) return null;
  // week on ma..su, joten sunnuntai on indeksissä 6.
  return week[dow === 0 ? 6 : dow - 1] ?? null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
