/** Helpers HTTP sobre o fetch nativo do Node, com timeout. */

const UA = 'RedNest/0.2';

export interface FetchOpts {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export async function fetchJson<T = any>(
  url: string,
  opts: FetchOpts = {},
): Promise<{ status: number; ok: boolean; json: T | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 18000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { 'User-Agent': UA, Accept: 'application/json', ...opts.headers },
      body: opts.body,
      signal: controller.signal,
    });
    let json: T | null = null;
    try {
      json = (await res.json()) as T;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, json };
  } finally {
    clearTimeout(timer);
  }
}
