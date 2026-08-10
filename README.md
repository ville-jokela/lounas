# Lounas Tampere

Tampereen lounaslistat yhdellä sivulla. Ei palvelinta, ei tietokantaa, ei kustannuksia.

## Miten se toimii

1. GitHub Actions ajaa `npm run scrape` arkiaamuisin.
2. Skripti hakee jokaisen ravintolan listan sen omalta sivulta ja kirjoittaa
   `site/data/menus.json`.
3. Tiedosto committoidaan repoon ja `site/` julkaistaan GitHub Pagesiin.
4. Selain lataa vain staattisen sivun ja yhden JSON-tiedoston.

Koska data on gitissä, listojen historia säilyy ja rikkoutuneen parserin voi
korjata jälkikäteen vanhaa dataa vasten.

## Kehitys

```bash
npm install
npm run scrape                          # hakee kaikki ja kirjoittaa site/data/menus.json
node src/scrape.ts --only tampella --dry   # yksi ravintola, ei kirjoiteta
npx serve site                          # sivu osoitteessa http://localhost:3000
```

Vaatii Node 22.18+ (TypeScript ajetaan suoraan ilman käännöstä; tyyppien purku
toimii ilman lippua vasta 22.18 / 23.6 alkaen).

### Päivän pakottaminen

Rajapinnat tarjoavat yleensä vain kuluvan viikon, joten viikonloppuna ei ole
mitään dataa jota vasten parseria voisi kokeilla. Molemmat päät osaavat teeskennellä:

```bash
LOUNAS_TODAY=2026-08-07 npm run scrape
```

```
http://localhost:3000/?date=2026-08-07
```

`?date` siirtää näkyvän viikon ja aluksi valitun päivän, mutta **ei** tee
kyseisestä päivästä tätä päivää: "Tänään"-leiman saa vain oikea tämä päivä.
Muuten sivu väittäisi maanantain olevan tänään samalla kun otsikossa lukee
"Päivitetty 9.8.".

## Käyttäjän asetukset

Ruokavaliomerkinnät kiinnostavat vain osaa käyttäjistä, joten ne voi kytkeä pois
kokonaan — silloin piiloutuvat sekä ruokien merkinnät että suodatinnapit.
Vegaaniruokaa etsivä puolestaan valitsee suodattimensa kerran.

Molemmat säilyvät `localStorage`ssa (`lounas.prefs`), koska sivulla käydään joka
päivä samoilla tarpeilla. Tallennus on selainkohtainen eikä sitä varten tarvita
tiliä eikä palvelinta.

Jos suodattimet kytketään pois päältä, aktiiviset valinnat myös tyhjennetään —
muuten sivu suodattaisi näkymättömillä ehdoilla.

## Uuden ravintolan lisääminen

Luo `src/adapters/<id>.ts`:

```ts
import type { Adapter } from '../types.ts';
import { getText } from '../util/http.ts';
import { toItem, isMeaningful } from '../util/text.ts';

export const myRestaurant: Adapter = {
  id: 'ravintolan-id',
  name: 'Ravintolan nimi',
  url: 'https://example.fi/lounas',
  area: 'Keskusta',
  lunchHours: '10:30–14:00',
  price: '12,90 €',

  async fetch() {
    const html = await getText(this.url);
    // ...parsi html:stä MenuDay[]
    return [{ date: '2026-08-10', items: [toItem('Lohikeitto (G, L)')] }];
  },
};
```

Lisää se sitten `src/adapters/index.ts`-listaan. Siinä kaikki.

Jos ravintola ei julkaise listaa koneluettavasti, käytä `manual()`-adapteria ja
kirjoita lista käsin tiedostoon `data/manual/<id>.json`.

### lounastaja.app -ravintolat

Moni suomalainen ravintola ostaa lounaslistansa palvelulta **lounastaja.app**.
Näille ei tarvitse kirjoittaa parseria lainkaan — riittää yksi rivi
`src/adapters/index.ts`:ään, koska `lounastaja()`-tehdas hoitaa loput.

Tunnistat sen ravintolan sivun lähdekoodista:

```html
<div data-lounastaja-widget-id="..." data-api-key="5612c69a-...">
<script defer src="https://lounastaja.app/widget/base.min.js">
```

