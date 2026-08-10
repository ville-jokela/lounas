/** Yksi ruokalaji listalla. */
export interface MenuItem {
  /** Ruoan nimi sellaisenaan, ilman ruokavaliomerkintöjä. */
  name: string;
  /** Ruokavaliomerkinnät: "G", "L", "VL", "M", "VEG", "*" jne. */
  diets: string[];
  /** Hinta tekstinä jos ravintola ilmoittaa sen ruokakohtaisesti, esim. "12,40 €". */
  price?: string;
  /** Vapaa ryhmittely, esim. "Kotiruoka", "Kasvis", "Keitto", "Salaattibaari". */
  category?: string;
}

/** Yhden päivän lista yhdessä ravintolassa. */
export interface MenuDay {
  /** ISO-päivä paikallisessa ajassa, esim. "2026-08-10". */
  date: string;
  items: MenuItem[];
  /** Esim. "Suljettu" tai "Vain à la carte". */
  note?: string;
  closed?: boolean;
}

/**
 * Lounaslista kuvana. Osa ravintoloista julkaisee koko viikon listan pelkkänä
 * kuvana, jolloin ruokia ei voi jakaa päiville eikä suodattaa — kuva näytetään
 * sellaisenaan ja päivämäärät lukevat kuvassa.
 */
export interface MenuImage {
  /** Polku sivuston omaan kopioon, esim. "data/images/finlayson-a1b2c3.png". */
  url: string;
  caption?: string;
  /** Alkuperäinen osoite ravintolan palvelimella, lähdeviitteeksi. */
  sourceUrl?: string;
}

/**
 * Adapterin paluuarvo. Pelkkä MenuDay[] riittää tavallisessa tapauksessa;
 * tämä muoto on niitä varten jotka palauttavat myös kuvia.
 */
export interface MenuResult {
  days: MenuDay[];
  images?: MenuImage[];
}

export interface Coords {
  lat: number;
  lng: number;
}

export interface Distance {
  meters: number;
  /** Kävelyaika minuutteina. Puuttuu jos matka on vain linnuntietä. */
  minutes?: number;
  /**
   * walking       = reititetty OSRM:llä
   * manual        = käsin mitattu, ohittaa reitityksen
   * straight-line = linnuntie, käytössä vain jos reititys ei vastannut
   */
  mode: 'walking' | 'manual' | 'straight-line';
}

/** Ravintolan perustiedot. Nämä eivät tule scrapesta vaan adapterista. */
export interface RestaurantMeta {
  /** Vakaa tunniste, käytetään avaimena JSONissa ja URL-fragmenttina. */
  id: string;
  name: string;
  /** Sivu johon käyttäjä ohjataan. */
  url: string;
  /** Kaupunginosa tai kortteli, esim. "Keskusta", "Hervanta". */
  area?: string;
  /** Lounasajat tekstinä, esim. "10:30–14:00". */
  lunchHours?: string;
  /** Lounaan hinta tekstinä, esim. "12,90 €". */
  price?: string;
  /**
   * Sijainti, josta kävelymatka toimistolle lasketaan. Hae Nominatimista:
   * https://nominatim.openstreetmap.org/search?q=<osoite>&format=jsonv2
   */
  coords?: Coords;
  /**
   * Käsin mitattu kävelymatka toimistolta. Ohittaa reitityksen kokonaan.
   *
   * Tarpeen kun karttadata ei tunne oikeaa reittiä: Finlaysonin korttelin läpi
   * pääsee kulkemaan, mutta kulkuyhteys puuttuu OpenStreetMapista, joten
   * reititin kiertää koko korttelin ympäri. Sama vika on Google Mapsissa.
   */
  walk?: { meters: number; minutes?: number };
}

export interface Adapter extends RestaurantMeta {
  /**
   * Palauttaa kaikki päivät jotka ravintola juuri nyt julkaisee.
   * Ei tarvitse suodattaa menneitä päiviä — scrape.ts hoitaa sen.
   * Heittää poikkeuksen jos haku epäonnistuu; edellinen data jää voimaan.
   *
   * Kuvia palauttavat adapterit palauttavat MenuResultin; kuvat ladataan
   * repoon scrape.ts:ssä, joten adapterin ei tarvitse huolehtia siitä.
   */
  fetch(): Promise<MenuDay[] | MenuResult>;
}

export type FeedStatus = 'ok' | 'stale' | 'error';

export interface RestaurantFeed extends RestaurantMeta {
  days: MenuDay[];
  images?: MenuImage[];
  /** Matka toimistolta. Sivusto järjestää ravintolat tämän mukaan. */
  distance?: Distance;
  /** Milloin nämä päivät haettiin onnistuneesti. */
  fetchedAt: string;
  status: FeedStatus;
  /** Virheviesti kun status !== "ok". */
  error?: string;
}

export interface Feed {
  generatedAt: string;
  /** Mistä etäisyydet on laskettu. Muuttuessaan matkat lasketaan uudelleen. */
  office?: { address: string; lat: number; lng: number };
  restaurants: RestaurantFeed[];
}
