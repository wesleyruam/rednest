import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fetchJson } from './http.util';
import { ProviderKeysService } from './provider-keys.service';

/**
 * NVD (NIST) — sincroniza CVEs recentes para o banco local (consultas/estatísticas
 * rápidas) e faz lookup ao vivo de CVE específica. Chave `nvd` (provider_keys)
 * opcional eleva o rate-limit (5→50 req/30s).
 */

const NVD_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class NvdService {
  private readonly logger = new Logger(NvdService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ProviderKeysService,
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const key = await this.keys.getKey('nvd');
    return key ? { apiKey: key } : {};
  }

  /** Sincroniza CVEs publicadas nos últimos `days` dias para o banco local. */
  async sync(days = 14, maxPages = 8): Promise<{ synced: number; pages: number }> {
    const headers = await this.headers();
    const delay = headers.apiKey ? 800 : 6500; // respeita rate-limit
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const perPage = 500; // páginas menores = corpo menor (evita timeout no download)
    let startIndex = 0;
    let synced = 0;
    let pages = 0;

    for (let i = 0; i < maxPages; i++) {
      const url =
        `${NVD_URL}?pubStartDate=${start.toISOString()}&pubEndDate=${end.toISOString()}` +
        `&resultsPerPage=${perPage}&startIndex=${startIndex}`;
      const { status, json } = await fetchJson<any>(url, { headers, timeoutMs: 60000 });
      if (status !== 200 || !json?.vulnerabilities) {
        this.logger.warn(`NVD sync: HTTP ${status} (startIndex ${startIndex})`);
        break;
      }
      pages++;
      for (const v of json.vulnerabilities as any[]) {
        await this.upsert(this.normalize(v.cve));
        synced++;
      }
      const total = json.totalResults ?? 0;
      startIndex += perPage;
      if (startIndex >= total) break;
      await sleep(delay);
    }
    this.logger.log(`NVD: ${synced} CVEs sincronizadas (${pages} página(s))`);
    return { synced, pages };
  }

  async getOne(cveId: string) {
    const id = cveId.toUpperCase();
    const local = await this.prisma.cve.findUnique({ where: { cveId: id } });
    if (local) return local;
    const headers = await this.headers();
    const { status, json } = await fetchJson<any>(`${NVD_URL}?cveId=${encodeURIComponent(id)}`, { headers, timeoutMs: 25000 });
    if (status !== 200 || !json?.vulnerabilities?.length) return null;
    const norm = this.normalize(json.vulnerabilities[0].cve);
    await this.upsert(norm);
    return this.prisma.cve.findUnique({ where: { cveId: id } });
  }

  async search(opts: { cve?: string; q?: string; severity?: string; minScore?: number; limit?: number }) {
    if (opts.cve) {
      const one = await this.getOne(opts.cve);
      return one ? [one] : [];
    }
    const where: Prisma.CveWhereInput = {};
    if (opts.q) where.searchText = { contains: opts.q.toLowerCase() };
    if (opts.severity) where.cvssSeverity = opts.severity.toUpperCase();
    if (opts.minScore != null) where.cvssScore = { gte: opts.minScore };
    return this.prisma.cve.findMany({
      where,
      orderBy: [{ published: 'desc' }],
      take: Math.min(opts.limit ?? 100, 500),
    });
  }

  /** Correlação tech→CVE (ampla, base local NVD) — complementa o CISA KEV. */
  async forProduct(keyword: string) {
    const kw = keyword.trim().toLowerCase();
    if (kw.length < 3) return [];
    return this.prisma.cve.findMany({
      where: { searchText: { contains: kw } },
      orderBy: [{ cvssScore: 'desc' }, { published: 'desc' }],
      take: 20,
    });
  }

  async stats() {
    const [total, bySev, last] = await Promise.all([
      this.prisma.cve.count(),
      this.prisma.cve.groupBy({ by: ['cvssSeverity'], _count: { cvssSeverity: true } }),
      this.prisma.cve.findFirst({ orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } }),
    ]);
    const severity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
    for (const s of bySev) if (s.cvssSeverity) severity[s.cvssSeverity] = s._count.cvssSeverity;

    // distribuição CVSS (buckets) + top vendors em JS sobre amostra recente
    const sample = await this.prisma.cve.findMany({
      orderBy: { published: 'desc' },
      take: 3000,
      select: { cvssScore: true, vendors: true },
    });
    const cvss = { '0-4': 0, '4-7': 0, '7-9': 0, '9-10': 0 };
    const vendorCount: Record<string, number> = {};
    for (const c of sample) {
      const s = c.cvssScore ?? 0;
      if (s >= 9) cvss['9-10']++;
      else if (s >= 7) cvss['7-9']++;
      else if (s >= 4) cvss['4-7']++;
      else if (s > 0) cvss['0-4']++;
      for (const v of c.vendors) vendorCount[v] = (vendorCount[v] ?? 0) + 1;
    }
    const topVendors = Object.entries(vendorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([vendor, count]) => ({ vendor, count }));

    return { total, severity, cvss, topVendors, lastSync: last?.fetchedAt ?? null };
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  private normalize(cve: any) {
    const cveId: string = cve.id;
    const description: string = (cve.descriptions ?? []).find((d: any) => d.lang === 'en')?.value ?? '';
    const metric =
      cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0] ?? cve.metrics?.cvssMetricV2?.[0];
    const cvssData = metric?.cvssData;
    const cvssScore: number | null = cvssData?.baseScore ?? null;
    const cvssSeverity: string | null = cvssData?.baseSeverity ?? metric?.baseSeverity ?? null;
    const cwe: string | null = cve.weaknesses?.[0]?.description?.find((d: any) => d.value?.startsWith('CWE'))?.value ?? null;
    const refs: string[] = (cve.references ?? []).slice(0, 10).map((r: any) => r.url);

    const vendors = new Set<string>();
    const products = new Set<string>();
    for (const conf of cve.configurations ?? []) {
      for (const node of conf.nodes ?? []) {
        for (const m of node.cpeMatch ?? []) {
          const parts = String(m.criteria ?? '').split(':'); // cpe:2.3:a:vendor:product:version:...
          if (parts[3] && parts[3] !== '*') vendors.add(parts[3]);
          if (parts[4] && parts[4] !== '*') products.add(parts[4]);
        }
      }
    }
    const vendorArr = [...vendors].slice(0, 30);
    const productArr = [...products].slice(0, 30);
    const searchText = `${description} ${vendorArr.join(' ')} ${productArr.join(' ')}`.toLowerCase();

    return {
      cveId,
      published: cve.published ? new Date(cve.published) : null,
      lastModified: cve.lastModified ? new Date(cve.lastModified) : null,
      description,
      cvssScore,
      cvssSeverity,
      cvssVector: cvssData?.vectorString ?? null,
      cvssVersion: cvssData?.version ?? (cve.metrics?.cvssMetricV2 ? '2.0' : null),
      cwe,
      vendors: vendorArr,
      products: productArr,
      refs,
      searchText,
    };
  }

  private async upsert(c: ReturnType<NvdService['normalize']>) {
    await this.prisma.cve.upsert({
      where: { cveId: c.cveId },
      create: { ...c, fetchedAt: new Date() } as Prisma.CveCreateInput,
      update: { ...c, fetchedAt: new Date() } as Prisma.CveUpdateInput,
    });
  }
}