`data-api-key` on se mitä adapteri tarvitsee. Se on julkinen widget-avain, ei
salaisuus — se näkyy jokaiselle sivun kävijälle. Widget tarjoaa itse
`jsonWeekFeedUrl`-osoitteen, eli syöte on tarkoitettu ulkopuoliseen käyttöön:

```
https://lounastaja.app/api/v1/week/<api-key>/active?language=fi
```

Rajapinta antaa vain kuluvan viikon (`active`); muita viikkoja ei voi pyytää.
Viikko vaihtuu maanantaina, joten viikonloppuna seuraavan viikon lista ei ole
vielä saatavilla.

### Etäisyydet ja järjestys

Ravintolat järjestetään sivulla **kävelymatkan** mukaan lähimmästä alkaen.
Toimiston sijainti on `src/config.ts`:ssä, ravintoloiden `coords`-kentässä.

Kävelymatka, ei linnuntie — Tampereella ero on ratkaiseva. Toimistolta
Kelloportinkadulle on 156 m linnuntietä mutta 740 m kävellen, koska Tammerkosken
yli ei kävellä. Linnuntie antaisi Tampellalle toisen sijan, vaikka se on
todellisuudessa kolmen joukosta kaukaisin.

Matkat lasketaan FOSSGISin julkisella OSRM-palvelimella (jalankulkuprofiili) ja
tallennetaan syötteeseen. Koska koordinaatit eivät muutu, matka lasketaan vain
kerran: seuraavat ajot lukevat sen edellisestä syötteestä. Uudelleen lasketaan
vain jos ravintolan `coords` tai `src/config.ts`:n toimisto muuttuu.

Jos reitityspalvelu ei vastaa, käytetään linnuntietä ja se myös näytetään
sellaisena — järjestys ei ole silloin luotettava, mutta ajo ei kaadu.

#### Kun reititin on väärässä

Reititin tuntee vain ne kulkuyhteydet jotka on merkitty karttaan. Finlaysonin
korttelin läpi pääsee kävelemään, mutta yhteys puuttuu OpenStreetMapista, joten
reititin kiertää koko korttelin — sama vika on Google Mapsissa.

Tällöin matka mitataan käsin ja kirjoitetaan adapteriin. `walk` ohittaa
reitityksen kokonaan:

```ts
walk: { meters: 120, minutes: 2 },
```

Arvo luetaan aina adapterista, joten korjaus näkyy heti seuraavassa ajossa.
Poista `walk`, niin reititys palaa käyttöön.

Kestävämpi korjaus on lisätä puuttuva kulkuyhteys OpenStreetMapiin. Silloin
reititys menee oikein täällä ja kaikkialla muualla, eikä `walk`-riviä tarvita.

Uuden ravintolan koordinaatit saat Nominatimista:

```
https://nominatim.openstreetmap.org/search?q=Kelloportinkatu+1,+Tampere&format=jsonv2&limit=1
```

`coords` on vapaaehtoinen. Ilman sitä ravintola listataan viimeisenä.

### Muuttumattomat listat

Osa ravintoloista tarjoaa saman lounaan joka arkipäivä — tyypillisesti buffet.
Listaa ei kannata hakea joka aamu, koska haettavaa ei ole; se kirjoitetaan
suoraan `src/adapters/index.ts`:ään `staticMenu()`-tehtaalla.

Staattisen listan vaara on että se valehtelee huomaamatta: hinta nousee eikä
mikään kerro siitä. Siksi `canaries` — merkkijonot joiden pitää yhä löytyä
ravintolan sivulta:

```ts
staticMenu({
  id: 'nanda-devi',
  name: 'Nanda Devi',
  url: 'https://nandadevi.fi/lounas/',
  price: '14,00 €',
  items: [{ name: 'Intialainen buffetlounas', diets: [], price: '14,00 €' }],
  canaries: ['buffetlounasta', '10.30-15', '14€'],
})
```

Kun jokin niistä katoaa, haku epäonnistuu, ravintola saa "vanha tieto"
-merkinnän ja ajon loki kertoo mikä merkkijono puuttuu. Vanha lista jää
näkyviin siihen asti kunnes tiedot päivittää.

Valitse kanarialinnuiksi juuri ne tiedot jotka olet kovakoodannut — hinta ja
lounasaika — älä ravintolan nimeä tai muuta joka ei koskaan muutu. Välilyönnit
normalisoidaan ja HTML-entiteetit puretaan, joten `PÄIVÄN LOUNASANNOS` löytyy
vaikka sivulla lukisi `P&Auml;IV&Auml;N`.

