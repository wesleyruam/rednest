import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProxyProtocol } from '@prisma/client';
import { createHash } from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Proxy Pool Engine — baixa/atualiza a lista do ProxyScrape (http/socks4/socks5),
 * valida (vivo, latência, IP de saída, país, anonimato) e mantém um pool saudável.
 * Oferece transporte de saída rotativo (`fetchThrough`) p/ as engines roteirem
 * requisições por proxy, e checagem geo-distribuída (anti-cloaking).
 *
 * ATENÇÃO: proxies públicos podem logar/alterar tráfego — usar só p/ GET de recon
 * não autenticado, nunca para credenciais/dados sensíveis.
 */

const SOURCE_URL = 'https://raw.githubusercontent.com/ProxyScrape/free-proxy-list/main/proxies/all/data.txt';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) RedNest/0.2';
const VALIDATE_URL = 'https://api.ipify.org?format=json'; // eco do IP de saída
const MAX_POOL = 4000;       // teto de proxies armazenados
const VALIDATE_BATCH = 600;  // quantos validar por ciclo
const VALIDATE_CONCURRENCY = 80;
const VALIDATE_TIMEOUT = 8000;
const GEO_CONCURRENCY = 6;

interface ParsedProxy { protocol: ProxyProtocol; host: string; port: number }
interface ThroughResult { status: number; body: string; headers: Record<string, string>; elapsedMs: number; finalUrl: string }
export interface FetchThroughOpts { protocol?: ProxyProtocol; country?: string; timeoutMs?: number; maxBytes?: number; tries?: number; fallbackDirect?: boolean }

