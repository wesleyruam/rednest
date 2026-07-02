import { Injectable } from '@nestjs/common';
import { IOCThreatLevel, IOCType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fetchJson } from './http.util';
import { ProviderKeysService } from './provider-keys.service';

interface MispConfig {
  baseUrl: string;
  apiKey: string;
}

// IOC do RedNest → tipo/categoria MISP
const TO_MISP: Partial<Record<IOCType, { type: string; category: string }>> = {
  domain: { type: 'domain', category: 'Network activity' },
  ip: { type: 'ip-dst', category: 'Network activity' },
  email: { type: 'email-src', category: 'Payload delivery' },
  url: { type: 'url', category: 'Network activity' },
  hash_md5: { type: 'md5', category: 'Payload delivery' },
  hash_sha1: { type: 'sha1', category: 'Payload delivery' },
  hash_sha256: { type: 'sha256', category: 'Payload delivery' },
  cve: { type: 'vulnerability', category: 'External analysis' },
  phone: { type: 'phone-number', category: 'Other' },
  wallet: { type: 'btc', category: 'Financial fraud' },
  asn: { type: 'AS', category: 'Network activity' },
};

// tipo MISP → IOC do RedNest (pull)
const FROM_MISP: Record<string, IOCType> = {
  domain: 'domain', hostname: 'domain',
  'ip-src': 'ip', 'ip-dst': 'ip',
  email: 'email', 'email-src': 'email', 'email-dst': 'email',
  url: 'url', link: 'url',
  md5: 'hash_md5', sha1: 'hash_sha1', sha256: 'hash_sha256',
  vulnerability: 'cve',
  btc: 'wallet',
  AS: 'asn',
  'phone-number': 'phone',
};

const THREAT_TO_MISP: Record<IOCThreatLevel, string> = {
  critical: '1', high: '1', medium: '2', low: '3', informational: '4',
};

@Injectable()
export class MispService {
  constructor(
    private readonly keys: ProviderKeysService,
    private readonly prisma: PrismaService,
  ) {}

  private async config(): Promise<MispConfig | null> {
    const v = await this.keys.getKey('misp');
    if (!v) return null;
    const i = v.indexOf('|');
    if (i < 0) return null;
    const baseUrl = v.slice(0, i).trim().replace(/\/+$/, '');
    const apiKey = v.slice(i + 1).trim();
    if (!baseUrl || !apiKey) return null;
    return { baseUrl, apiKey };
  }

  private headers(cfg: MispConfig): Record<string, string> {
    return { Authorization: cfg.apiKey, Accept: 'application/json', 'Content-Type': 'application/json' };
  }

  async test(): Promise<Record<string, unknown>> {
    const cfg = await this.config();
    if (!cfg) return { provider: 'misp', configured: false };
    try {
      const { status, json } = await fetchJson<any>(`${cfg.baseUrl}/users/view/me`, {
        headers: this.headers(cfg), timeoutMs: 15000,
      });
      if (status === 403 || status === 401) return { provider: 'misp', error: 'API key inválida' };
      if (status !== 200) return { provider: 'misp', error: `HTTP ${status}` };
      return { provider: 'misp', configured: true, email: json?.User?.email, role: json?.Role?.name };
    } catch (e) {
      return { provider: 'misp', error: String(e) };
    }
  }

