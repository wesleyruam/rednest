import { Injectable } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import { fetchJson } from './http.util';

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/**
 * Enriquecimento sem chave, portado da v1 (app/services/enrichment.py):
 * subdomínios passivos, CVE, ASN, WHOIS/RDAP, Wayback.
 */
@Injectable()
export class EnrichmentService {
  // ── Subdomínios passivos (crt.sh + CertSpotter + Anubis/jldc) ───────────────
  private cleanInto(name: string, domain: string, out: Set<string>): void {
    const n = (name || '').trim().toLowerCase().replace(/^\*\./, '');
    if (n && (n === domain || n.endsWith('.' + domain)) && DOMAIN_RE.test(n)) {
      out.add(n);
    }
  }

  private async srcCertspotter(domain: string): Promise<string[]> {
    const out = new Set<string>();
    const { json } = await fetchJson<any[]>(
      `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`,
    );
    for (const it of json ?? []) {
      for (const n of it?.dns_names ?? []) this.cleanInto(n, domain, out);
    }
    return [...out];
  }

  private async srcJldc(domain: string): Promise<string[]> {
    const out = new Set<string>();
    const { json } = await fetchJson<string[]>(
      `https://jldc.me/anubis/subdomains/${encodeURIComponent(domain)}`,
    );
    for (const n of json ?? []) this.cleanInto(n, domain, out);
    return [...out];
  }

  private async srcCrtsh(domain: string): Promise<string[]> {
    const out = new Set<string>();
    const { json } = await fetchJson<any[]>(
      `https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`,
      { timeoutMs: 30000 },
    );
    for (const entry of json ?? []) {
      for (const n of String(entry?.name_value ?? '').split(/[\n,]+/)) {
        this.cleanInto(n, domain, out);
      }
    }
    return [...out];
  }

  async passiveSubdomains(domain: string): Promise<{
    names: string[];
    sources_ok: string[];
    sources_failed: string[];
  }> {
    domain = (domain || '').trim().toLowerCase().replace(/^\*\./, '');
    const names = new Set<string>();
    const ok: string[] = [];
    const failed: string[] = [];
    const sources: Array<[string, (d: string) => Promise<string[]>]> = [
      ['certspotter', (d) => this.srcCertspotter(d)],
      ['jldc', (d) => this.srcJldc(d)],
      ['crtsh', (d) => this.srcCrtsh(d)],
    ];
    await Promise.all(
      sources.map(async ([label, fn]) => {
        try {
          (await fn(domain)).forEach((n) => names.add(n));
          ok.push(label);
        } catch {
          failed.push(label);
        }
      }),
    );
    return { names: [...names].sort(), sources_ok: ok, sources_failed: failed };
  }

  // ── CVE (CIRCL + NVD) ───────────────────────────────────────────────────────
  private parseCve5(d: any): Record<string, unknown> {
    const cna = d?.containers?.cna ?? {};
    const desc = (cna.descriptions ?? []).find((de: any) =>
      (de.lang || '').toLowerCase().startsWith('en'),
    )?.value;
    const scan = (metrics: any[]): number | null => {
      for (const m of metrics ?? []) {
        for (const k of ['cvssV4_0', 'cvssV3_1', 'cvssV3_0', 'cvssV2_0']) {
          const v = m[k];
          if (v && typeof v === 'object' && v.baseScore != null) {
            const n = Number(v.baseScore);
            if (!Number.isNaN(n)) return n;
          }
        }
      }
      return null;
    };
    let cvss = scan(cna.metrics);
    if (cvss == null) {
      for (const adp of d?.containers?.adp ?? []) {
        cvss = scan(adp.metrics);
        if (cvss != null) break;
      }
    }
    let cwe: string | null = null;
    for (const pt of cna.problemTypes ?? []) {
      for (const de of pt.descriptions ?? []) {
        if (de.cweId) {
          cwe = de.cweId;
          break;
        }
      }
      if (cwe) break;
    }
    const references = (cna.references ?? [])
      .map((r: any) => r.url)
      .filter(Boolean)
      .slice(0, 10);
    return { cvss, cwe, description: desc, references };
  }

  private async cveCircl(cve: string): Promise<Record<string, unknown> | null> {
    const { json } = await fetchJson<any>(`https://cve.circl.lu/api/cve/${cve}`, {
      timeoutMs: 15000,
    });
    if (!json || !('containers' in json)) return null;
    return this.parseCve5(json);
  }

