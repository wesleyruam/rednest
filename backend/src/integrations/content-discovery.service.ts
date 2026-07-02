import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { join } from 'node:path';

/**
 * Content Discovery — descoberta ativa de paths/arquivos (motor estilo Gobuster,
 * reimplementado nativo). Suporta wordlist, extensões, filtro de status e size,
 * e DETECÇÃO DE FALSO-POSITIVO (wildcard): se o servidor responde "sucesso" para
 * um path aleatório, a baseline é registrada e os resultados iguais são filtrados.
 */

const UA = 'RedNest/0.2';
// Códigos "interessantes" por padrão (Gobuster-like); 404 fica de fora.
const DEFAULT_STATUS = [200, 204, 301, 302, 307, 308, 401, 403, 405, 500];
const MAX_REQUESTS = 12000;

export interface FoundPath {
  path: string;
  url: string;
  status: number;
  size: number;
  redirect?: string | null;
  contentType?: string | null;
}

export interface ContentDiscoveryProgress {
  tested: number;
  total: number;
  found: number;
}

export interface ContentDiscoveryResult {
  target: string;
  baseUrl: string | null;
  total: number;
  tested: number;
  wildcard: { detected: boolean; status?: number; size?: number };
  found: FoundPath[];
  error?: string;
}

export interface ContentDiscoveryOptions {
  wordlist?: string;
  extensions?: string[];
  statusInclude?: number[];
  statusExclude?: number[];
  minSize?: number;
  maxSize?: number;
  concurrency?: number;
  timeoutMs?: number;
  onProgress?: (p: ContentDiscoveryProgress) => void;
}

@Injectable()
export class ContentDiscoveryService {
  private readonly logger = new Logger(ContentDiscoveryService.name);
  private cache: Record<string, string[]> = {};

  listWordlists(): { name: string; size: number }[] {
    return [{ name: 'common', size: this.loadWordlist('common').length }];
  }

  private loadWordlist(name = 'common'): string[] {
    const safe = /^[a-z0-9_-]+$/i.test(name) ? name : 'common';
    if (this.cache[safe]) return this.cache[safe];
    try {
      const raw = readFileSync(join(__dirname, 'data', 'wordlists', `${safe}.txt`), 'utf8');
      const words = raw.split('\n').map((w) => w.trim()).filter((w) => w && !w.startsWith('#'));
      this.cache[safe] = words;
      return words;
    } catch {
      return [];
    }
  }

  async scan(target: string, opts: ContentDiscoveryOptions = {}): Promise<ContentDiscoveryResult> {
    const timeoutMs = opts.timeoutMs ?? 7000;
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 30, 80));
    const include = opts.statusInclude?.length ? opts.statusInclude : DEFAULT_STATUS;
    const exclude = new Set(opts.statusExclude ?? []);

    const base = await this.resolveBase(target, timeoutMs);
    if (!base) return { target, baseUrl: null, total: 0, tested: 0, wildcard: { detected: false }, found: [], error: 'Host inacessível (HTTP/HTTPS).' };

    // candidatos: palavra + palavra.ext
    const words = this.loadWordlist(opts.wordlist);
    const exts = (opts.extensions ?? []).map((e) => e.replace(/^\./, '').trim()).filter(Boolean);
    const candidates: string[] = [];
    for (const w of words) {
      candidates.push(w);
      for (const e of exts) candidates.push(`${w}.${e}`);
    }
    const list = candidates.slice(0, MAX_REQUESTS);
    const total = list.length;

    // detecção de wildcard / falso-positivo
    const wildcard = await this.detectWildcard(base, include, timeoutMs);

    const found: FoundPath[] = [];
    let tested = 0;
    let idx = 0;
    const emit = () => opts.onProgress?.({ tested, total, found: found.length });

    const worker = async () => {
      for (;;) {
        const i = idx++;
        if (i >= total) return;
        const path = list[i];
        const url = `${base}/${path}`;
        const r = await this.request(url, timeoutMs);
        tested++;
        if (r && include.includes(r.status) && !exclude.has(r.status)) {
          const isWildcard = wildcard.detected && r.status === wildcard.status && Math.abs(r.size - (wildcard.size ?? 0)) <= 16;
          const sizeOk = (opts.minSize == null || r.size >= opts.minSize) && (opts.maxSize == null || r.size <= opts.maxSize);
          if (!isWildcard && sizeOk) {
            found.push({ path, url, status: r.status, size: r.size, redirect: r.redirect, contentType: r.contentType });
          }
        }
        if (tested % 25 === 0 || tested === total) emit();
      }
    };

    emit();
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
    found.sort((a, b) => a.status - b.status || a.path.localeCompare(b.path));
    return { target, baseUrl: base, total, tested, wildcard, found };
  }

  private async resolveBase(target: string, timeoutMs: number): Promise<string | null> {
    if (/^https?:\/\//.test(target)) return target.replace(/\/+$/, '');
    const host = target.replace(/^https?:\/\//, '').split('/')[0].trim();
    for (const scheme of ['https', 'http']) {
      const r = await this.request(`${scheme}://${host}/`, timeoutMs);
      if (r) return `${scheme}://${host}`;
    }
    return null;
  }

  private async detectWildcard(base: string, include: number[], timeoutMs: number) {
    const rand = randomBytes(12).toString('hex');
    const r = await this.request(`${base}/${rand}`, timeoutMs);
    if (r && include.includes(r.status)) {
      this.logger.debug(`Wildcard detectado em ${base}: ${r.status} (${r.size}B)`);
      return { detected: true, status: r.status, size: r.size };
    }
    return { detected: false };
  }

  private request(
    url: string,
    timeoutMs: number,
  ): Promise<{ status: number; size: number; redirect: string | null; contentType: string | null } | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v: any) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      try {
        const secure = url.startsWith('https');
        const mod = secure ? https : http;
        const req = mod.request(
          url,
          { method: 'GET', timeout: timeoutMs, rejectUnauthorized: false, headers: { 'User-Agent': UA } },
          (resp) => {
            const status = resp.statusCode ?? 0;
            const cl = resp.headers['content-length'];
            let counted = 0;
            resp.on('data', (d) => {
              counted += d.length;
              if (counted > 250000) resp.destroy();
            });
            const done = () =>
              finish({
                status,
                size: cl ? parseInt(cl, 10) : counted,
                redirect: (resp.headers['location'] as string) ?? null,
                contentType: (resp.headers['content-type'] as string) ?? null,
              });
            resp.on('end', done);
            resp.on('close', done);
          },
        );
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