@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly logger = new Logger(ProxyService.name);
  private ownIp: string | null = null;
  private validating = false;
  private rr = 0; // round-robin cursor

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // popula/valida em background, sem bloquear o boot
    setTimeout(() => void this.bootstrap().catch((e) => this.logger.warn(`bootstrap proxy: ${String(e)}`)), 8000);
    // re-valida o pool periodicamente (a cada 30 min)
    setInterval(() => void this.validatePool().catch(() => undefined), 30 * 60 * 1000);
  }

  private async bootstrap(): Promise<void> {
    const count = await this.prisma.proxy.count();
    if (count === 0) await this.refreshFromSource();
    await this.validatePool();
  }

  // ── Fonte ────────────────────────────────────────────────────────────────────
  async refreshFromSource(): Promise<{ fetched: number; added: number }> {
    const text = await this.fetchDirect(SOURCE_URL, 20000);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: ParsedProxy[] = [];
    for (const line of lines) {
      const m = /^(http|socks4|socks5):\/\/([\d.]+):(\d{2,5})$/i.exec(line);
      if (!m) continue;
      parsed.push({ protocol: m[1].toLowerCase() as ProxyProtocol, host: m[2], port: parseInt(m[3], 10) });
    }
    const slice = parsed.slice(0, MAX_POOL);
    let added = 0;
    // upsert em lotes
    for (let i = 0; i < slice.length; i += 200) {
      const batch = slice.slice(i, i + 200);
      await Promise.all(batch.map(async (p) => {
        try {
          await this.prisma.proxy.upsert({
            where: { protocol_host_port: { protocol: p.protocol, host: p.host, port: p.port } },
            create: { protocol: p.protocol, host: p.host, port: p.port, source: 'proxyscrape' },
            update: {},
          });
          added++;
        } catch { /* ignora duplicado/erro */ }
      }));
    }
    this.logger.log(`refresh: ${parsed.length} parseados, ${added} no pool`);
    return { fetched: parsed.length, added };
  }

  // ── Validação ────────────────────────────────────────────────────────────────
  async validatePool(): Promise<{ checked: number; alive: number }> {
    if (this.validating) return { checked: 0, alive: 0 };
    this.validating = true;
    try {
      await this.ensureOwnIp();
      // prioriza nunca-checados e os que estavam vivos
      const candidates = await this.prisma.proxy.findMany({
        where: { failCount: { lt: 6 } },
        orderBy: [{ lastCheckedAt: { sort: 'asc', nulls: 'first' } }],
        take: VALIDATE_BATCH,
      });
      let alive = 0;
      await this.pool(candidates, VALIDATE_CONCURRENCY, async (p) => {
        const r = await this.checkOne(p);
        if (r.alive) alive++;
      });
      // poda os reprovados crônicos
      await this.prisma.proxy.deleteMany({ where: { failCount: { gte: 6 }, alive: false } });
      this.logger.log(`validate: ${candidates.length} checados, ${alive} vivos`);
      return { checked: candidates.length, alive };
    } finally {
      this.validating = false;
    }
  }

  private async ensureOwnIp(): Promise<void> {
    if (!this.ownIp) this.ownIp = await this.fetchDirect(VALIDATE_URL, 8000).then((t) => { try { return JSON.parse(t).ip; } catch { return null; } }).catch(() => null);
  }

  /** Testa um proxy (sem tocar no banco) — devolve vivo/latência/IP de saída/país/anonimato. */
  async probe(p: { protocol: ProxyProtocol; host: string; port: number }, opts: { geo?: boolean } = {}): Promise<{ alive: boolean; latencyMs?: number; exitIp?: string; anonymity?: string; country?: string | null; countryName?: string | null }> {
    const started = Date.now();
    try {
      await this.ensureOwnIp();
      const res = await this.through(VALIDATE_URL, p, { timeoutMs: VALIDATE_TIMEOUT, maxBytes: 4096 });
      let exitIp: string | null = null;
      try { exitIp = JSON.parse(res.body).ip; } catch { /* não-JSON */ }
      if (res.status !== 200 || !exitIp) throw new Error('resposta inválida');
      const anonymity = exitIp === this.ownIp ? 'transparent' : 'anonymous';
      const geo = opts.geo !== false ? await this.geolocate(exitIp) : null;
      return { alive: true, latencyMs: Date.now() - started, exitIp, anonymity, country: geo?.code ?? null, countryName: geo?.name ?? null };
    } catch {
      return { alive: false };
    }
  }

  private async checkOne(p: { id: string; protocol: ProxyProtocol; host: string; port: number; country: string | null }): Promise<{ alive: boolean }> {
    const r = await this.probe(p, { geo: !p.country });
    if (r.alive) {
      await this.prisma.proxy.update({
        where: { id: p.id },
        data: { alive: true, latencyMs: r.latencyMs, exitIp: r.exitIp, anonymity: r.anonymity, country: p.country ?? r.country ?? null, countryName: r.countryName ?? undefined, failCount: 0, lastCheckedAt: new Date() },
      }).catch(() => undefined);
    } else {
      await this.prisma.proxy.update({
        where: { id: p.id },
        data: { alive: false, failCount: { increment: 1 }, lastCheckedAt: new Date() },
      }).catch(() => undefined);
    }
    return { alive: r.alive };
  }

  // ── Parsing + entrada manual ─────────────────────────────────────────────────
  private parseLine(line: string): ParsedProxy | null {
    const m = /^(http|socks4|socks5):\/\/([\d.]+):(\d{2,5})$/i.exec(line.trim());
    if (!m) return null;
    return { protocol: m[1].toLowerCase() as ProxyProtocol, host: m[2], port: parseInt(m[3], 10) };
  }

  /** Testa um único proxy colado pelo operador (não persiste). */
  async testProxy(input: string): Promise<any> {
    const p = this.parseLine(input);
    if (!p) return { error: 'Formato inválido. Use protocolo://ip:porta (http, socks4, socks5).' };
    const r = await this.probe(p);
    return { protocol: p.protocol, host: p.host, port: p.port, ...r };
  }

  /** Re-testa um proxy do pool por id e atualiza o registro. */
  async testById(id: string): Promise<any> {
    const p = await this.prisma.proxy.findUnique({ where: { id } });
    if (!p) return { error: 'Proxy não encontrado' };
    const r = await this.probe(p, { geo: !p.country });
    return this.prisma.proxy.update({
      where: { id },
      data: r.alive
        ? { alive: true, latencyMs: r.latencyMs, exitIp: r.exitIp, anonymity: r.anonymity, country: p.country ?? r.country ?? null, countryName: r.countryName ?? p.countryName ?? undefined, failCount: 0, lastCheckedAt: new Date() }
        : { alive: false, failCount: { increment: 1 }, lastCheckedAt: new Date() },
    });
  }

  /** Importa uma lista colada/arquivo: parseia, deduplica, insere e valida em background. */
  async importList(text: string): Promise<{ parsed: number; added: number; invalid: number }> {
    const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let parsed = 0, added = 0, invalid = 0;
    const seen = new Set<string>();
    for (const line of lines) {
      const p = this.parseLine(line);
      if (!p) { invalid++; continue; }
      const key = `${p.protocol}:${p.host}:${p.port}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed++;
      try {
        await this.prisma.proxy.upsert({
          where: { protocol_host_port: { protocol: p.protocol, host: p.host, port: p.port } },
          create: { protocol: p.protocol, host: p.host, port: p.port, source: 'manual' },
          update: {},
        });
        added++;
      } catch { /* ignora */ }
    }
    // valida em background (não bloqueia a resposta)
    setTimeout(() => void this.validatePool().catch(() => undefined), 500);
    return { parsed, added, invalid };
  }

  async removeOne(id: string): Promise<void> {
    await this.prisma.proxy.delete({ where: { id } }).catch(() => undefined);
  }

  private async geolocate(ip: string): Promise<{ code: string; name: string } | null> {
    try {
      const t = await this.fetchDirect(`https://ipinfo.io/${ip}/json`, 6000);
      const j = JSON.parse(t);
      return j?.country ? { code: j.country, name: j.country } : null;
    } catch { return null; }
  }

  // ── Transporte rotativo (usado pelas engines) ────────────────────────────────
  /** Faz GET por um proxy vivo (round-robin), com retentativas e fallback direto. */
  async fetchThrough(url: string, opts: FetchThroughOpts = {}): Promise<{ via: string | null; result: ThroughResult }> {
    const tries = opts.tries ?? 3;
    const candidates = await this.pickWorking({ protocol: opts.protocol, country: opts.country, count: tries });
    for (const p of candidates) {
      try {
        const result = await this.through(url, p, { timeoutMs: opts.timeoutMs ?? 12000, maxBytes: opts.maxBytes ?? 2_000_000 });
        return { via: `${p.protocol}://${p.host}:${p.port}`, result };
      } catch {
        await this.prisma.proxy.update({ where: { id: p.id }, data: { failCount: { increment: 1 } } }).catch(() => undefined);
      }
    }
    if (opts.fallbackDirect !== false) {
      const body = await this.fetchDirect(url, opts.timeoutMs ?? 12000);
      return { via: null, result: { status: 200, body, headers: {}, elapsedMs: 0, finalUrl: url } };
    }
    throw new Error('Nenhum proxy disponível e fallback desabilitado.');
  }

  async pickWorking(opts: { protocol?: ProxyProtocol; country?: string; count?: number } = {}): Promise<{ id: string; protocol: ProxyProtocol; host: string; port: number }[]> {
    const where: any = { alive: true };
    if (opts.protocol) where.protocol = opts.protocol;
    if (opts.country) where.country = opts.country.toUpperCase();
    const total = await this.prisma.proxy.count({ where });
    if (total === 0) return [];
    const count = Math.min(opts.count ?? 1, total);
    const skip = total > count ? (this.rr++ * count) % Math.max(1, total - count) : 0;
    return this.prisma.proxy.findMany({ where, orderBy: { latencyMs: 'asc' }, skip, take: count, select: { id: true, protocol: true, host: true, port: true } });
  }

  // ── Checagem geo-distribuída (anti-cloaking) ─────────────────────────────────
  async geoCheck(target: string, opts: { countries?: string[]; max?: number } = {}): Promise<any> {
    const url = /^https?:\/\//.test(target) ? target : `https://${target}`;
    // 1 proxy vivo por país distinto
    const alive = await this.prisma.proxy.findMany({
      where: { alive: true, country: opts.countries?.length ? { in: opts.countries.map((c) => c.toUpperCase()) } : { not: null } },
      orderBy: { latencyMs: 'asc' },
      select: { id: true, protocol: true, host: true, port: true, country: true, countryName: true },
    });
    const byCountry = new Map<string, typeof alive[number]>();
    for (const p of alive) { if (p.country && !byCountry.has(p.country)) byCountry.set(p.country, p); }
    const picked = [...byCountry.values()].slice(0, opts.max ?? 8);

    const results: any[] = [];
    await this.pool(picked, GEO_CONCURRENCY, async (p) => {
      try {
        const res = await this.through(url, p, { timeoutMs: 15000, maxBytes: 1_500_000 });
        const text = res.body;
        results.push({
          country: p.country, countryName: p.countryName, via: `${p.protocol}://${p.host}:${p.port}`,
          status: res.status, length: text.length,
          hash: createHash('sha256').update(text.replace(/\s+/g, ' ').slice(0, 200_000)).digest('hex').slice(0, 16),
          title: /<title[^>]*>([^<]{0,200})<\/title>/i.exec(text)?.[1]?.trim() ?? null,
          finalUrl: res.finalUrl, elapsedMs: res.elapsedMs,
        });
      } catch {
        results.push({ country: p.country, countryName: p.countryName, via: `${p.protocol}://${p.host}:${p.port}`, status: 0, error: 'falha' });
      }
    });
    // baseline direto (origem do RedNest)
    let baseline: any = null;
    try {
      const direct = await this.fetchDirect(url, 15000);
      baseline = { country: 'DIRECT', countryName: 'RedNest (direto)', status: 200, length: direct.length, hash: createHash('sha256').update(direct.replace(/\s+/g, ' ').slice(0, 200_000)).digest('hex').slice(0, 16), title: /<title[^>]*>([^<]{0,200})<\/title>/i.exec(direct)?.[1]?.trim() ?? null };
    } catch { /* alvo só acessível por proxy */ }

    const ok = results.filter((r) => r.status === 200);
    const distinct = new Set(ok.map((r) => r.hash));
    const cloaking = baseline ? ok.some((r) => r.hash !== baseline.hash) : distinct.size > 1;
    return { target: url, baseline, results: results.sort((a, b) => (a.country || '').localeCompare(b.country || '')), distinctVariants: distinct.size, cloakingSuspected: cloaking };
  }

  // ── Listagem paginada + stats (para a aba de proxies) ─────────────────────────
  async list(opts: { page?: number; pageSize?: number; status?: 'alive' | 'dead' | 'all'; protocol?: ProxyProtocol; country?: string; q?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where: any = {};
    if (opts.status === 'alive') where.alive = true;
    if (opts.status === 'dead') where.alive = false;
    if (opts.protocol) where.protocol = opts.protocol;
    if (opts.country) where.country = opts.country.toUpperCase();
    if (opts.q) where.host = { contains: opts.q };
    const [total, items] = await Promise.all([
      this.prisma.proxy.count({ where }),
      this.prisma.proxy.findMany({ where, orderBy: [{ alive: 'desc' }, { latencyMs: { sort: 'asc', nulls: 'last' } }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  async stats() {
    const [total, alive, byProto, byCountry] = await Promise.all([
      this.prisma.proxy.count(),
      this.prisma.proxy.count({ where: { alive: true } }),
      this.prisma.proxy.groupBy({ by: ['protocol'], where: { alive: true }, _count: { _all: true } }),
      this.prisma.proxy.groupBy({ by: ['country'], where: { alive: true, country: { not: null } }, _count: { _all: true } }),
    ]);
    const protocols: Record<string, number> = {};
    for (const r of byProto) protocols[r.protocol] = r._count._all;
    const countries = byCountry.map((c) => ({ country: c.country, count: c._count._all })).sort((a, b) => b.count - a.count).slice(0, 30);
    return { total, alive, dead: total - alive, protocols, countries, validating: this.validating };
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────────
  private agentFor(p: { protocol: ProxyProtocol; host: string; port: number }, targetHttps: boolean): http.Agent {
    const addr = `${p.host}:${p.port}`;
    if (p.protocol === 'http') return targetHttps ? new HttpsProxyAgent(`http://${addr}`) : new HttpProxyAgent(`http://${addr}`);
    return new SocksProxyAgent(`${p.protocol}://${addr}`);
  }

  private through(url: string, p: { protocol: ProxyProtocol; host: string; port: number }, opts: { timeoutMs: number; maxBytes: number }): Promise<ThroughResult> {
    const targetHttps = url.startsWith('https');
    const agent = this.agentFor(p, targetHttps);
    // teto rígido: o connect de SOCKS morto não respeita o timeout do http.request,
    // então corremos contra um deadline p/ nunca travar (ex.: teste individual).
    return Promise.race([
      this.rawRequest(url, { agent, timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes }),
      new Promise<ThroughResult>((_, rej) => setTimeout(() => rej(new Error('timeout')), opts.timeoutMs + 2000)),
    ]);
  }

  private fetchDirect(url: string, timeoutMs: number): Promise<string> {
    return this.rawRequest(url, { timeoutMs, maxBytes: 3_000_000 }).then((r) => r.body);
  }

  private rawRequest(url: string, opts: { agent?: http.Agent; timeoutMs: number; maxBytes: number; redirects?: number }): Promise<ThroughResult> {
    return new Promise((resolve, reject) => {
      let u: URL;
      try { u = new URL(url); } catch { return reject(new Error('URL inválida')); }
      const mod = u.protocol === 'https:' ? https : http;
      const started = Date.now();
      const req = mod.request(u, { method: 'GET', agent: opts.agent, headers: { 'User-Agent': UA, Accept: '*/*' }, timeout: opts.timeoutMs }, (res) => {
        // segue redirect (limitado)
        const loc = res.headers.location;
        const redirects = opts.redirects ?? 0;
        if (loc && res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && redirects < 4) {
          res.destroy();
          const next = new URL(loc, u).toString();
          return resolve(this.rawRequest(next, { ...opts, redirects: redirects + 1 }));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => { size += c.length; if (size <= opts.maxBytes) chunks.push(c); if (size > opts.maxBytes) res.destroy(); });
        res.on('end', () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), headers, elapsedMs: Date.now() - started, finalUrl: u.toString() });
        });
        res.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.on('error', reject);
      req.end();
    });
  }

  private async pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let idx = 0;
    const worker = async () => {
      for (;;) {
        const i = idx++;
        if (i >= items.length) return;
        await fn(items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  }
}