Jos ravintola ei tarjoile lounasta joka arkipäivä, kerro se `weekdays`- ja
`closedNote`-kentillä. Ilman `closedNote`a sivu sanoo "ei listaa tälle päivälle",
mikä antaa ymmärtää että tieto puuttuu — vaikka lounasta ei vain ole:

```ts
weekdays: [1, 3, 4, 5],
closedNote: 'Ei lounasta tiistaisin — tiistaisin on burgertiistai.',
```

### Kun sivu renderöidään selaimessa

Raflaamo.fi on Next.js-sovellus: ruokalistaa ei ole HTML:ssä, vaan React
rakentaa sen vasta selaimessa. `getText` + cheerio ei siis riitä.

Headless-selainta ei kuitenkaan tarvittu. Apollo upottaa GraphQL-välimuistinsa
sivulle `ApolloSSRDataTransport`-skriptiin, eli data tulee samassa vastauksessa —
se on vain eri paikassa kuin näkyvä sisältö. Adapteri lukee sieltä
`weeklyLunchMenu`-taulukon sulkeita laskemalla, koska ympäröivä objekti on
satojen kilotavujen kokoinen eikä sitä kannata jäsentää kokonaan.

Kun sivu näyttää tyhjältä curlilla mutta täydeltä selaimessa, kannattaa siis
ensin etsiä data sivun lähdekoodista: `__NEXT_DATA__`, `self.__next_f`,
`ApolloSSRDataTransport`, `application/ld+json`. Vasta jos sitä ei ole, data
haetaan erillisestä rajapinnasta — sen näkee selaimen verkkovälilehdeltä.

Sivun viikkovalitsinta ei tarvitse käyttää: kaikkien kolmen viikon listat ovat
samassa vastauksessa, ja `scrape.ts` karsii ylimääräiset päivät.

Yksi ansa: Apollo tallentaa saman kyselyn välimuistiin moneen kertaan, joten
sivulla on toistakymmentä `weeklyLunchMenu`-kopiota. Vain yhdessä on päivien
listat, ja **kopioiden järjestys vaihtelee pyyntöjen välillä** — ensimmäinen
osuma toimii silloin tällöin ja hajoaa muulloin. Adapteri käy siksi kaikki
kopiot läpi ja valitsee sisällökkäimmän. Sama varovaisuus kannattaa muissakin
upotetuissa välimuisteissa: älä oleta että ensimmäinen osuma on se oikea.

### Compass Group / Food & Co

Ravintolan sivulla lista on upotettuna `window.__INITIAL_MENU__`-muuttujaan,
mutta samat tiedot saa siistimmin rajapinnasta jota sivu itse käyttää:

```
/menuapi/week-menus?costCenter=<numero>&language=fi&date=<viikon maanantai>
```

`costCenter` löytyy ravintolan sivun lähdekoodista (`"costCenter":"3231"`).
Rajapinta antaa yhden viikon kerrallaan, joten adapteri hakee kuluvan ja
seuraavan — seuraava on usein vielä tyhjä, mikä ei ole virhe.

Varo vanhempaa `/menuapi/feed/json`-osoitetta: se käyttää nimeä `costNumber`
(ei `costCenter`) ja palauttaa vain yhden päivän.

Compassin ruokavaliomerkinnöistä otetaan mukaan vain yleisesti tunnetut
(G, L, VL, M, Veg). Sivulla ei ole selitettä koodeille `*`, `A`, `ILM` ja `VS`,
joten niitä ei arvata — suodatinriville ei haluta merkintöjä joiden merkitystä
ei voi tarkistaa.

### Ketjut

Kun samalla ketjulla on useita toimipisteitä, adapteri kirjoitetaan tehtaaksi ja
uusi paikka on yksi rivi `src/adapters/index.ts`:ssä. Näin on tehty:

- `lounastaja(...)` — kaikki lounastaja.app-widgetiä käyttävät ravintolat
- `stahlberg(...)` — Ståhlbergin lounaskahvilat
- `staticMenu(...)` — muuttumaton lista
- `manual(...)` — käsin syötetty lista

Ketjun sivut eivät ole aivan identtisiä: esimerkiksi Ståhlberg Tampella
ilmoittaa jälkiruoan ("Jälkiruoka: Mangorahka") mutta Keskustori ei. Tehtaan
pitää kestää molemmat ilman toimipistekohtaisia poikkeuksia.

