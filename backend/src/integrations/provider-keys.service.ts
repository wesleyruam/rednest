import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, maskKey } from './crypto.util';

/** Provedores suportados que exigem chave de API. */
export const PROVIDERS: Record<string, string> = {
  censys: 'Censys',
  abuseipdb: 'AbuseIPDB',
  virustotal: 'VirusTotal',
  otx: 'AlienVault OTX',
  threatfox: 'ThreatFox (abuse.ch)',
  hunter: 'Hunter.io',
  gravatar: 'Gravatar',
  leaklookup: 'Leak-Lookup',
  godaddy: 'GoDaddy (KEY:SECRET)',
  misp: 'MISP (URL|API_KEY)',
};

export interface ProviderStatus {
  service: string;
  label: string;
  configured: boolean;
  masked: string | null;
}

@Injectable()
export class ProviderKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return (
      this.config.get<string>('INTEGRATIONS_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      'rednest-default-integrations-secret'
    );
  }

  isKnown(service: string): boolean {
    return service in PROVIDERS;
  }

  /** Texto puro da chave (para chamar o provedor). null se ausente/erro. */
  async getKey(service: string): Promise<string | null> {
    // Variável de ambiente tem prioridade (REDNEST_<SERVICE>_KEY), como na v1.
    const envKey = process.env[`REDNEST_${service.toUpperCase()}_KEY`];
    if (envKey) return envKey.trim();

    const row = await this.prisma.providerKey.findUnique({ where: { service } });
    if (!row) return null;
    try {
      return decryptSecret(
        { encrypted: row.encrypted, iv: row.iv, tag: row.tag },
        this.secret,
      );
    } catch {
      return null;
    }
  }

  async setKey(service: string, value: string | null | undefined): Promise<void> {
    if (!value || !value.trim()) {
      await this.prisma.providerKey
        .delete({ where: { service } })
        .catch(() => undefined);
      return;
    }
    const enc = encryptSecret(value.trim(), this.secret);
    await this.prisma.providerKey.upsert({
      where: { service },
      update: enc,
      create: { service, ...enc },
    });
  }

  async statusOne(service: string): Promise<ProviderStatus> {
    const key = await this.getKey(service);
    return {
      service,
      label: PROVIDERS[service] ?? service,
      configured: !!key,
      masked: maskKey(key),
    };
  }

  async status(): Promise<ProviderStatus[]> {
    return Promise.all(Object.keys(PROVIDERS).map((s) => this.statusOne(s)));
  }
}
