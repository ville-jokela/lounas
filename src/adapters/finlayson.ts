import * as cheerio from 'cheerio';
import type { Adapter, MenuResult } from '../types.ts';
import { getText } from '../util/http.ts';

/**
 * Finlayson Meetings julkaisee viikon lounaslistan pelkkänä kuvana, joten
 * ruokia ei voi jakaa päiville eikä suodattaa ruokavalion mukaan. Kuva
 * näytetään sellaisenaan; päivämäärät lukevat siinä.
 *
 * Tiedostonimeä ei voi kovakoodata (nyt NETTISIVUT_LISTA2_SYKSY2026.png,
 * vaihtuu kausittain), joten kuva etsitään sivun rakenteesta: leipätekstin
 * kuvat ovat <main id="content"> -elementin sisällä, ja ulkoasun kuvat
 * — logot, hero-kuvat, kumppanilogot — sen ulkopuolella.
 *
 * Lista vaihtuu perjantaisin seuraavaa viikkoa varten.
 */
export const finlayson: Adapter = {
  id: 'finlayson',
  name: 'Finlayson Meetings',
  url: 'https://finlaysonmeetings.fi/lounas/',
  area: 'Satakunnankatu 18 A',
  lunchHours: 'ark. 10.30–14',
  price: '14,00 € / salaatti 13,00 €',
  coords: { lat: 61.5011506, lng: 23.7612917 },
  // Sama kortteli kuin toimisto, mutta korttelin läpi kulkeva yhteys puuttuu
  // OpenStreetMapista, joten reititin kiertää koko korttelin (512 m). Todellinen
  // matka on muutama kymmenen metriä. Arvio — korvaa mitatulla, jos tarkennat.
  walk: { meters: 150, minutes: 2 },

  async fetch(): Promise<MenuResult> {
    const $ = cheerio.load(await getText(this.url));

    const images = $('main#content img')
      .toArray()
      .map((el) => pickVariant($(el).attr('srcset'), $(el).attr('src')))
      .filter((url): url is string => Boolean(url))
      .map((url) => ({ url, caption: captionFor(url) }));

    if (images.length === 0) {
      throw new Error('Lounaslistakuvaa ei löytynyt sivun sisältöalueelta');
    }
    return { days: [], images };
  },
};

/** Tätä leveämpää ei kannata ladata: teksti erottuu jo tällä. */
const MAX_WIDTH = 1024;

/**
 * WordPress tarjoaa src:ssä pikkukuvan ("...-300x300.png") ja srcset:ssä koko
 * valikoiman. Alkuperäinen on turhan raskas — salaattilista on 2,7 Mt — joten
 * otetaan suurin variantti joka mahtuu MAX_WIDTHiin.
 *
 * Jos srcsetiä ei ole, palataan src:hen ilman kokoliitettä eli alkuperäiseen:
 * pikkukuvasta ei saisi selvää.
 */
function pickVariant(srcset: string | undefined, src: string | undefined): string | undefined {
  const candidates = (srcset ?? '')
    .split(',')
    .map((entry) => entry.trim().match(/^(\S+)\s+(\d+)w$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ url: m[1]!, width: Number(m[2]) }))
    .sort((a, b) => a.width - b.width);

  const best =
    candidates.filter((c) => c.width <= MAX_WIDTH).pop() ?? candidates[0];
  if (best) return best.url;

  return src?.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
}

function captionFor(url: string): string {
  return /salaatti/i.test(url) ? 'Salaattibuffet' : 'Lämmin lounas';
}