### Kuvana julkaistut listat

Osa ravintoloista julkaisee viikkolistan pelkkänä kuvana (esim. Finlayson
Meetings). Näitä ei voi jakaa päiville eikä suodattaa ruokavalion mukaan ilman
tekstintunnistusta, joten kuva näytetään sellaisenaan — päivämäärät lukevat siinä.

Adapteri palauttaa tällöin `MenuResult`in `days: []` ja `images`. `scrape.ts`
lataa kuvat repoon (`site/data/images/`) ja korvaa osoitteet paikallisilla:

- ravintolan palvelinta ei kuormiteta jokaisella sivulatauksella,
- sivu ei hajoa kun ravintola vaihtaa tiedoston nimeä,
- tiedostonimi on sisällön tiiviste, joten muuttumaton lista ei tuota committia,
- syötteestä pudonneet kuvat siivotaan, joten repo ei kasva rajatta.

Älä kovakoodaa kuvan osoitetta — se vaihtuu. Etsi kuva sivun rakenteesta, ja
lataa `srcset`-vaihtoehdoista kohtuullisen kokoinen: alkuperäiset ovat usein
megatavuja.

### Kun palvelin vastaa 500

Kaikki pyynnöt lähtevät `accept-language`-otsakkeella. Selaimet lähettävät sen
aina, node:n `fetch` ei — ja osa monikielisistä sivustoista kaatuu ilman sitä
500-virheeseen. vapriikki.fi tekee juuri niin: ilman otsaketta koko sivusto
palauttaa 500, sen kanssa 200.

Jos siis sivu toimii selaimessa mutta ei skriptissä, vika on todennäköisemmin
puuttuvassa otsakkeessa kuin estossa. Vertaa pyyntöjä ennen kuin oletat että
palvelin torjuu botteja.

## Parsimisen periaatteet

- **Adapteri saa hajota.** Jos haku epäonnistuu, edellinen onnistunut lista jää
  näkyviin merkinnällä "vanha tieto". Sivu ei mene rikki yhden ravintolan takia.
- **Suosi JSONia HTML:n yli.** Monet ketjut (Juvenes, Sodexo, Food & Co, Compass)
  tarjoavat listan JSONina samalta sivulta jonka HTML:n selain näyttää — katso
  verkkoliikenne selaimen devtoolsista ennen kuin kirjoitat HTML-parseria.
- **Älä rakenna päivämääriä arvaamalla.** Käytä `util/dates.ts`:n apureita;
  vuodenvaihde ja viikonpäivälyhenteet ovat yleisimmät bugilähteet.
- **Ole kohtelias.** Haku kaksi kertaa päivässä riittää.

## Käyttöönotto

Sivusto on suunniteltu GitHub Pagesille: staattinen hosting ja ajastettu
suoritus samasta paikasta, ilman palvelinta ja ilman kustannuksia.

1. Luo **julkinen** repo GitHubiin. Pages on ilmainen julkisille repoille;
   yksityisellä repolla se vaatii maksullisen tilauksen.
2. `git remote add origin …` ja `git push -u origin main`.
3. Settings → Pages → Source: **GitHub Actions**.
4. Actions → *Päivitä lounaslistat* → **Run workflow** kerran käsin.

Sivu on tämän jälkeen osoitteessa `https://<käyttäjä>.github.io/<repo>/`.
Kaikki polut sivulla ovat suhteellisia, joten alihakemisto ei haittaa.

Huomioitavaa:

- **Ajastus on UTC:ssä.** `15 4 * * 1-5` on Suomen aikaa 7.15 kesällä ja 6.15
  talvella. GitHubin ajastus on myös likimääräinen: ajo voi myöhästyä
  ruuhka-aikaan kymmeniä minuutteja.
- **Ajastetut workflow't kytkeytyvät pois** julkisessa repossa, jos repo on
  ollut 60 päivää käyttämättä. Tämä workflow committaa listat useimpina
  arkipäivinä, mikä pitää repon aktiivisena.
- **Julkinen repo on julkinen.** `src/config.ts` sisältää toimiston osoitteen ja
  koordinaatit, ja `site/data/images/` ravintoloiden omia listakuvia. Kumpikaan
  ei ole salaisuus, mutta ne kannattaa tiedostaa ennen julkaisua.