  private async cveNvd(cve: string): Promise<Record<string, unknown> | null> {
    const { json } = await fetchJson<any>(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cve}`,
      { timeoutMs: 20000 },
    );
    const vulns = json?.vulnerabilities ?? [];
    if (!vulns.length) return null;
    const obj = vulns[0]?.cve ?? {};
    const desc = (obj.descriptions ?? []).find((x: any) => x.lang === 'en')?.value;
    const metrics = obj.metrics ?? {};
    let cvss: number | null = null;
    for (const mk of ['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']) {
      const arr = metrics[mk];
      if (arr?.length) {
        cvss = arr[0]?.cvssData?.baseScore ?? null;
        break;
      }
    }
    let cwe: string | null = null;
    for (const w of obj.weaknesses ?? []) {
      for (const de of w.description ?? []) {
        if ((de.value || '').startsWith('CWE')) {
          cwe = de.value;
          break;
        }
      }
      if (cwe) break;
    }
    const references = (obj.references ?? [])
      .map((r: any) => r.url)
      .filter(Boolean)
      .slice(0, 10);
    return { cvss, cwe, description: desc, references };
  }

  async cveLookup(cve: string): Promise<Record<string, unknown> | null> {
    cve = (cve || '').trim().toUpperCase();
    if (!/^CVE-\d{4}-\d+$/.test(cve)) return null;
    for (const fn of [
      () => this.cveCircl(cve),
      () => this.cveNvd(cve),
    ]) {
      try {
        const r = await fn();
        if (r) return r;
      } catch {
        /* tenta a próxima fonte */
      }
    }
    return null;
  }

  // ── ASN / geolocalização (BGPView + ipinfo) ─────────────────────────────────
  private async asnBgpview(ip: string): Promise<Record<string, unknown>> {
    const { json } = await fetchJson<any>(`https://api.bgpview.io/ip/${ip}`, {
      timeoutMs: 15000,
    });
    const data = json?.data ?? {};
    const pf = (data.prefixes ?? [{}])[0] ?? {};
    const asn = pf.asn ?? {};
    return {
      asn: asn.asn,
      org: asn.name || asn.description,
      prefix: pf.prefix,
      country: asn.country_code || data.rir_allocation?.country_code,
      city: null,
    };
  }

  private async asnIpinfo(ip: string): Promise<Record<string, unknown>> {
    const { json } = await fetchJson<any>(`https://ipinfo.io/${ip}/json`, {
      timeoutMs: 15000,
    });
    const org = json?.org ?? '';
    const m = /AS(\d+)\s+(.*)/.exec(org);
    return {
      asn: m ? parseInt(m[1], 10) : null,
      org: (m ? m[2] : org) || null,
      prefix: null,
      country: json?.country,
      city: json?.city,
    };
  }

  async ipAsn(ip: string): Promise<Record<string, unknown> | null> {
    for (const fn of [() => this.asnBgpview(ip), () => this.asnIpinfo(ip)]) {
      try {
        const r = await fn();
        if (r && (r.asn || r.org)) return r;
      } catch {
        /* próxima fonte */
      }
    }
    return null;
  }

  // ── WHOIS/RDAP + DNS ────────────────────────────────────────────────────────
  private rdapVcard(ent: any, field: string): string | null {
    const va = ent?.vcardArray;
    if (va && va.length > 1) {
      for (const item of va[1]) if (item && item[0] === field) return item[3];
    }
    return null;
  }

  private rdapRegistrar(d: any): string | null {
    const ent = this.rdapFindEntity(d?.entities ?? [], 'registrar');
    return ent ? this.rdapVcard(ent, 'fn') : null;
  }

  /** Busca recursiva (entidades podem aninhar, ex.: abuse dentro do registrar). */
  private rdapFindEntity(entities: any[], role: string): any | null {
    for (const ent of entities ?? []) {
      if ((ent.roles ?? []).includes(role)) return ent;
      const nested = this.rdapFindEntity(ent.entities ?? [], role);
      if (nested) return nested;
    }
    return null;
  }

  /**
   * Atribuição de domínio — pipeline WHOIS → resolução de IP → hosting (ipinfo).
   * Encadeia: registrador/registrante (RDAP) + DNS → IP do servidor → ASN/host/geo.
   */
  async domainAttribution(domain: string): Promise<Record<string, unknown>> {
    domain = (domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    const result: Record<string, any> = { domain, ip: null, dns: {}, whois: {}, hosting: {} };

    // 1. DNS — resolve IP e nameservers
    const resolver = new Resolver({ timeout: 6000, tries: 1 });
    const dns: Record<string, string[]> = {};
    for (const rt of ['A', 'AAAA', 'NS', 'MX'] as const) {
      try {
        const ans = await resolver.resolve(domain, rt);
        dns[rt] = (ans as any[])
          .map((r) => (rt === 'MX' ? `${r.priority} ${r.exchange}` : String(r)))
          .slice(0, 8);
      } catch {
        /* registro ausente */
      }
    }
    result.dns = dns;
    const ip = dns.A?.[0] ?? null;
    result.ip = ip;

    // 2. WHOIS/RDAP — registrador, registrante, e-mail de abuso, datas, NS
    try {
      const { json: d } = await fetchJson<any>(`https://rdap.org/domain/${domain}`, { timeoutMs: 10000 });
      if (d) {
        const ev: Record<string, string> = {};
        for (const e of d.events ?? []) if (e.eventAction) ev[e.eventAction] = (e.eventDate || '').slice(0, 10);
        const registrarEnt = this.rdapFindEntity(d.entities ?? [], 'registrar');
        const abuseEnt = this.rdapFindEntity(d.entities ?? [], 'abuse');
        const registrantEnt = this.rdapFindEntity(d.entities ?? [], 'registrant');
        result.whois = {
          registrar: this.rdapRegistrar(d),
          registrarId: registrarEnt?.publicIds?.[0]?.identifier ?? null,
          abuseEmail: abuseEnt ? this.rdapVcard(abuseEnt, 'email') : null,
          registrant: registrantEnt
            ? {
                name: this.rdapVcard(registrantEnt, 'fn'),
                org: this.rdapVcard(registrantEnt, 'org'),
                email: this.rdapVcard(registrantEnt, 'email'),
              }
            : null,
          created: ev.registration ?? null,
          expires: ev.expiration ?? null,
          updated: ev['last changed'] ?? null,
          status: d.status ?? [],
          nameservers: (d.nameservers ?? []).map((n: any) => (n.ldhName || '').toLowerCase()).filter(Boolean).slice(0, 8),
        };
      }
    } catch {
      /* RDAP indisponível */
    }
    // fallback: NS do DNS se RDAP não trouxe
    if (!(result.whois.nameservers?.length) && dns.NS?.length) {
      result.whois.nameservers = dns.NS.map((n) => n.toLowerCase());
    }

    // 3. Hosting — ipinfo.io (provedor, hostname, geolocalização)
    if (ip) {
      try {
        const { json } = await fetchJson<any>(`https://ipinfo.io/${ip}/json`, { timeoutMs: 12000 });
        if (json) {
          const org = json.org ?? '';
          const m = /AS(\d+)\s+(.*)/.exec(org);
          result.hosting = {
            ip,
            hostname: json.hostname ?? null,
            asn: m ? `AS${m[1]}` : null,
            org: (m ? m[2] : org) || null,
            city: json.city ?? null,
            region: json.region ?? null,
            country: json.country ?? null,
            loc: json.loc ?? null,
            postal: json.postal ?? null,
            timezone: json.timezone ?? null,
          };
        }
      } catch {
        /* ipinfo indisponível */
      }
    }

    return result;
  }

  async domainIntel(domain: string): Promise<Record<string, unknown>> {
    domain = (domain || '').trim().toLowerCase();
    const out: Record<string, unknown> = { dns: {} };
    const dns: Record<string, string[]> = {};
    const resolver = new Resolver({ timeout: 6000, tries: 1 });
    for (const rt of ['A', 'AAAA', 'NS', 'MX', 'TXT'] as const) {
      try {
        const ans = await resolver.resolve(domain, rt);
        dns[rt] = (ans as any[])
          .map((r) =>
            rt === 'MX'
              ? `${r.priority} ${r.exchange}`
              : Array.isArray(r)
                ? r.join('')
                : String(r),
          )
          .slice(0, 8);
      } catch {
        /* registro ausente */
      }
    }
    out.dns = dns;
    try {
      const { json: d } = await fetchJson<any>(
        `https://rdap.org/domain/${domain}`,
        { timeoutMs: 10000 },
      );
      if (d) {
        const ev: Record<string, string> = {};
        for (const e of d.events ?? []) {
          if (e.eventAction) ev[e.eventAction] = (e.eventDate || '').slice(0, 10);
        }
        out.registrar = this.rdapRegistrar(d);
        out.created = ev.registration;
        out.expires = ev.expiration;
        out.updated = ev['last changed'];
        out.status = d.status ?? [];
        out.nameservers = (d.nameservers ?? [])
          .map((n: any) => (n.ldhName || '').toLowerCase())
          .slice(0, 8);
      }
    } catch {
      /* RDAP indisponível */
    }
    return out;
  }

  // ── Wayback Machine ─────────────────────────────────────────────────────────
  async waybackUrls(domain: string): Promise<Array<Record<string, unknown>>> {
    try {
      const { json } = await fetchJson<any[]>(
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}/*&output=json&fl=original,timestamp,statuscode,mimetype&collapse=urlkey&limit=2000`,
        { timeoutMs: 30000 },
      );
      const rows = (json ?? []).slice(1); // pula o cabeçalho
      return rows
        .filter((r) => r && r.length)
        .map((r) => ({ url: r[0], status: r[2] ?? null, mime: r[3] ?? null }));
    } catch {
      return [];
    }
  }
}
