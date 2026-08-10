import type { Adapter } from '../types.ts';
import { compass } from './compass.ts';
import { finlayson } from './finlayson.ts';
import { lounastaja } from './lounastaja.ts';
import { plevna } from './plevna.ts';
import { raflaamo } from './raflaamo.ts';
import { stahlberg } from './stahlberg.ts';
import { valssi } from './valssi.ts';
import { staticMenu } from './static.ts';

/**
 * Ravintolat jotka sivusto näyttää. Uuden paikan lisääminen = uusi tiedosto
 * tähän hakemistoon + yksi rivi tähän listaan.
 *
 * Tämän listan järjestyksellä ei ole väliä: sivu järjestää ravintolat
 * kävelymatkan mukaan toimistolta (src/config.ts).
 */
export const adapters: Adapter[] = [
  lounastaja({
    id: 'tampella',
    name: 'Ravintola Tampella',
    url: 'https://www.ravintolatampella.fi/lounas/',
    area: 'Kelloportinkatu 1',
    lunchHours: 'ark. 11–14',
    price: '14,00 €',
    coords: { lat: 61.5024749, lng: 23.7634144 },
    apiKey: '5612c69a-7702-4ac0-b1b7-c63de8a77603',
  }),
  finlayson,
  plevna,
  valssi,
  compass({
    id: 'viistokatu',
    name: 'Kahvila-ravintola Viistokatu',
    url: 'https://www.compass-group.fi/ravintolat-ja-ruokalistat/foodco/kaupungit/tampere/kahvila-ravintola-viistokatu/',
    area: 'Aleksis Kiven katu 14–16 (kaupungintalo)',
    lunchHours: 'ark. lounasaikaan',
    price: '14,00 €',
    coords: { lat: 61.4999641, lng: 23.7588359 },
    costCenter: '3231',
  }),
  raflaamo({
    id: 'puisto',
    name: 'Ravintola Puisto',
    url: 'https://www.raflaamo.fi/fi/ravintola/tampere/puisto/menu/lounas',
    area: 'Hämeenkatu 14',
    lunchHours: 'ark. 11–14.30',
    price: 'alk. 13,50 €',
    coords: { lat: 61.4983178, lng: 23.7645474 },
  }),
  raflaamo({
    id: 'tammerin-kellari',
    name: 'Tammerin Kellari',
    url: 'https://www.raflaamo.fi/fi/ravintola/tampere/tammerin-kellari/menu/lounas',
    area: 'Satakunnankatu 13',
    lunchHours: 'ma–pe 11–14',
    price: '14,00 € / noutopöytä 15,50 €',
    coords: { lat: 61.5009925, lng: 23.7647589 },
  }),
  stahlberg({
    id: 'stahlberg-keskustori',
    name: 'Ståhlberg Keskustori',
    url: 'https://stahlbergkahvilat.fi/lounasravintolat/keskustori/',
    // Sivu ilmoittaa osoitteeksi Keskustori 7, kartoilla Jugendtori 7. Sama paikka.
    area: 'Jugendtori 7',
    lunchHours: 'ma–pe 10.30–15',
    price: '13,90 €',
    coords: { lat: 61.497078, lng: 23.7606478 },
  }),
  stahlberg({
    id: 'stahlberg-tampella',
    name: 'Ståhlberg Tampella',
    url: 'https://stahlbergkahvilat.fi/lounasravintolat/tampella/',
    area: 'Tampellan esplanadi 4',
    lunchHours: 'ma–pe 10.30–15',
    price: '13,90 €',
    coords: { lat: 61.5039028, lng: 23.7634417 },
  }),

  // Faasain lounas on sama joka arkipäivä: thaimaalainen buffet yhteen hintaan.
  // Ketjulla on Tampereella myös Hatanpään valtatie 26 ja Ilmarinkatu 49 sekä
  // Pirkkalassa Koulutie 6 — samalla lounaskonseptilla.
  staticMenu({
    id: 'faasai-koskikatu',
    name: 'Faasai Koskikatu',
    url: 'https://www.faasairavintola.fi/koskikatu.html',
    area: 'Koskikatu 7',
    lunchHours: 'ark. 11–15',
    price: '13,70 €',
    note: 'Sisältää salaattipöydän ja keiton. Jälkiruoaksi leivonnaisia, lettuja ja jäätelöä kahvin tai teen kera. Lapset 1 € / ikävuosi (1–13 v.).',
    items: [
      {
        name: 'Thaimaalainen buffet: liha- ja kasvisruokia',
        diets: [],
        price: '13,70 €',
      },
    ],
    coords: { lat: 61.4984708, lng: 23.7658831 },
    canaries: ['Arkisin klo 11.00-15.00', '13,70', 'Koskikatu 7'],
  }),

  // Zarillon lounaslista on kiinteä: samat burgerit, pihvit ja salaatit joka
  // päivä. Tiistaisin ei ole lounasta lainkaan (burgertiistai), mistä
  // weekdays-listasta puuttuu 2.
  //
  // Päivittäin vaihtuva annos on olemassa, mutta ravintola ei julkaise sitä
  // omilla sivuillaan vaan ohjaa Lounaat.info-palveluun, joten sitä ei voi
  // hakea täältä.
  staticMenu({
    id: 'zarillo-puutarhakatu',
    name: 'Zarillo Puutarhakatu',
    url: 'https://www.zarillo.fi/lounas',
    area: 'Puutarhakatu 8',
    lunchHours: 'ma, ke–pe klo 14 asti',
    price: 'alk. 12,80 €',
    note: 'Kaikkiin annoksiin sisältyy salaattipöytä. Päivän vaihtuvaa annosta ei julkaista ravintolan sivuilla.',
    weekdays: [1, 3, 4, 5],
    closedNote: 'Ei lounasta tiistaisin — tiistaisin on burgertiistai.',
    items: [
      { name: 'Lounasburgerit, 10 vaihtoehtoa, sis. talon ranskalaiset', diets: [], price: '12,80 €', category: 'Burgerit' },
      { name: 'Burgerit XXL-koossa: 200 g pihvi ja isommat ranskalaiset', diets: [], price: '14,80 €', category: 'Burgerit' },
      { name: 'Porsaan ulkofilee', diets: [], price: '12,80 €', category: 'Lounaspihvit' },
      { name: 'Broilerin rintafilee', diets: [], price: '12,80 €', category: 'Lounaspihvit' },
      { name: 'Lohi', diets: [], price: '15,70 €', category: 'Lounaspihvit' },
      { name: 'Naudan ulkofilee', diets: [], price: '16,70 €', category: 'Lounaspihvit' },
      { name: 'Halloumisalaatti', diets: ['G*'], price: '12,80 €', category: 'Lounassalaatit' },
      { name: 'Kanasalaatti', diets: ['L', 'G*'], price: '12,80 €', category: 'Lounassalaatit' },
      { name: 'Kana-Caesar', diets: ['L'], price: '13,70 €', category: 'Lounassalaatit' },
      { name: 'Lohi-Caesar', diets: ['L'], price: '13,70 €', category: 'Lounassalaatit' },
      { name: 'Päivän vaihtuva lounasannos', diets: [], price: '12,80 €', category: 'Päivän lounas' },
    ],
    coords: { lat: 61.4993237, lng: 23.757195 },
    canaries: ['Lounasta arkisin (ei tiistaisin)', 'LOUNASBURGERIT', 'PÄIVÄN LOUNASANNOS', '12,80'],
  }),

  // Purebite ei julkaise päivittäin vaihtuvaa listaa: lounasaikaan kaikki wokit
  // ja salaatit ovat lounashintaan. Ravintolalla on myös Tammelan toimipiste
  // (Kullervonkatu 12) samalla lounastarjonnalla.
  staticMenu({
    id: 'purebite-keskusta',
    name: 'Purebite Keskusta',
    url: 'https://purebite.fi/lounas-purebite/',
    area: 'Hatanpään valtatie 4',
    lunchHours: 'ma–pe 10.30–15',
    price: '14,00 € / salaatit 14,90 €',
    note: 'Wokit ja salaatit tarjoillaan pöytiin lounashintaan. Tuplaliha +4,50 €.',
    items: [
      { name: 'Thai-wokit', diets: [], price: '14,00 €', category: 'Lounasannokset' },
      { name: 'Salaatit', diets: [], price: '14,90 €', category: 'Lounasannokset' },
    ],
    coords: { lat: 61.4967108, lng: 23.7676208 },
    canaries: ['Kaikki Thai-wokit', 'Kaikki salaatit', 'ma-pe 10.30-15', '14,90'],
  }),

  // Sama intialainen buffet joka arkipäivä, joten lista on tässä eikä haussa.
  // canaries varmistaa ettei hinta tai lounasaika ole muuttunut huomaamatta.
  staticMenu({
    id: 'nanda-devi',
    name: 'Nanda Devi',
    url: 'https://nandadevi.fi/lounas/',
    area: 'Näsilinnankatu 17',
    lunchHours: 'ma–pe 10.30–15',
    price: '14,00 €',
    note: 'Sisältää naan-leivän, riisin ja raita-kastikkeen. Lapset alle 10 v 9,00 €.',
    items: [
      {
        name: 'Intialainen buffetlounas: runsaasti kana-, liha- ja kasvisruokia',
        diets: [],
        price: '14,00 €',
        category: 'Buffet',
      },
    ],
    coords: { lat: 61.4995116, lng: 23.7543689 },
    canaries: ['buffetlounasta', '10.30-15', '14€'],
  }),
];
