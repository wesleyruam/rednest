import { Injectable } from '@nestjs/common';
import { NvdService } from '../integrations/nvd.service';
import { ThreatFeedsService } from '../integrations/threat-feeds.service';
import type { EmitEvent } from '../timeline/timeline.service';
import { ReconEngine } from './recon.engine';
import { ThreatIntelEngine } from './threatintel.engine';

/** Callback de emissão no Investigation Event Bus (sem o escopo, preenchido por quem chama). */
export type Bus = (e: Omit<EmitEvent, 'operationId' | 'engagementId'>) => void;

export interface CorrelatedHost {
  ip: string;
  from: string; // domínio de origem
  threatIntel: unknown;
  asn: unknown;
}

export interface FeedMatch {
  indicator: string;
  hits: { source: string; type: string; title: string; url?: string | null }[];
}
export interface TechMatch {
  tech: string;
  cves: { cveID: string; vendor?: string | null; product?: string | null; ransomware: boolean; kev: boolean; score?: number | null }[];
}

/**
 * Correlation Engine — relaciona automaticamente o que as outras engines
 * descobriram. v1: a partir dos IPs resolvidos dos domínios, dispara Threat
 * Intel + ASN (engines conversando entre si) e emite eventos de correlação.
 */
@Injectable()
export class CorrelationEngine {
  constructor(
    private readonly recon: ReconEngine,
    private readonly threat: ThreatIntelEngine,
    private readonly feeds: ThreatFeedsService,
    private readonly nvd: NvdService,
  ) {}

  async correlate(
    tokens: any[],
    bus: Bus,
  ): Promise<{ hosts: CorrelatedHost[]; feedMatches: FeedMatch[]; techMatches: TechMatch[] }> {
    const knownIps = new Set(tokens.filter((t) => t.kind === 'ip').map((t) => t.value));
    const derived: { ip: string; from: string }[] = [];

    for (const t of tokens) {
      if (t.kind !== 'domain') continue;
      const ips: string[] = [...(t.whois?.dns?.A ?? []), ...(t.whois?.dns?.AAAA ?? [])];
      for (const ip of ips) {
        if (!knownIps.has(ip) && !derived.some((d) => d.ip === ip)) derived.push({ ip, from: t.value });
      }
    }

    bus({
      type: 'engine_started',
      engine: 'correlation',
      category: 'correlation',
      icon: 'correlation',
      title: `Correlação iniciada${derived.length ? ` — ${derived.length} host(s) derivado(s)` : ''}`,
    });

    const hosts: CorrelatedHost[] = [];
    for (const { ip, from } of derived.slice(0, 6)) {
      bus({
        type: 'correlation',
        engine: 'correlation',
        category: 'correlation',
        icon: 'correlation',
        title: `Host ${ip} ligado a ${from}`,
        description: from,
        details: { ip, from },
      });

      const [threatIntel, asn] = await Promise.all([
        this.threat.ip(ip).catch(() => null),
        this.recon.asn(ip).catch(() => null),
      ]);

      const verdict = (threatIntel as any)?.verdict;
      if (verdict) {
        bus({
          type: 'asset_found',
          engine: 'threatintel',
          category: 'finding',
          icon: 'shield',
          severity: verdict === 'malicious' ? 'high' : verdict === 'suspicious' ? 'medium' : undefined,
          title: `Host ${ip}: threat intel ${verdict}`,
          description: ip,
          details: { ip, from },
        });
      }
      const asnNo = (asn as any)?.asn;
      if (asnNo) {
        bus({
          type: 'asset_found',
          engine: 'recon',
          category: 'finding',
          icon: 'server',
          title: `Host ${ip}: AS${asnNo} ${(asn as any).org ?? ''}`.trim(),
          description: ip,
          details: { ip, from },
        });
      }

      hosts.push({ ip, from, threatIntel, asn });
    }

    // ── Cruzamento com Threat Feeds (base local: CISA KEV + IOCs dos feeds) ──────
    const feedMatches = await this.matchFeeds(tokens, hosts, bus);
    const techMatches = await this.matchTech(tokens, bus);

    return { hosts, feedMatches, techMatches };
  }

  /** Indicadores da investigação (domínios/IPs) que aparecem nos Threat Feeds. */
  private async matchFeeds(tokens: any[], hosts: CorrelatedHost[], bus: Bus): Promise<FeedMatch[]> {
    const indicators = new Set<string>();
    for (const t of tokens) {
      if (t.kind === 'domain' || t.kind === 'ip') indicators.add(t.value);
    }
    for (const h of hosts) indicators.add(h.ip);

    const out: FeedMatch[] = [];
    for (const ind of [...indicators].slice(0, 20)) {
      const items = await this.feeds.matchIndicator(ind).catch(() => []);
      if (!items.length) continue;
      const hits = items.slice(0, 10).map((i) => ({ source: i.source, type: i.type, title: i.title, url: i.url }));
      out.push({ indicator: ind, hits });
      bus({
        type: 'correlation',
        engine: 'threatintel',
        category: 'correlation',
        icon: 'database',
        severity: 'medium',
        title: `${ind} mencionado em ${hits.length} item(ns) de threat feed`,
        description: ind,
        details: { indicator: ind, hits },
      });
    }
    return out;
  }

  /** Tecnologias identificadas (Service Scan) que têm CVEs no CISA KEV. */
  private async matchTech(tokens: any[], bus: Bus): Promise<TechMatch[]> {
    const techs = new Set<string>();
    for (const t of tokens) {
      for (const s of t.servicescan?.services ?? []) {
        for (const tech of s.http?.technologies ?? []) techs.add(String(tech));
      }
    }
    const out: TechMatch[] = [];
    for (const tech of [...techs].slice(0, 12)) {
      const [kevItems, nvdItems] = await Promise.all([
        this.feeds.matchProduct(tech).catch(() => []),
        this.nvd.forProduct(tech).catch(() => []),
      ]);
      const byCve = new Map<string, TechMatch['cves'][number]>();
      for (const i of kevItems) {
        const id = i.indicator ?? i.key;
        byCve.set(id, { cveID: id, vendor: i.vendor, product: i.product, ransomware: i.severity === 'ransomware', kev: true });
      }
      for (const c of nvdItems) {
        const ex = byCve.get(c.cveId);
        if (ex) { ex.score = c.cvssScore; ex.product = ex.product ?? c.products?.[0]; }
        else byCve.set(c.cveId, { cveID: c.cveId, vendor: c.vendors?.[0] ?? null, product: c.products?.[0] ?? null, ransomware: false, kev: false, score: c.cvssScore });
      }
      if (byCve.size === 0) continue;
      // KEV/ransomware primeiro, depois por score
      const cves = [...byCve.values()]
        .sort((a, b) => Number(b.kev) - Number(a.kev) || (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 20);
      out.push({ tech, cves });
      const kevN = cves.filter((c) => c.kev).length;
      bus({
        type: 'correlation',
        engine: 'threatintel',
        category: 'correlation',
        icon: 'shield',
        severity: cves.some((c) => c.ransomware) ? 'high' : kevN ? 'high' : 'medium',
        title: `Tecnologia ${tech}: ${cves.length} CVE(s)${kevN ? ` (${kevN} no CISA KEV)` : ''}`,
        description: tech,
        details: { tech, cves },
      });
    }
    return out;
  }
}
