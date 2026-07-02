import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fetchJson } from './http.util';

/**
 * Threat Feeds — centraliza fontes de inteligência, NORMALIZA e armazena local
 * (consultas batem no banco). v1: CISA KEV (JSON oficial) + RSS de segurança com
 * extração de IOCs (núcleo do ThreatIngestor, reimplementado nativo via regex).
 */

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

const DEFAULT_RSS: { name: string; url: string }[] = [
  { name: 'thehackernews', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'bleepingcomputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'krebsonsecurity', url: 'https://krebsonsecurity.com/feed/' },
];

// ── Regex de extração de IOC ────────────────────────────────────────────────────
const RE = {
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  cve: /\bCVE-\d{4}-\d{4,7}\b/gi,
  sha256: /\b[a-f0-9]{64}\b/gi,
  sha1: /\b[a-f0-9]{40}\b/gi,
  md5: /\b[a-f0-9]{32}\b/gi,
  url: /\bhttps?:\/\/[^\s"'<>)\]]+/gi,
  domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi,
};
const TECH_DOMAINS = /(?:w3\.org|example\.com|google\.com|youtube\.com|twitter\.com|facebook\.com|feedburner\.com|schema\.org|gravatar\.com)/i;

export interface ExtractedIoc {
  iocType: string;
  value: string;
}

@Injectable()
export class ThreatFeedsService {
  private readonly logger = new Logger(ThreatFeedsService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Extrai IOCs de um texto livre (defang básico) — reimplementação do ThreatIngestor. */
  extractIocs(text: string): ExtractedIoc[] {
    const t = (text || '').replace(/\[\.\]/g, '.').replace(/\(\.\)/g, '.').replace(/hxxp/gi, 'http');
    const seen = new Set<string>();
    const out: ExtractedIoc[] = [];
    const add = (iocType: string, value: string) => {
      const v = value.trim().toLowerCase();
      const k = `${iocType}:${v}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ iocType, value });
      }
    };
    for (const m of t.matchAll(RE.cve)) add('cve', m[0].toUpperCase());
    for (const m of t.matchAll(RE.ipv4)) add('ip', m[0]);
    for (const m of t.matchAll(RE.sha256)) add('hash', m[0]);
    for (const m of t.matchAll(RE.sha1)) if (!seen.has(`hash:${m[0].toLowerCase()}`)) add('hash', m[0]);
    for (const m of t.matchAll(RE.md5)) if (!seen.has(`hash:${m[0].toLowerCase()}`)) add('hash', m[0]);
    for (const m of t.matchAll(RE.url)) add('url', m[0]);
    for (const m of t.matchAll(RE.domain)) {
      const d = m[0].toLowerCase();
      if (!TECH_DOMAINS.test(d) && !out.some((o) => o.iocType === 'url' && o.value.includes(d))) add('domain', d);
    }
    return out.slice(0, 50);
  }

  async syncAll(): Promise<{ kev: number; rss: number; iocs: number }> {
    const [kev, rss] = await Promise.all([this.syncCisaKev(), this.syncRss()]);
    return { kev, rss: rss.advisories, iocs: rss.iocs };
  }

  async syncCisaKev(): Promise<number> {
    try {
      const { status, json } = await fetchJson<any>(CISA_KEV_URL, { timeoutMs: 30000 });
      if (status !== 200 || !json?.vulnerabilities) {
        this.logger.warn(`CISA KEV: HTTP ${status}`);
        return 0;
      }
      let n = 0;
      for (const v of json.vulnerabilities as any[]) {
        await this.upsert({
          source: 'cisa-kev',
          type: 'kev',
          key: v.cveID,
          title: v.vulnerabilityName ?? v.cveID,
          url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
          iocType: 'cve',
          indicator: v.cveID,
          vendor: v.vendorProject ?? null,
          product: v.product ?? null,
          severity: v.knownRansomwareCampaignUse === 'Known' ? 'ransomware' : null,
          publishedAt: v.dateAdded ? new Date(v.dateAdded) : null,
          details: {
            shortDescription: v.shortDescription,
            requiredAction: v.requiredAction,
            dueDate: v.dueDate,
            knownRansomware: v.knownRansomwareCampaignUse,
          },
        });
        n++;
      }
      this.logger.log(`CISA KEV: ${n} vulnerabilidades sincronizadas`);
      return n;
    } catch (e) {
      this.logger.error(`CISA KEV falhou: ${String(e)}`);
      return 0;
    }
  }

  async syncRss(feeds = DEFAULT_RSS): Promise<{ advisories: number; iocs: number }> {
    let advisories = 0;
    let iocs = 0;
    for (const feed of feeds) {
      try {
        const xml = await this.fetchText(feed.url, 20000);
        if (!xml) continue;
        const items = this.parseRss(xml);
        for (const it of items.slice(0, 30)) {
          await this.upsert({
            source: `rss:${feed.name}`,
            type: 'advisory',
            key: it.link || it.title,
            title: it.title.slice(0, 300),
            url: it.link,
            publishedAt: it.pubDate ? new Date(it.pubDate) : null,
            details: { snippet: it.description.slice(0, 500) },
          });
          advisories++;
          // extrai IOCs do título + descrição
          for (const ioc of this.extractIocs(`${it.title} ${it.description}`)) {
            await this.upsert({
              source: `rss:${feed.name}`,
              type: 'ioc',
              key: `${ioc.iocType}:${ioc.value.toLowerCase()}`,
              title: it.title.slice(0, 200),
              url: it.link,
              iocType: ioc.iocType,
              indicator: ioc.value,
              publishedAt: it.pubDate ? new Date(it.pubDate) : null,
            });
            iocs++;
          }
        }
      } catch (e) {
        this.logger.warn(`RSS ${feed.name} falhou: ${String(e)}`);
      }
    }
    this.logger.log(`RSS: ${advisories} advisories, ${iocs} IOCs`);
    return { advisories, iocs };
  }

  async query(opts: { type?: string; iocType?: string; source?: string; q?: string; limit?: number }) {
    const where: Prisma.ThreatFeedItemWhereInput = {};
    if (opts.type) where.type = opts.type;
    if (opts.iocType) where.iocType = opts.iocType;
    if (opts.source) where.source = opts.source;
    if (opts.q) where.OR = [
      { title: { contains: opts.q, mode: 'insensitive' } },
      { indicator: { contains: opts.q, mode: 'insensitive' } },
      { product: { contains: opts.q, mode: 'insensitive' } },
      { vendor: { contains: opts.q, mode: 'insensitive' } },
    ];
    return this.prisma.threatFeedItem.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { fetchedAt: 'desc' }],
      take: Math.min(opts.limit ?? 100, 500),
    });
  }

  async stats() {
    const [total, kev, iocs, advisories, ransomware, bySource] = await Promise.all([
      this.prisma.threatFeedItem.count(),
      this.prisma.threatFeedItem.count({ where: { type: 'kev' } }),
      this.prisma.threatFeedItem.count({ where: { type: 'ioc' } }),
      this.prisma.threatFeedItem.count({ where: { type: 'advisory' } }),
      this.prisma.threatFeedItem.count({ where: { severity: 'ransomware' } }),
      this.prisma.threatFeedItem.groupBy({ by: ['source'], _count: { source: true } }),
    ]);
    const last = await this.prisma.threatFeedItem.findFirst({ orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } });
    return {
      total, kev, iocs, advisories, ransomware,
      sources: bySource.map((s) => ({ source: s.source, count: s._count.source })),
      lastSync: last?.fetchedAt ?? null,
    };
  }

  /** Correlação: itens de feed que casam com um indicador (para o Correlation Engine). */
  matchIndicator(value: string) {
    return this.prisma.threatFeedItem.findMany({
      where: {
        OR: [
          { indicator: { equals: value, mode: 'insensitive' } },
          { type: 'advisory', title: { contains: value, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  /** Correlação tecnologia→CVE: entradas do CISA KEV cujo vendor/product casa com a tecnologia. */
  matchProduct(keyword: string) {
    const kw = keyword.trim();
    if (kw.length < 3) return Promise.resolve([]);
    return this.prisma.threatFeedItem.findMany({
      where: {
        type: 'kev',
        OR: [
          { product: { contains: kw, mode: 'insensitive' } },
          { vendor: { contains: kw, mode: 'insensitive' } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 25,
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  private async upsert(data: {
    source: string; type: string; key: string; title: string; url?: string | null;
    iocType?: string | null; indicator?: string | null; vendor?: string | null;
    product?: string | null; severity?: string | null; publishedAt?: Date | null; details?: unknown;
  }) {
    await this.prisma.threatFeedItem.upsert({
      where: { source_key: { source: data.source, key: data.key } },
      create: { ...data, details: (data.details ?? undefined) as Prisma.InputJsonValue | undefined, fetchedAt: new Date() },
      update: { title: data.title, url: data.url, publishedAt: data.publishedAt, fetchedAt: new Date() },
    });
  }

  private parseRss(xml: string): { title: string; link: string; description: string; pubDate: string }[] {
    const items: { title: string; link: string; description: string; pubDate: string }[] = [];
    const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi) ?? [];
    const tag = (b: string, t: string) => {
      const m = b.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'));
      return m ? this.clean(m[1]) : '';
    };
    for (const b of blocks) {
      let link = tag(b, 'link');
      if (!link) {
        const href = b.match(/<link\b[^>]*href=["']([^"']+)["']/i);
        link = href ? href[1] : '';
      }
      items.push({
        title: tag(b, 'title'),
        link,
        description: tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'),
        pubDate: tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated'),
      });
    }
    return items;
  }
  private clean(s: string): string {
    return s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  private async fetchText(url: string, timeoutMs: number): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'RedNest/0.2' }, signal: ctrl.signal });
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
