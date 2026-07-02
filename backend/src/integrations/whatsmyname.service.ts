import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Enumeração de username em ~700 sites usando o dataset WhatsMyName
 * (WebBreacher/WhatsMyName, CC BY-SA 4.0 — ver data/wmn-data.json).
 * É só HTTP + comparação de status/string: implementado nativo, sem CLI.
 */

interface WmnSite {
  name: string;
  uri_check: string;
  uri_pretty?: string;
  e_code: number;
  e_string: string;
  m_code: number;
  m_string: string;
  cat: string;
  post_body?: string;
  headers?: Record<string, string>;
  strip_bad_char?: string[];
}

export interface WmnHit {
  name: string;
  cat: string;
  url: string;
  status?: number;
}

export interface WmnProgress {
  checked: number;
  total: number;
  found: number;
}

export interface WmnResult {
  username: string;
  total: number;
  checked: number;
  errors: number;
  found: WmnHit[];
  categories: string[];
}

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

@Injectable()
export class WhatsMyNameService {
  private readonly logger = new Logger(WhatsMyNameService.name);
  private sites: WmnSite[] = [];
  private categories: string[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = readFileSync(join(__dirname, 'data', 'wmn-data.json'), 'utf8');
      const data = JSON.parse(raw) as { sites: WmnSite[] };
      this.sites = data.sites ?? [];
      this.categories = [...new Set(this.sites.map((s) => s.cat))].sort();
      this.logger.log(`WhatsMyName: ${this.sites.length} sites carregados`);
    } catch (e) {
      this.logger.error(`Falha ao carregar wmn-data.json: ${String(e)}`);
    }
  }

  get size(): number {
    return this.sites.length;
  }

  listCategories(): string[] {
    return this.categories;
  }

  private prettyUrl(site: WmnSite, account: string): string {
    return (site.uri_pretty ?? site.uri_check).replace(/{account}/g, account);
  }

  private async checkSite(
    site: WmnSite,
    account: string,
    timeoutMs: number,
  ): Promise<{ found: boolean; status?: number; error?: boolean }> {
    let acc = account;
    for (const ch of site.strip_bad_char ?? []) acc = acc.split(ch).join('');

    const url = site.uri_check.replace(/{account}/g, acc);
    const method = site.post_body ? 'POST' : 'GET';
    const headers: Record<string, string> = { 'User-Agent': UA, ...(site.headers ?? {}) };
    const body = site.post_body ? site.post_body.replace(/{account}/g, acc) : undefined;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'manual', // e_code/m_code distinguem 200 vs 30x — não seguir
        signal: ctrl.signal,
      });
      let text = '';
      try {
        text = await res.text();
      } catch {
        /* corpo ilegível — segue só com o status */
      }
      const found = res.status === site.e_code && (!site.e_string || text.includes(site.e_string));
      return { found, status: res.status };
    } catch {
      return { found: false, error: true };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Checa `username` nos sites (opcionalmente filtrando categorias), com pool de
   * concorrência limitada. `onProgress` recebe o andamento agregado.
   */
  async check(
    username: string,
    opts: {
      categories?: string[];
      concurrency?: number;
      timeoutMs?: number;
      onProgress?: (p: WmnProgress) => void;
    } = {},
  ): Promise<WmnResult> {
    const handle = username.replace(/^@/, '').trim();
    const cats = opts.categories?.length ? opts.categories : undefined;
    const sites = cats ? this.sites.filter((s) => cats.includes(s.cat)) : this.sites;
    const total = sites.length;
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 25, 50));
    const timeoutMs = opts.timeoutMs ?? 5000;

    const found: WmnHit[] = [];
    let checked = 0;
    let errors = 0;
    let idx = 0;

    const emit = () => opts.onProgress?.({ checked, total, found: found.length });

    const worker = async () => {
      for (;;) {
        const i = idx++;
        if (i >= total) return;
        const site = sites[i];
        const r = await this.checkSite(site, handle, timeoutMs);
        checked++;
        if (r.error) errors++;
        else if (r.found)
          found.push({ name: site.name, cat: site.cat, url: this.prettyUrl(site, handle), status: r.status });
        if (checked % 20 === 0 || checked === total) emit();
      }
    };

    emit();
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
    found.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));

    return { username: handle, total, checked, errors, found, categories: cats ?? [] };
  }
}