  /** Envia os IOCs de uma operação como um novo evento MISP. */
  async pushOperation(operationId: string): Promise<Record<string, unknown>> {
    const cfg = await this.config();
    if (!cfg) return { configured: false };
    const op = await this.prisma.operation.findFirst({ where: { id: operationId, deletedAt: null } });
    if (!op) return { error: 'operação não encontrada' };
    const iocs = await this.prisma.ioc.findMany({ where: { operationId, deletedAt: null } });

    const attributes = iocs
      .map((i) => {
        const m = TO_MISP[i.type];
        if (!m) return null;
        return { type: m.type, category: m.category, value: i.value, to_ids: true, comment: i.description || `RedNest · ${i.source}` };
      })
      .filter(Boolean);

    if (attributes.length === 0) return { error: 'nenhum IOC compatível para exportar' };

    const worst = iocs.reduce<IOCThreatLevel>((acc, i) => {
      const order: IOCThreatLevel[] = ['informational', 'low', 'medium', 'high', 'critical'];
      return order.indexOf(i.threatLevel) > order.indexOf(acc) ? i.threatLevel : acc;
    }, 'low');

    try {
      const { status, json } = await fetchJson<any>(`${cfg.baseUrl}/events/add`, {
        method: 'POST',
        headers: this.headers(cfg),
        timeoutMs: 30000,
        body: JSON.stringify({
          info: `RedNest — ${op.name}`,
          distribution: '0',
          analysis: '0',
          threat_level_id: THREAT_TO_MISP[worst],
          Attribute: attributes,
        }),
      });
      if (status >= 400) return { error: json?.message || json?.errors || `HTTP ${status}` };
      const ev = json?.Event ?? {};
      await this.prisma.timelineEvent.create({
        data: {
          type: 'note_added',
          title: `IOCs exportados para o MISP (${attributes.length})`,
          description: `Evento MISP #${ev.id ?? '?'} criado a partir de ${op.name}`,
          operationId, severity: 'informational',
        },
      }).catch(() => undefined);
      return { ok: true, eventId: ev.id, uuid: ev.uuid, exported: attributes.length, skipped: iocs.length - attributes.length };
    } catch (e) {
      return { error: String(e) };
    }
  }

  /** Importa atributos do MISP como IOCs em uma operação. */
  async pullToOperation(
    operationId: string,
    filters: { type?: string; value?: string; limit?: number },
  ): Promise<Record<string, unknown>> {
    const cfg = await this.config();
    if (!cfg) return { configured: false };
    const op = await this.prisma.operation.findFirst({ where: { id: operationId, deletedAt: null } });
    if (!op) return { error: 'operação não encontrada' };

    let attrs: any[] = [];
    try {
      const { status, json } = await fetchJson<any>(`${cfg.baseUrl}/attributes/restSearch`, {
        method: 'POST',
        headers: this.headers(cfg),
        timeoutMs: 30000,
        body: JSON.stringify({
          returnFormat: 'json',
          limit: filters.limit ?? 200,
          page: 1,
          ...(filters.type ? { type: filters.type } : {}),
          ...(filters.value ? { value: filters.value } : {}),
        }),
      });
      if (status >= 400) return { error: `HTTP ${status}` };
      attrs = json?.response?.Attribute ?? [];
    } catch (e) {
      return { error: String(e) };
    }

    const existing = new Set(
      (await this.prisma.ioc.findMany({ where: { operationId, deletedAt: null }, select: { value: true } })).map((x) => x.value),
    );

    let imported = 0;
    let skipped = 0;
    for (const a of attrs) {
      const type = FROM_MISP[a.type];
      if (!type || !a.value || existing.has(a.value)) { skipped++; continue; }
      existing.add(a.value);
      await this.prisma.ioc.create({
        data: {
          operationId,
          value: a.value,
          type,
          threatLevel: 'medium',
          source: 'MISP',
          description: a.comment || `MISP event #${a.event_id ?? ''}`,
          tags: ['misp'],
          enrichment: Prisma.JsonNull,
        },
      });
      imported++;
    }
    if (imported > 0) {
      await this.prisma.operation.update({ where: { id: operationId }, data: { iocCount: { increment: imported } } }).catch(() => undefined);
      await this.prisma.timelineEvent.create({
        data: {
          type: 'ioc_added',
          title: `IOCs importados do MISP (${imported})`,
          description: `Importação de atributos MISP para ${op.name}`,
          operationId, severity: 'medium',
        },
      }).catch(() => undefined);
    }
    return { ok: true, imported, skipped, fetched: attrs.length };
  }
}
