import type { Coords, Distance } from '../types.ts';
import { getJson } from './http.ts';

/**
 * FOSSGISin julkinen OSRM-instanssi, jalankulkuprofiili. Polussa lukee
 * "driving", mutta routed-foot-palvelin reitittää jalan — OSRM:n polku on aina
 * sama riippumatta profiilista.
 */
const OSRM = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';

/**
 * Kävelymatka kahden pisteen välillä. Tampereella tällä on väliä: Tammerkosken
 * yli ei kävellä, joten linnuntie-etäisyys antaa väärän järjestyksen.
 * Kelloportinkatu on 156 m linnuntietä toimistolta mutta 740 m kävellen.
 */
export async function walkingDistance(from: Coords, to: Coords): Promise<Distance> {
  const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const res = await getJson<OsrmResponse>(url, { timeoutMs: 20_000 });
  const route = res.routes?.[0];
  if (res.code !== 'Ok' || !route) {
    throw new Error(`Reititys epäonnistui: ${res.code ?? 'tuntematon virhe'}`);
  }
  return {
    meters: Math.round(route.distance),
    minutes: Math.round(route.duration / 60),
    mode: 'walking',
  };
}

/** Linnuntie-etäisyys metreinä. Varalla jos reititys ei vastaa. */
export function straightLineDistance(from: Coords, to: Coords): Distance {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return {
    meters: Math.round(2 * R * Math.asin(Math.sqrt(h))),
    mode: 'straight-line',
  };
}

interface OsrmResponse {
  code?: string;
  routes?: { distance: number; duration: number }[];
}
