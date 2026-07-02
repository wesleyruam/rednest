import { Injectable } from '@nestjs/common';
import { fetchJson } from './http.util';
import { ProviderKeysService } from './provider-keys.service';

/**
 * Clientes de threat intelligence portados da v1 (app/services/threatintel.py).
 * Cada método retorna um objeto normalizado; { configured: false } se faltar
 * a chave; { error } em falha de rede.
 */
@Injectable()
export class ThreatIntelService {
  constructor(private readonly keys: ProviderKeysService) {}

  async abuseipdbIp(ip: string): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('abuseipdb');
    if (!key) return { provider: 'abuseipdb', configured: false };
    try {
      const { status, json } = await fetchJson<any>(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
        { headers: { Key: key } },
      );
      if (status !== 200) return { provider: 'abuseipdb', error: `HTTP ${status}` };
      const d = json?.data ?? {};
      return {
        provider: 'abuseipdb',
        configured: true,
        score: d.abuseConfidenceScore,
        reports: d.totalReports,
        country: d.countryCode,
        isp: d.isp,
        usage: d.usageType,
        domain: d.domain,
        tor: d.isTor,
        last_reported: d.lastReportedAt,
      };
    } catch (e) {
      return { provider: 'abuseipdb', error: String(e) };
    }
  }

  private async virustotal(path: string): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('virustotal');
    if (!key) return { provider: 'virustotal', configured: false };
    try {
      const { status, json } = await fetchJson<any>(
        `https://www.virustotal.com/api/v3/${path}`,
        { headers: { 'x-apikey': key } },
      );
      if (status === 404) return { provider: 'virustotal', configured: true, found: false };
      if (status !== 200) return { provider: 'virustotal', error: `HTTP ${status}` };
      const a = json?.data?.attributes ?? {};
      const stats = a.last_analysis_stats ?? {};
      return {
        provider: 'virustotal',
        configured: true,
        found: true,
        malicious: stats.malicious ?? 0,
        suspicious: stats.suspicious ?? 0,
        harmless: stats.harmless ?? 0,
        undetected: stats.undetected ?? 0,
        reputation: a.reputation,
        as_owner: a.as_owner,
        country: a.country,
        tags: (a.tags ?? []).slice(0, 8),
      };
    } catch (e) {
      return { provider: 'virustotal', error: String(e) };
    }
  }

  virustotalIp(ip: string) {
    return this.virustotal(`ip_addresses/${ip}`);
  }
  virustotalDomain(domain: string) {
    return this.virustotal(`domains/${domain}`);
  }

  private async otx(kind: string, value: string): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('otx');
    if (!key) return { provider: 'otx', configured: false };
    try {
      const { status, json } = await fetchJson<any>(
        `https://otx.alienvault.com/api/v1/indicators/${kind}/${value}/general`,
        { headers: { 'X-OTX-API-KEY': key } },
      );
      if (status !== 200) return { provider: 'otx', error: `HTTP ${status}` };
      const pi = json?.pulse_info ?? {};
      const pulses = pi.pulses ?? [];
      return {
        provider: 'otx',
        configured: true,
        pulses: pi.count ?? pulses.length,
        pulse_names: pulses.slice(0, 5).map((p: any) => p?.name).filter(Boolean),
        reputation: json?.reputation,
        asn: json?.asn,
        country: json?.country_name,
      };
    } catch (e) {
      return { provider: 'otx', error: String(e) };
    }
  }

  otxIp(ip: string) {
    return this.otx('IPv4', ip);
  }
  otxDomain(domain: string) {
    return this.otx('domain', domain);
  }

  async threatfoxSearch(ioc: string): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('threatfox');
    if (!key) return { provider: 'threatfox', configured: false };
    try {
      const { status, json } = await fetchJson<any>(
        'https://threatfox-api.abuse.ch/api/v1/',
        {
          method: 'POST',
          headers: { 'Auth-Key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'search_ioc', search_term: ioc }),
        },
      );
      if (status !== 200) return { provider: 'threatfox', error: `HTTP ${status}` };
      if (json?.query_status !== 'ok')
        return { provider: 'threatfox', configured: true, matches: [], n: 0 };
      const data: any[] = Array.isArray(json?.data) ? json.data : [];

      const host = (s: string): string => {
        s = (s || '').toLowerCase();
        if (s.includes('://')) s = s.split('://', 2)[1];
        s = s.split('/', 1)[0];
        return s.includes(':') ? s.split(':')[0] : s;
      };
      const term = (ioc || '').toLowerCase();
      const exact = data.filter(
        (d) =>
          ['domain', 'ip:port', 'ip'].includes((d.ioc_type || '').toLowerCase()) &&
          host(d.ioc || '') === term,
      ).length;
      const matches = data.slice(0, 8).map((d) => ({
        ioc: d.ioc,
        malware: d.malware_printable || d.malware,
        threat_type: d.threat_type,
        confidence: d.confidence_level,
        first_seen: d.first_seen,
      }));
      return {
        provider: 'threatfox',
        configured: true,
        matches,
        n: data.length,
        exact,
      };
    } catch (e) {
      return { provider: 'threatfox', error: String(e) };
    }
  }

  async censysHost(ip: string): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('censys');
    if (!key) return { provider: 'censys', configured: false };
    try {
      const { status, json } = await fetchJson<any>(
        `https://api.platform.censys.io/v3/global/asset/host/${ip}`,
        { headers: { Authorization: `Bearer ${key}` } },
      );
      if (status === 404) return { provider: 'censys', configured: true, found: false };
      if (status !== 200) return { provider: 'censys', error: `HTTP ${status}` };
      const res = json?.result?.resource ?? {};
      const asys = res.autonomous_system ?? {};
      const loc = res.location ?? {};
      const svcs: any[] = res.services ?? [];
      const services = svcs.map((s) => ({
        port: s.port,
        protocol: s.protocol || s.service_name,
        transport: s.transport_protocol,
      }));
      const org = res.whois?.organization ?? {};
      return {
        provider: 'censys',
        configured: true,
        found: true,
        asn: asys.asn,
        asn_name: asys.description || asys.name,
        bgp_prefix: asys.bgp_prefix,
        org: org.name,
        country: loc.country,
        city: loc.city,
        service_count: res.service_count ?? services.length,
        services,
      };
    } catch (e) {
      return { provider: 'censys', error: String(e) };
    }
  }

  /** Teste de chave contra um indicador benigno (8.8.8.8), como na v1. */
  async testProvider(service: string): Promise<Record<string, unknown>> {
    const probe = '8.8.8.8';
    const fn: Record<string, () => Promise<Record<string, unknown>>> = {
      abuseipdb: () => this.abuseipdbIp(probe),
      virustotal: () => this.virustotalIp(probe),
      otx: () => this.otxIp(probe),
      threatfox: () => this.threatfoxSearch(probe),
      censys: () => this.censysHost(probe),
    };
    if (!fn[service]) return { ok: false, error: 'serviço sem teste' };
    const res = await fn[service]();
    const ok = !('error' in res) && res.configured !== false;
    return { ok, result: res };
  }

  /** Veredito agregado (clean/suspicious/malicious) + score 0-100 — idêntico à v1. */
  private verdict(
    abuse: any,
    vt: any,
    otx: any,
    tfox: any,
  ): { verdict: string; score: number } {
    let score = 0;
    if (Number.isInteger(abuse?.score)) score = Math.max(score, abuse.score);
    const vtMal = vt?.malicious ?? 0;
    if (vtMal >= 3) score = Math.max(score, Math.min(100, 45 + vtMal * 6));
    else if (vtMal === 2) score = Math.max(score, 30);
    else if (vtMal === 1) score = Math.max(score, 12);
    if ((vt?.suspicious ?? 0) >= 2) score = Math.max(score, 25);
    if (tfox?.exact) score = Math.max(score, 90);
    else if (tfox?.n) score = Math.max(score, 15);
    const pulses = otx?.pulses ?? 0;
    if (pulses >= 2) score = Math.max(score, Math.min(35, 8 + pulses * 3));
    if (score >= 50) return { verdict: 'malicious', score };
    if (score >= 20) return { verdict: 'suspicious', score };
    return { verdict: 'clean', score };
  }

  async enrichIp(ip: string): Promise<Record<string, unknown>> {
    const [abuseipdb, virustotal, otx, threatfox, censys] = await Promise.all([
      this.abuseipdbIp(ip),
      this.virustotalIp(ip),
      this.otxIp(ip),
      this.threatfoxSearch(ip),
      this.censysHost(ip),
    ]);
    const { verdict, score } = this.verdict(abuseipdb, virustotal, otx, threatfox);
    return { ip, verdict, score, abuseipdb, virustotal, otx, threatfox, censys };
  }

  async enrichDomain(domain: string): Promise<Record<string, unknown>> {
    const [virustotal, otx, threatfox] = await Promise.all([
      this.virustotalDomain(domain),
      this.otxDomain(domain),
      this.threatfoxSearch(domain),
    ]);
    const { verdict, score } = this.verdict({}, virustotal, otx, threatfox);
    return { domain, verdict, score, virustotal, otx, threatfox };
  }
}
