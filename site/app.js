const DAY_NAMES = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const TZ = 'Europe/Helsinki';

/**
 * Oikea tämä päivä. Vain tämä saa "Tänään"-leiman, myös kehityksessä:
 * ?date-parametri ei tee toisesta päivästä tätä päivää.
 */
const TODAY = todayInHelsinki();

/**
 * Päivä jonka ympäriltä viikko näytetään ja joka valitaan aluksi. Normaalisti
 * tämä päivä, mutta ?date=2026-08-07 siirtää katselun toiseen viikkoon.
 */
const REFERENCE = overrideDate() ?? TODAY;

const prefs = loadPrefs();

const state = {
  feed: null,
  date: REFERENCE,
  // Ruokavaliomerkinnät kiinnostavat vain osaa käyttäjistä. Ne jotka eivät
  // tarvitse niitä saavat piilottaa sekä merkinnät että suodattimet pysyvästi;
  // ne jotka tarvitsevat, valitsevat suodattimensa kerran.
  showDiets: prefs.showDiets ?? true,
  diets: new Set(prefs.diets ?? []),
  query: '',
};

const els = {
  updated: document.getElementById('updated'),
  days: document.getElementById('days'),
  diets: document.getElementById('diets'),
  dietToggle: document.getElementById('diet-toggle'),
  search: document.getElementById('search'),
  list: document.getElementById('list'),
};

init();

