import type { Adapter } from '../types.ts';
import { compass } from './compass.ts';
import { finlayson } from './finlayson.ts';
import { lounastaja } from './lounastaja.ts';
import { panchoVilla } from './panchovilla.ts';
import { plevna } from './plevna.ts';
import { raflaamo } from './raflaamo.ts';
import { stahlberg } from './stahlberg.ts';
import { valssi } from './valssi.ts';
import { staticMenu } from './static.ts';

/** Etelän Kebabin vakiolounas, sama joka arkipäivä. */
const KEBAB_LOUNAS = [
  { name: 'Kebab, pizza tai 12 kpl Hot Wings', diets: [], price: '12,50 €' },
  { name: 'Grilliannokset', diets: [], price: '13,90 €' },
];

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
  // Tampereen Suomalaisen Klubin ravintola. Käyttää samaa lounastaja.app
  // -widgettiä kuin Tampella, joten parseria ei tarvita.
  lounastaja({
    id: 'suoma',
    name: 'Ravintola Suoma',
    url: 'https://ravintolasuoma.fi/',
    area: 'Puutarhakatu 13',
    lunchHours: 'ma–pe 10.30–14',
    price: '13,90 € / keitto ja salaatti 9,90 €',
    coords: { lat: 61.4990859, lng: 23.7569895 },
    apiKey: 'aa05c2cb-c72c-40a6-a617-b56eec77d4f6',
  }),
  finlayson,
  plevna,
  valssi,
  panchoVilla({
    id: 'pancho-villa-satakunnankatu',
    name: 'Pancho Villa Satakunnankatu',
    url: 'https://panchovilla.fi/ravintolat/tampere-satakunnankatu/',
    area: 'Satakunnankatu 22',
    lunchHours: 'ark. 11–14',
    price: 'alk. 13,70 €',
    coords: { lat: 61.5006663, lng: 23.7569553 },
  }),
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

  // Etelän Kebabin lounas on sama joka arkipäivä, mutta tiistaisin on lisäksi
  // tiistaipita-tarjous. Siksi lista annetaan viikonpäivittäin ja tiistaihin
  // lisätään yksi rivi.
  staticMenu({
    id: 'etelan-kebab',
    name: 'Etelän Kebab',
    url: 'https://etelankebab.com/',
    area: 'Hämeenkatu 30',
    lunchHours: 'ma–pe 11–15',
    price: '12,50 € / grilliannokset 13,90 €',
    note: 'Lounaaseen sisältyy salaatti, jälkiruoka ja kahvi/tee sekä 0,33 l juoma (grilliannoksissa vesi). Normaalikokoiset annokset — ei rullaa eikä talon erikoista. Gluteeniton pizza +3 €.',
    items: {
      1: KEBAB_LOUNAS,
      2: [
        ...KEBAB_LOUNAS,
        {
          name: 'Tiistaipita kebabilla, kanadönerillä tai falafelilla',
          diets: [],
          price: '6,90 €',
          category: 'Tiistaitarjous',
        },
      ],
      3: KEBAB_LOUNAS,
      4: KEBAB_LOUNAS,
      5: KEBAB_LOUNAS,
    },
    coords: { lat: 61.4972969, lng: 23.752937 },
    canaries: ['Ma-Pe 11.00 – 15.00', '12,50 €', 'Grilliannokset lounashintaan 13,90 €', 'TIISTAIPITA'],
  }),

  // Subham kierrättää samaa viikkolistaa: joka maanantai sama, joka tiistai
  // sama ja niin edelleen. Siksi items on annettu viikonpäivittäin.
  //
  // Sivu on Framework7-sovellus, joka hakee sisällön vasta selaimessa: palvelin
  // palauttaa tyhjän rungon, josta jää tagien poiston jälkeen 23 merkkiä.
  // Kanarialintuna voi siis tarkistaa vain että sivu on yhä olemassa — hintaa
  // tai ruokia ei voi vahtia automaattisesti, joten ne pitää käydä katsomassa
  // silloin tällöin itse.
  staticMenu({
    id: 'subham',
    name: 'Subham',
    url: 'https://foodzone.fi/tampere/subham/lunch',
    area: 'Rongankatu 6',
    lunchHours: 'ma–pe 10.45–14',
    price: '13,50 €',
    note: 'Annoksiin sisältyy basmatiriisi, naan-leipä, paistetut kasvikset, raita, papadum, salaattipöytä, mango lassi, kahvi ja nepalilainen tee.',
    items: {
      1: [
        { name: 'Butter tasty chicken — haudutettuja kanapaloja sipuli-, juusto-, voi- ja cashewkermakastikkeessa', diets: ['G'] },
        { name: 'Veg korma — kasviksia ja tuorejuustoa cashew- ja kermakastikkeessa', diets: ['G'] },
        { name: 'Tofu alu chana masala — kikherneitä, perunaa ja paistettua tofua masalakastikkeessa', diets: ['L', 'G', 'VEG'] },
        { name: 'Fish butter masala — pangasiusta cashew-, tomaatti-, voi- ja masalakermakastikkeessa', diets: ['L', 'G'] },
        { name: 'Mix vegetable', diets: ['L', 'G', 'VEG'] },
      ],
      2: [
        { name: 'Butter chicken — tandoorissa grillattua kanaa tomaatti-, voi- ja cashewkermakastikkeessa', diets: ['G'] },
        { name: 'Rara lamb — kanaa, lammasta ja paprikaa sipuli-, kerma- ja masalakastikkeessa', diets: ['L', 'G'] },
        { name: 'Veg butter masala — paistettuja kasviksia ja tuorejuustoa voi- ja masalakastikkeessa', diets: ['G'] },
        { name: 'Hariyali kofta — pinaatti-perunapyöryköitä curry- ja kookoskermakastikkeessa', diets: ['L', 'G', 'VEG'] },
        { name: 'Palak chana masala — kikherneitä ja pinaattia inkivääri- ja masalakastikkeessa', diets: ['L', 'G', 'VEG'] },
      ],
      3: [
        { name: 'Mango chicken — kanaa cashew-, juusto-, mango-, tomaatti- ja kermakastikkeessa', diets: ['G'] },
        { name: 'Veg kofta — friteerattuja kasvispyöryköitä curry-, tomaatti- ja kookoskermakastikkeessa', diets: ['L', 'G', 'VEG'] },
        { name: 'Dal palak — papuja ja pinaattia kuminalla maustettuna masalakastikkeessa', diets: ['L', 'G', 'VEG'] },
        { name: 'Shahi paneer — tuorejuustoa cashew-, hunaja-, tomaatti-, voi- ja kermakastikkeessa', diets: ['G'] },
        { name: 'Veg pakoda — friteerattuja kasviksia', diets: ['L', 'G', 'VEG'] },
      ],
      4: [
        { name: 'Garlic chicken — kanaa sipuli-, valkosipuli-, inkivääri- ja currykastikkeessa', diets: ['L', 'G'] },
        { name: 'Chicken korma — kanaa tomaatti-, cashew-, kerma- ja currykastikkeessa', diets: ['G'] },
        { name: 'Rajama masala — papuja tomaatti-, sipuli-, inkivääri- ja masalakastikkeessa', diets: ['L', 'G', 'VEG'] },
        { name: 'Tofu chili — friteerattua tofua paprika-, soija- ja chilikastikkeessa', diets: ['L', 'G', 'VEG'] },
        { name: 'Mix veg biryani — riisiä ja kauden kasviksia masalakastikkeessa', diets: ['L', 'G', 'VEG'] },
      ],
      5: [
        { name: 'Butter chicken — tandoorissa grillattua kanaa tomaatti-, voi- ja cashewkermakastikkeessa', diets: ['G'] },
        { name: 'Lamb rogan — lammasta maustetussa sipuli-, valkosipuli-, korianteri- ja jogurttikastikkeessa', diets: ['L', 'G'] },
        { name: 'Tofu coconut — tofua kookos- ja currykastikkeessa', diets: ['L', 'G', 'VEG'] },
        { name: 'Dal makhani — papuja korianterilla ja kuminalla maustettuna voi- ja kermakastikkeessa', diets: ['L', 'G'] },
        { name: 'Jeera alu — paistettua perunaa ja kuminaa', diets: ['L', 'G', 'VEG'] },
      ],
    },
    coords: { lat: 61.5000821, lng: 23.768614 },
    canaries: ['Subham | BUFFET'],
  }),

  // Green Hippon lounaslista on kiinteä à la carte -lista, sama kaikissa
  // ketjun ravintoloissa (Punavuori, Kallio, Töölö, Tampere) — ei vaihdu
  // päivittäin, joten se kirjoitetaan tähän.
  //
  // Sivusto on Webflow-toteutus, jossa jokaiselle annokselle renderöidään
  // kaikki ruokavaliokuvakkeet ja väärät piilotetaan CSS-luokalla
  // w-condition-invisible. Tagien poisto sellaisenaan väittäisi esimerkiksi
  // kinkkua sisältävää eggs benedictiä vegaaniseksi. Merkinnät alla on luettu
  // sivulta piilotetut elementit poistettuina.
  staticMenu({
    id: 'green-hippo',
    name: 'Green Hippo Tampere',
    url: 'https://www.greenhippocafe.rocks/menu',
    area: 'Jugendtori 7',
    lunchHours: 'ma–pe 11–14',
    price: '14,00 €',
    note: 'Sama lounaslista kaikissa Green Hippon ravintoloissa.',
    items: [
      { name: 'Tofu bowl — musta riisi, punakaali, marinoitu tofu, parsakaali, maapähkinävoikastike', diets: ['VEG', 'G'] },
      { name: 'Halloumisalaatti — halloumi, mansikka, meloni, pikkelöity punasipuli, mustaherukkavinaigrette', diets: ['G'] },
      { name: 'Buddha bowl — kvinoa, bataatti, kukkakaalipyree, punajuurihummus, avokado, Nirvana-kastike', diets: ['VEG', 'G'] },
      { name: 'Lehtikaali-tofusalaatti — lehtikaali-pinaatti, limemajoneesi, Jalotofu, avokado, manteli', diets: ['VEG', 'G'] },
      { name: 'Avokadopasta — avokado, chili, valkosipuli, basilikaöljy, parmesaani', diets: ['VEG', 'G'] },
      { name: 'Chicken bowl — musta riisi, punakaali, marinoitu kana, parsakaali, maapähkinävoikastike', diets: ['G'] },
      // Annoksen saa kanalla tai tofulla, joten vegaanisuus on valinnainen.
      { name: 'Wasabi-lehtikaalibowl — musta riisi, marinoitu kana tai tofu, wasabimajoneesi, ponzu', diets: ['VEG*', 'G'] },
      { name: 'Lehtikaalibowl — lehtikaali, kvinoa, tomaatti, halloumi, uppomuna, manteli, jogurttikastike', diets: ['G'] },
      { name: 'Nuudelisalaatti — lasinuudeli, porkkana, avokado, punakaali, parsakaali, maapähkinävoikastike', diets: ['VEG', 'G'] },
    ],
    coords: { lat: 61.4971293, lng: 23.7606973 },
    canaries: ['MA-PE 11-14', 'BUDDHA BOWL', '14 €'],
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
