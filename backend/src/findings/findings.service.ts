import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Findings — tudo que as engines descobrem vira um "achado" persistido e
 * navegável por categoria (a base do workspace estilo SIEM/EDR).
 */

export interface NewFinding {
  type: string;
  value: string;
  label?: string;
  source?: string;
  target?: string;
  severity?: string;
  data?: unknown;
}

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(engagementId: string, type?: string) {
    return this.prisma.finding.findMany({
      where: { engagementId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  /**
   * Entidades unificadas da OPERAÇÃO — agrega as Findings de todos os engajamentos,
   * deduplicando por (type,value). É a fonte única de "Alvos": nada é duplicado,
   * tudo que qualquer engine descobre aparece aqui automaticamente.
   */
  async entities(operationId: string, type?: string) {
    const rows = await this.prisma.finding.findMany({
      where: { operationId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    const sevRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const map = new Map<string, any>();
    for (const f of rows) {
      const key = `${f.type}::${f.value}`;
      let e = map.get(key);
      if (!e) {
        e = {
          type: f.type, value: f.value, label: f.label ?? null,
          firstSeen: f.createdAt, lastSeen: f.createdAt,
          sources: new Set<string>(), engagements: new Set<string>(),
          occurrences: 0, severity: f.severity ?? null, tags: [], status: 'new',
          target: f.target ?? null, data: f.data ?? null,
        };
        map.set(key, e);
      }
      if (f.source) e.sources.add(f.source);
      if (f.engagementId) e.engagements.add(f.engagementId);
      e.lastSeen = f.createdAt;
      e.occurrences++;
      if (f.severity && (sevRank[f.severity] ?? 0) > (sevRank[e.severity] ?? 0)) e.severity = f.severity;
    }
    return [...map.values()]
      .map((e) => ({
        type: e.type, value: e.value, label: e.label,
        firstSeen: e.firstSeen, lastSeen: e.lastSeen,
        sources: [...e.sources], engagementCount: e.engagements.size,
        occurrences: e.occurrences, severity: e.severity, tags: e.tags, status: e.status,
        target: e.target, data: e.data,
      }))
      .sort((a, b) => +new Date(b.lastSeen) - +new Date(a.lastSeen));
  }

  /** Grafo de relacionamentos das entidades (estruturais) da operação. */
  async graph(operationId: string) {
    const STRUCT = new Set(['domain', 'subdomain', 'host', 'ip', 'email', 'username', 'profile', 'service']);
    const ents = (await this.entities(operationId)).filter((e) => STRUCT.has(e.type));
    const nodes = new Map<string, { id: string; type: string; label: string; severity: string | null }>();
    const addNode = (value: string, type: string, severity: string | null = null) => {
      if (!value) return;
      const ex = nodes.get(value);
      if (!ex) nodes.set(value, { id: value, type, label: value, severity });
      else if (severity && !ex.severity) ex.severity = severity;
    };
    const edges: { source: string; target: string }[] = [];
    for (const e of ents) {
      addNode(e.value, e.type, e.severity);
      if (e.target && e.target !== e.value) {
        if (!nodes.has(e.target)) addNode(e.target, 'root');
        edges.push({ source: e.value, target: e.target });
      }
    }
    const nodeList = [...nodes.values()].slice(0, 200);
    const ids = new Set(nodeList.map((n) => n.id));
    return { nodes: nodeList, edges: edges.filter((ed) => ids.has(ed.source) && ids.has(ed.target)) };
  }

  /** Threat Score da operação — fórmula EXPLÍCITA e auditável (ver `factors`). */
  async threatScore(operationId: string) {
    const ents = await this.entities(operationId);
    const by = (t: string) => ents.filter((e) => e.type === t);
    const iocHigh = by('ioc').filter((e) => e.severity === 'high').length;
    const iocMed = by('ioc').filter((e) => e.severity === 'medium').length;
    const cveHigh = by('cve').filter((e) => ['high', 'critical'].includes((e.severity ?? '').toLowerCase())).length;
    const cveTotal = by('cve').length;
    const creds = by('credential').length;
    const leaks = by('leak').length;
    const sshExposed = by('service').filter((e) => String(e.value).startsWith('ssh')).length;

    let score = 0;
    const factors: string[] = [];
    if (iocHigh) { score += Math.min(45, iocHigh * 25); factors.push(`${iocHigh} IOC malicioso`); }
    if (iocMed) { score += Math.min(20, iocMed * 8); factors.push(`${iocMed} IOC suspeito`); }
    if (cveHigh) { score += Math.min(35, cveHigh * 7); factors.push(`${cveHigh} CVE de alto risco`); }
    else if (cveTotal) { score += Math.min(15, cveTotal); factors.push(`${cveTotal} CVE(s)`); }
    if (creds) { score += Math.min(20, 5 + creds); factors.push(`${creds} credencial(is) exposta(s)`); }
    if (leaks) { score += Math.min(15, leaks * 4); factors.push(`${leaks} fonte(s) de vazamento`); }
    if (sshExposed) { score += 8; factors.push('SSH exposto'); }
    score = Math.max(0, Math.min(100, Math.round(score)));
    const band = score >= 75 ? 'CRÍTICO' : score >= 50 ? 'ALTO' : score >= 20 ? 'MÉDIO' : 'BAIXO';
    const color = score >= 75 ? '#e24b4a' : score >= 50 ? '#ff9f5a' : score >= 20 ? '#f4bc6a' : '#4dd4a4';
    return { score, band, color, factors, breakdown: { iocHigh, iocMed, cveHigh, cveTotal, creds, leaks } };
  }

  /** Contagem de entidades distintas por tipo (operação). */
  async entityCounts(operationId: string): Promise<Record<string, number>> {
    const ents = await this.entities(operationId);
    const out: Record<string, number> = {};
    for (const e of ents) out[e.type] = (out[e.type] ?? 0) + 1;
    out.total = ents.length;
    return out;
  }

  async counts(engagementId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.finding.groupBy({
      by: ['type'],
      where: { engagementId },
      _count: { type: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.type] = r._count.type;
    return out;
  }

  /** Salva achados deduplicando por (engagement, type, value). Retorna quantos novos. */
  /** Cria/atualiza um único achado manual e retorna o registro. */
  async addManual(engagementId: string, operationId: string, f: NewFinding) {
    const value = (f.value ?? '').toString().slice(0, 500).trim();
    if (!value) return null;
    return this.prisma.finding.upsert({
      where: { engagementId_type_value: { engagementId, type: f.type, value } },
      create: {
        engagementId, operationId, type: f.type, value,
        label: f.label, source: f.source ?? 'manual', target: f.target, severity: f.severity,
        data: (f.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      update: {
        label: f.label, source: f.source ?? 'manual', severity: f.severity,
        data: (f.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async save(engagementId: string, operationId: string, findings: NewFinding[]): Promise<number> {
    let created = 0;
    for (const f of findings) {
      const value = (f.value ?? '').toString().slice(0, 500).trim();
      if (!value) continue;
      try {
        await this.prisma.finding.upsert({
          where: { engagementId_type_value: { engagementId, type: f.type, value } },
          create: {
            engagementId,
            operationId,
            type: f.type,
            value,
            label: f.label,
            source: f.source,
            target: f.target,
            severity: f.severity,
            data: (f.data ?? undefined) as Prisma.InputJsonValue | undefined,
          },
          update: {
            label: f.label,
            source: f.source,
            severity: f.severity,
            data: (f.data ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        created++;
      } catch {
        /* ignora um achado problemático */
      }
    }
    return created;
  }

  async remove(engagementId: string, id: string): Promise<void> {
    await this.prisma.finding.deleteMany({ where: { id, engagementId } });
  }

  // ── Extração: saída de engine → achados ────────────────────────────────────────

  /** Converte o resultado de UMA ferramenta/campo em achados. */
  extract(field: string, target: string, value: any): NewFinding[] {
    const out: NewFinding[] = [];
    if (!value || value.error) return out;
    const push = (f: NewFinding) => out.push({ target, ...f });

    switch (field) {
      case 'subdomains': {
        for (const name of value.names ?? []) push({ type: 'subdomain', value: name, source: 'recon' });
        break;
      }
      case 'whois': {
        for (const ip of [...(value.dns?.A ?? []), ...(value.dns?.AAAA ?? [])]) push({ type: 'host', value: ip, source: 'recon', label: target });
        break;
      }
      case 'wordpress': {
        if (!value?.isWordPress) break;
        if (value.version?.number) push({ type: 'tech', value: `WordPress ${value.version.number}`, label: 'CMS', source: 'wpscan', target, data: { confidence: value.version.confidence, source: value.version.source } });
        else push({ type: 'tech', value: 'WordPress', label: 'CMS', source: 'wpscan', target });
        for (const usr of value.users ?? []) {
          if (!usr.login && usr.id == null) continue;
          push({ type: 'user', value: usr.login ?? `id:${usr.id}`, label: usr.displayName ?? undefined, source: `wpscan · ${usr.source}`, target, data: { id: usr.id, displayName: usr.displayName } });
        }
        for (const p of value.plugins ?? []) push({ type: 'tech', value: p.version ? `${p.slug} ${p.version}` : p.slug, label: 'plugin', source: `wpscan · ${p.source}`, target, data: { kind: 'plugin', slug: p.slug, version: p.version, url: p.url } });
        for (const t of value.themes ?? []) push({ type: 'tech', value: t.version ? `${t.slug} ${t.version}` : t.slug, label: 'theme', source: `wpscan · ${t.source}`, target, data: { kind: 'theme', slug: t.slug, version: t.version, url: t.url } });
        for (const i of value.interesting ?? []) push({ type: 'endpoint', value: i.url, label: i.type, source: 'wpscan', severity: i.severity, target, data: { description: i.description } });
        for (const c of value.configBackups ?? []) push({ type: 'leak', value: c.url, label: 'wp-config backup', source: 'wpscan', severity: 'high', target, data: { kind: 'config_backup' } });
        for (const d of value.dbExports ?? []) push({ type: 'leak', value: d.url, label: 'database export', source: 'wpscan', severity: 'high', target, data: { kind: 'db_export' } });
        for (const v of value.vulns ?? []) push({ type: 'cve', value: v.cve, label: `${v.product}${v.version ? ' ' + v.version : ''} · ${v.source}`, source: `wpscan · ${v.source}`, severity: v.severity, target: v.product, data: { product: v.product, version: v.version, score: v.score } });
        break;
      }
      case 'attribution': {
        const w = value.whois ?? {};
        const h = value.hosting ?? {};
        push({ type: 'domain', value: value.domain, label: w.registrar ?? undefined, source: 'whois', data: { registrar: w.registrar, registrarId: w.registrarId, abuseEmail: w.abuseEmail, registrant: w.registrant, created: w.created, expires: w.expires, updated: w.updated, status: w.status, nameservers: w.nameservers } });
        if (value.ip) push({ type: 'host', value: value.ip, label: h.org ?? undefined, source: 'ipinfo', target: value.domain, data: { hostname: h.hostname, asn: h.asn, org: h.org, country: h.country, region: h.region, city: h.city } });
        break;
      }
      case 'asn': {
        if (value.asn) push({ type: 'host', value: `AS${value.asn}`, label: value.org ?? '', source: 'recon', data: value });
        break;
      }
      case 'threatIntel': {
        if (value.verdict) push({ type: 'ioc', value: target, label: value.verdict, source: 'threatintel', severity: value.verdict === 'malicious' ? 'high' : value.verdict === 'suspicious' ? 'medium' : undefined, data: value });
        break;
      }
      case 'hunter': {
        for (const e of value.emails ?? []) push({ type: 'email', value: e.value ?? e, source: 'osint', data: e });
        break;
      }
      case 'email': {
        push({ type: 'email', value: target, source: 'osint', data: { hunter: value.hunter?.result, gravatar: !!value.gravatar?.found } });
        const leaks = (value.leaklookup?.n ?? 0) + (value.comb?.count ?? 0);
        if (leaks) push({ type: 'leak', value: `${target} (${leaks})`, label: target, source: 'threatintel', severity: 'medium', data: { leaklookup: value.leaklookup?.n, comb: value.comb?.count } });
        for (const r of value.comb?.records ?? []) if (r.email) push({ type: 'credential', value: `${r.email}:${r.passwordMasked ?? ''}`, label: r.email, source: 'comb' });
        break;
      }
      case 'leaklookup': {
        if (value.n) push({ type: 'leak', value: `${target} · ${value.n} fontes`, label: target, source: 'leaklookup', severity: 'medium', data: value });
        break;
      }
      case 'comb': {
        if (value.count) push({ type: 'leak', value: `${target} · COMB ${value.count}`, label: target, source: 'comb', severity: 'medium', data: { count: value.count } });
        for (const r of value.records ?? []) if (r.email) push({ type: 'credential', value: `${r.email}:${r.passwordMasked ?? ''}`, label: r.email, source: 'comb' });
        break;
      }
      case 'whatsmyname': {
        for (const h of value.found ?? []) push({ type: 'profile', value: `${h.name}: ${h.url}`, label: h.name, source: 'whatsmyname', data: h });
        break;
      }
      case 'userintel': {
        for (const p of value.platforms ?? []) if (p.found) push({ type: 'profile', value: `${p.platform}: ${p.username}`, label: p.platform, source: 'username-intel', data: p });
        break;
      }
      case 'googleintel': {
        if (value.found) push({ type: 'profile', value: `google: ${target}`, label: 'Google', source: 'google-intel', data: value });
        break;
      }
      case 'servicescan': {
        for (const s of value.services ?? []) {
          push({ type: 'service', value: `${s.protocol}://${value.host ?? target}:${s.port}`, label: String(s.protocol).toUpperCase(), source: 'recon', data: s });
          for (const tech of s.http?.technologies ?? []) push({ type: 'tech', value: tech, source: 'recon' });
        }
        break;
      }
      case 'contentdisc': {
        for (const f of value.found ?? []) push({ type: 'url', value: f.url, label: `${f.status}`, source: 'recon', data: f });
        break;
      }
      case 'crawler': {
        for (const p of value.pages ?? []) push({ type: 'url', value: p.url, label: p.title ?? undefined, source: 'crawler' });
        for (const e of value.endpoints ?? []) push({ type: 'endpoint', value: e, source: 'crawler' });
        for (const e of value.emails ?? []) push({ type: 'email', value: e, source: 'crawler' });
        break;
      }
      case 'wayback': {
        for (const u of (value.urls ?? []).slice(0, 200)) push({ type: 'url', value: u.url ?? u, source: 'wayback' });
        break;
      }
      case 'cve': {
        if (value.id || value.cve) push({ type: 'cve', value: value.id ?? value.cve, label: value.cvssSeverity ?? undefined, source: 'nvd', data: value });
        break;
      }
      case 'screenshot': {
        if (value.ok && value.screenshot) push({ type: 'screenshot', value: value.finalUrl ?? value.url, label: value.title ?? undefined, source: 'recon', data: { status: value.status, title: value.title, finalUrl: value.finalUrl, screenshot: value.screenshot } });
        break;
      }
    }
    return out;
  }

  /** Mapeia o id da ferramenta (manual) para o(s) campo(s) de extração. */
  extractTool(tool: string, target: string, result: any): NewFinding[] {
    const map: Record<string, string> = {
      subdominios: 'subdomains', hosts: 'threatIntel', threat: 'threatIntel', asn: 'asn',
      whois: 'whois', dns: 'whois', dominios: 'whois', attribution: 'attribution', wpscan: 'wordpress',
      emails: 'email', hunter: 'hunter', username: 'whatsmyname', userintel: 'userintel',
      servicescan: 'servicescan', contentdisc: 'contentdisc', crawler: 'crawler',
      wayback: 'wayback', cve: 'cve', capturas: 'screenshot',
    };
    const field = map[tool];
    if (!field) return [];
    return this.extract(field, target, result);
  }

  /** Extrai achados de TODOS os alvos de um enrichment.targets[]. */
  extractEnrichment(tokens: any[]): NewFinding[] {
    const out: NewFinding[] = [];
    const fields = ['subdomains', 'whois', 'asn', 'threatIntel', 'hunter', 'email', 'leaklookup', 'comb', 'whatsmyname', 'userintel', 'googleintel', 'servicescan'];
    for (const t of tokens ?? []) {
      for (const f of fields) {
        if (t[f]) out.push(...this.extract(f, t.value, t[f]));
      }
    }
    return out;
  }
}