async function init() {
  els.search.addEventListener('input', () => {
    state.query = els.search.value.trim().toLowerCase();
    render();
  });

  els.dietToggle.addEventListener('click', () => {
    state.showDiets = !state.showDiets;
    // Piilotettu suodatin ei saa jäädä päälle näkymättömiin.
    if (!state.showDiets) state.diets.clear();
    applyDietVisibility();
    savePrefs();
    renderDietFilters();
    render();
  });
  applyDietVisibility();

  try {
    // Cache-bustaus: GitHub Pages tarjoilee JSONin pitkällä cachella.
    const res = await fetch(`data/menus.json?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.feed = await res.json();
  } catch (err) {
    els.list.innerHTML = `<p class="empty">Listojen lataus epäonnistui: ${escapeHtml(
      err.message,
    )}</p>`;
    return;
  }

  renderUpdated();
  renderDayTabs();
  renderDietFilters();
  render();
}

function renderUpdated() {
  const d = new Date(state.feed.generatedAt);
  const parts = [
    `Päivitetty ${d.toLocaleString('fi-FI', {
      timeZone: TZ,
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
  ];

  // Lista on järjestetty kävelymatkan mukaan, joten lukijan pitää tietää mistä
  // matka on mitattu — muuten luvut eivät tarkoita mitään.
  const office = state.feed.office?.address;
  if (office) parts.push(`kävelymatkat osoitteesta ${office}`);

  els.updated.textContent = parts.join(' · ');
}

/** Näkyvän viikon maanantai—perjantai, myös jo menneet päivät. */
function weekdaysOfCurrentWeek() {
  const [y, m, d] = REFERENCE.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = su
  const monday = addDaysIso(REFERENCE, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 5 }, (_, i) => addDaysIso(monday, i));
}

/**
 * Päivävalitsimen päivät: kuluva arkiviikko, ei enempää.
 *
 * Syötteessä on päiviä pidemmällekin, mutta niitä ei näytetä: staattisen listan
 * ravintolalla on lounas joka arkipäivä ikuisesti, jolloin valitsin täyttyisi
 * viikkojen mittaisella rivillä päiviä joille ei ole oikeaa tietoa.
 */
function availableDates() {
  return weekdaysOfCurrentWeek();
}

/** Tämä päivä jos se on listalla, muuten seuraava tuleva, muuten viimeinen. */
function defaultDate(dates) {
  if (dates.includes(TODAY)) return TODAY;
  return dates.find((d) => d > TODAY) ?? dates[dates.length - 1];
}

function renderDayTabs() {
  const dates = availableDates();
  if (!dates.includes(state.date)) state.date = defaultDate(dates);

  els.days.replaceChildren(
    ...dates.map((date) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = dayLabel(date);
      btn.setAttribute('aria-pressed', String(date === state.date));
      if (date < TODAY) btn.classList.add('past');
      btn.addEventListener('click', () => {
        state.date = date;
        renderDayTabs();
        render();
      });
      return btn;
    }),
  );
}

function addDaysIso(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(date) {
  if (date === TODAY) return 'Tänään';
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAY_NAMES[dow]} ${d}.${m}.`;
}

function applyDietVisibility() {
  els.dietToggle.setAttribute('aria-pressed', String(state.showDiets));
  els.diets.hidden = !state.showDiets;
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem('lounas.prefs') ?? '{}');
  } catch {
    return {}; // Yksityinen selaus tai estetty tallennus — oletukset kelpaavat.
  }
}

function savePrefs() {
  try {
    localStorage.setItem(
      'lounas.prefs',
      JSON.stringify({ showDiets: state.showDiets, diets: [...state.diets] }),
    );
  } catch {
    /* Asetusten tallennus ei ole sivun toiminnan kannalta välttämätöntä. */
  }
}

/** Suodatinnapit rakennetaan datasta — eri ravintolat käyttävät eri merkintöjä. */
function renderDietFilters() {
  if (!state.showDiets) {
    els.diets.replaceChildren();
    return;
  }
  const counts = new Map();
  for (const r of state.feed.restaurants) {
    for (const day of r.days) {
      for (const item of day.items) {
        for (const diet of item.diets) counts.set(diet, (counts.get(diet) ?? 0) + 1);
      }
    }
  }
  const diets = [...counts.keys()].sort();

  els.diets.replaceChildren(
    ...diets.map((diet) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = diet;
      btn.title = `Näytä vain ${diet}`;
      btn.setAttribute('aria-pressed', String(state.diets.has(diet)));
      btn.addEventListener('click', () => {
        if (state.diets.has(diet)) state.diets.delete(diet);
        else state.diets.add(diet);
        btn.setAttribute('aria-pressed', String(state.diets.has(diet)));
        savePrefs();
        render();
      });
      return btn;
    }),
  );
}

/** Lähin ensin. Ravintolat joilta matka puuttuu jäävät loppuun. */
function byDistance(a, b) {
  const da = a.distance?.meters ?? Infinity;
  const db = b.distance?.meters ?? Infinity;
  return da - db;
}

function formatDistance(distance) {
  const km = distance.meters >= 1000;
  const length = km
    ? `${(distance.meters / 1000).toFixed(1).replace('.', ',')} km`
    : `${distance.meters} m`;
  if (distance.mode === 'straight-line') return `${length} linnuntietä`;
  // Käsin mitattu on myös kävelymatka, se vain ei tule reitittimeltä.
  return distance.minutes ? `${distance.minutes} min kävellen (${length})` : length;
}

function render() {
  const cards = [];

  for (const restaurant of [...state.feed.restaurants].sort(byDistance)) {
    const day = restaurant.days.find((d) => d.date === state.date);
    // Ravintolan nimeen osuva haku näyttää sen koko listan, ei vain osumia.
    const nameHit = Boolean(state.query) && restaurant.name.toLowerCase().includes(state.query);
    const items = filterItems(day?.items ?? [], { skipQuery: nameHit });

    if (state.query && !nameHit && items.length === 0) continue;
    if (state.diets.size > 0 && items.length === 0) continue;

    cards.push(renderRestaurant(restaurant, day, items));
  }

  els.list.replaceChildren(
    ...(cards.length > 0
      ? cards
      : [el('p', { class: 'empty' }, 'Ei osumia tällä valinnalla.')]),
  );
}

function filterItems(items, { skipQuery = false } = {}) {
  return items.filter((item) => {
    if (state.diets.size > 0 && !item.diets.some((d) => state.diets.has(d))) return false;
    if (state.query && !skipQuery && !state.query.split(/\s+/).every((w) => matches(item, w))) {
      return false;
    }
    return true;
  });
}

function matches(item, word) {
  return (
    item.name.toLowerCase().includes(word) ||
    (item.category ?? '').toLowerCase().includes(word)
  );
}

function renderRestaurant(restaurant, day, items) {
  const card = el('article', { class: 'restaurant' });

  const title = el('h2');
  title.append(el('a', { href: restaurant.url, target: '_blank', rel: 'noopener' }, restaurant.name));
  if (restaurant.status === 'stale') {
    title.append(el('span', { class: 'badge', title: restaurant.error ?? '' }, 'vanha tieto'));
  }
  card.append(title);

  const meta = el('p', { class: 'meta' });
  if (restaurant.distance) {
    meta.append(el('span', { class: 'distance' }, formatDistance(restaurant.distance)));
  }
  for (const part of [restaurant.area, restaurant.lunchHours, restaurant.price]) {
    if (part) meta.append(el('span', {}, part));
  }
  if (meta.childElementCount > 0) card.append(meta);

  if (restaurant.status === 'error') {
    card.append(el('p', { class: 'note' }, 'Listan haku epäonnistui.'));
    return card;
  }

  // Kuvalista koskee koko viikkoa, joten se näytetään päivävalinnasta
  // riippumatta — päivämäärät lukevat kuvassa.
  if (restaurant.images?.length) {
    card.append(renderImages(restaurant.images));
    return card;
  }

  if (!day || (day.items.length === 0 && !day.note)) {
    card.append(el('p', { class: 'note' }, 'Ei listaa tälle päivälle.'));
    return card;
  }
  if (day.closed || day.note) {
    card.append(el('p', { class: 'note' }, day.note ?? 'Suljettu'));
  }

  if (items.length > 0) {
    const ul = el('ul', { class: 'items' });
    for (const group of groupByCategory(items)) {
      group.items.forEach((item, index) => {
        const li = el('li');
        if (index === 0 && group.category) {
          const heading = el('span', { class: 'category' }, group.category);
          if (group.sharedPrice) {
            heading.append(el('span', { class: 'category-price' }, group.sharedPrice));
          }
          li.append(heading);
        }
        li.append(el('span', {}, item.name));
        if (state.showDiets) {
          for (const diet of item.diets) li.append(el('span', { class: 'diet' }, diet));
        }
        // Yhteishinta on jo otsikossa, ei toisteta joka rivillä.
        if (item.price && !group.sharedPrice) {
          li.append(el('span', { class: 'price' }, item.price));
        }
        ul.append(li);
      });
    }
    card.append(ul);
  }

  return card;
}

/**
 * Ryhmittelee peräkkäiset ruoat kategorian mukaan ja päättelee kuuluuko hinta
 * otsikkoon vai riveille.
 *
 * Buffetlinjastolla — "So Good 14,00 €" — sama hinta toistuisi jokaisella
 * rivillä, vaikka se koskee koko linjastoa. Jos ryhmän kaikilla ruoilla on sama
 * hinta, se näytetään kerran otsikossa. Jos hinnat eroavat (esim. lounaspihvit
 * 12,80–16,70 €), ne kuuluvat riveille.
 */
function groupByCategory(items) {
  const groups = [];
  for (const item of items) {
    const category = item.category ?? null;
    const last = groups[groups.length - 1];
    if (last && last.category === category) last.items.push(item);
    else groups.push({ category, items: [item] });
  }

  for (const group of groups) {
    const prices = new Set(group.items.map((item) => item.price ?? ''));
    const [only] = [...prices];
    group.sharedPrice = group.category && prices.size === 1 && only ? only : null;
  }
  return groups;
}

function renderImages(images) {
  const wrap = el('div', { class: 'menu-images' });
  wrap.append(
    el(
      'p',
      { class: 'note' },
      'Ravintola julkaisee listan kuvana — tarkista päivämäärät kuvasta.',
    ),
  );
  for (const image of images) {
    const figure = el('figure');
    const img = el('img', {
      src: image.url,
      alt: image.caption ?? 'Lounaslista',
      loading: 'lazy',
    });
    // Klikkaus avaa täysikokoisen kuvan, jos pikkukuva on vaikea lukea.
    const link = el('a', { href: image.url, target: '_blank', rel: 'noopener' });
    link.append(img);
    figure.append(link);
    if (image.caption) figure.append(el('figcaption', {}, image.caption));
    wrap.append(figure);
  }
  return wrap;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** ?date=2026-08-07 siirtää näkyvän viikon. Kehitystä varten. */
function overrideDate() {
  const value = new URLSearchParams(location.search).get('date');
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function todayInHelsinki() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
