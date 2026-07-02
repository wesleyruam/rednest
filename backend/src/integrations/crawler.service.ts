import { Injectable } from '@nestjs/common';
import * as http from 'node:http';
import * as https from 'node:https';

/**
 * Crawler v1 (motor estilo Katana, nativo, sem headless). BFS in-scope com limite
 * de profundidade/páginas; extrai links (internos/externos), endpoints (api/js),
 * forms e e-mails. Saída estruturada. (Renderização JS/headless fica para a v2.)
 */

const UA = 'RedNest/0.2';
const ASSET_RE = /\.(png|jpe?g|gif|svg|ico|css|js|woff2?|ttf|eot|pdf|zip|mp4|webp|map)(\?|$)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const ENDPOINT_RE = /["'`](\/(?:api|v\d|graphql|rest|wp-json|admin|internal)[^"'`\s]*)["'`]/gi;
const FETCH_RE = /(?:fetch|axios(?:\.\w+)?)\(\s*["'`]([^"'`]+)["'`]/gi;

export interface CrawledPage {
  url: string;
  status: number;
  title: string | null;
  depth: number;
  contentType: string | null;
}
export interface CrawlForm {
  page: string;
  action: string;
  method: string;
}
export interface CrawlProgress {
  visited: number;
  queued: number;
  endpoints: number;
}
export interface CrawlResult {
  target: string;
  base: string | null;
  pagesVisited: number;
  pages: CrawledPage[];
  internalLinks: string[];
  externalLinks: string[];
  endpoints: string[];
  forms: CrawlForm[];
  emails: string[];
  error?: string;
}
export interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  concurrency?: number;
  timeoutMs?: number;
  onProgress?: (p: CrawlProgress) => void;
}

@Injectable()
export class CrawlerService {
  async crawl(target: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
    const maxDepth = opts.maxDepth ?? 2;
    const maxPages = Math.min(opts.maxPages ?? 80, 300);
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 8, 20));
    const timeoutMs = opts.timeoutMs ?? 8000;

    const base = await this.resolveBase(target, timeoutMs);
    if (!base) {
      return { target, base: null, pagesVisited: 0, pages: [], internalLinks: [], externalLinks: [], endpoints: [], forms: [], emails: [], error: 'Host inacessível.' };
    }
    const host = new URL(base).hostname;

    const visited = new Set<string>();
    const pages: CrawledPage[] = [];
    const internal = new Set<string>();
    const external = new Set<string>();
    const endpoints = new Set<string>();
    const forms: CrawlForm[] = [];
    const emails = new Set<string>();

    let queue: { url: string; depth: number }[] = [{ url: base, depth: 0 }];
    visited.add(this.norm(base));

    const emit = () => opts.onProgress?.({ visited: pages.length, queued: queue.length, endpoints: endpoints.size });

    while (queue.length && pages.length < maxPages) {
      const batch = queue.splice(0, concurrency);
      const next: { url: string; depth: number }[] = [];

      await Promise.all(
        batch.map(async ({ url, depth }) => {
          if (pages.length >= maxPages) return;
          const page = await this.fetchPage(url, timeoutMs);
          if (!page) return;
          pages.push({ url, status: page.status, title: this.title(page.body), depth, contentType: page.contentType });

          if (!page.contentType?.includes('html')) return;

          for (const m of page.body.matchAll(EMAIL_RE)) emails.add(m[0].toLowerCase());
          for (const m of page.body.matchAll(ENDPOINT_RE)) endpoints.add(m[1]);
          for (const m of page.body.matchAll(FETCH_RE)) if (m[1].startsWith('/') || m[1].startsWith('http')) endpoints.add(m[1]);
          for (const f of this.parseForms(page.body, url)) forms.push(f);

          for (const raw of this.parseLinks(page.body)) {
            let abs: URL;
            try {
              abs = new URL(raw, url);
            } catch {
              continue;
            }
            if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
            abs.hash = '';
            const u = abs.toString();
            if (abs.hostname === host) {
              internal.add(u);
              const key = this.norm(u);
              if (!visited.has(key) && depth + 1 <= maxDepth && !ASSET_RE.test(abs.pathname) && pages.length + next.length < maxPages) {
                visited.add(key);
                next.push({ url: u, depth: depth + 1 });
              }
            } else {
              external.add(u);
            }
          }
        }),
      );
      queue = queue.concat(next);
      emit();
    }

    return {
      target,
      base,
      pagesVisited: pages.length,
      pages: pages.slice(0, 300),
      internalLinks: [...internal].slice(0, 500),
      externalLinks: [...external].slice(0, 300),
      endpoints: [...endpoints].slice(0, 200),
      forms: forms.slice(0, 100),
      emails: [...emails].slice(0, 100),
    };
  }

  private norm(u: string): string {
    return u.replace(/\/+$/, '').replace(/^https?:\/\//, '').toLowerCase();
  }
  private title(body: string): string | null {
    const m = body.match(/<title[^>]*>([^<]*)<\/title>/i);
    return m ? m[1].trim().slice(0, 200) : null;
  }
  private parseLinks(body: string): string[] {
    const out: string[] = [];
    for (const m of body.matchAll(/<a\b[^>]*?href=["']([^"'#]+)["']/gi)) out.push(m[1]);
    return out;
  }
  private parseForms(body: string, page: string): CrawlForm[] {
    const out: CrawlForm[] = [];
    for (const m of body.matchAll(/<form\b([^>]*)>/gi)) {
      const attrs = m[1];
      const action = attrs.match(/action=["']([^"']*)["']/i)?.[1] ?? '';
      const method = (attrs.match(/method=["']([^"']*)["']/i)?.[1] ?? 'GET').toUpperCase();
      let abs = action;
      try {
        abs = new URL(action || page, page).toString();
      } catch {
        /* mantém cru */
      }
      out.push({ page, action: abs, method });
    }
    return out;
  }

  private async resolveBase(target: string, timeoutMs: number): Promise<string | null> {
    if (/^https?:\/\//.test(target)) return target.replace(/\/+$/, '');
    const host = target.replace(/^https?:\/\//, '').split('/')[0].trim();
    for (const scheme of ['https', 'http']) {
      const p = await this.fetchPage(`${scheme}://${host}/`, timeoutMs);
      if (p) return `${scheme}://${host}`;
    }
    return null;
  }

  private fetchPage(url: string, timeoutMs: number): Promise<{ status: number; contentType: string | null; body: string } | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v: any) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      try {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.request(url, { method: 'GET', timeout: timeoutMs, rejectUnauthorized: false, headers: { 'User-Agent': UA } }, (resp) => {
          const ct = (resp.headers['content-type'] as string) ?? null;
          let body = '';
          resp.on('data', (d) => {
            if (body.length < 600000) body += d.toString('utf8');
            else resp.destroy();
          });
          const done = () => finish({ status: resp.statusCode ?? 0, contentType: ct, body });
          resp.on('end', done);
          resp.on('close', done);
        });
        req.on('timeout', () => {
          req.destroy();
          finish(null);
        });
        req.on('error', () => finish(null));
        req.end();
      } catch {
        finish(null);
      }
    });
  }
}
