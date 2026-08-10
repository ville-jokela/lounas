const USER_AGENT =
  'lounas-bot/1.0 (henkilökohtainen lounaslistakokoaja; +https://github.com/)';

interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * fetch, jossa on aikakatkaisu, uudelleenyritys ja tunnistautuva User-Agent.
 * Ravintoloiden sivut ovat pieniä ja usein hitaita — 15 s riittää.
 */
export async function get(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, retries = 2, headers = {} } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          // Selaimet lähettävät aina kielitoiveen, node:n fetch ei. Osa
          // monikielisistä sivustoista kaatuu 500-virheeseen ilman sitä
          // (esim. vapriikki.fi), joten se lähetetään aina.
          'accept-language': 'fi-FI,fi;q=0.9,en;q=0.8',
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      // 4xx ei parane uusimalla, joten keskeytetään heti.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
      }
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
        continue;
      }
      return res;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('HTTP 4')) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function getText(url: string, opts?: FetchOptions): Promise<string> {
  return (await get(url, opts)).text();
}

export async function getJson<T = unknown>(url: string, opts?: FetchOptions): Promise<T> {
  const res = await get(url, {
    ...opts,
    headers: { accept: 'application/json', ...opts?.headers },
  });
  return (await res.json()) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
