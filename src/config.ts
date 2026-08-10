/**
 * Mistä etäisyydet lasketaan. Ravintolat järjestetään sivulla kävelymatkan
 * mukaan lähimmästä alkaen.
 *
 * Koordinaatit on haettu Nominatimista (OpenStreetMap). Jos toimisto muuttuu,
 * vaihda nämä — scrape laskee kaikki matkat uudelleen automaattisesti.
 */
export const OFFICE = {
  /**
   * Näytetään sivun otsikossa. Pidä lyhyenä — koko osoite postinumeroineen
   * venyttää rivin puhelimella kolmelle riville. Paikannus tapahtuu
   * koordinaateilla, joten tämä on pelkkä selite.
   */
  address: 'Finlaysoninkuja 21 A',
  lat: 61.5017294,
  lng: 23.7609168,
} as const;
