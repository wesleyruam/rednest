import { Injectable } from '@nestjs/common';
import { fetchJson } from './http.util';
import { ProviderKeysService } from './provider-keys.service';

const BASE = 'https://api.godaddy.com';

export const ABUSE_TYPES = [
  'A_RECORD', 'CHILD_ABUSE', 'CONTENT', 'FRAUD_WIRE', 'IP_BLOCK',
  'MALWARE', 'NETWORK_ABUSE', 'PHISHING', 'SPAM',
];

/** Denúncia de abuso via GoDaddy Abuse API. Chave armazenada como "KEY:SECRET". */
@Injectable()
export class GodaddyService {
  constructor(private readonly keys: ProviderKeysService) {}

  private async authHeader(): Promise<string | null> {
    const v = await this.keys.getKey('godaddy');
    return v ? `sso-key ${v}` : null;
  }

  async listTickets(): Promise<Record<string, unknown>> {
    const auth = await this.authHeader();
    if (!auth) return { provider: 'godaddy', configured: false };
    try {
      const { status, json } = await fetchJson<any>(`${BASE}/v1/abuse/tickets?limit=50`, {
        headers: { Authorization: auth },
      });
      if (status === 401) return { provider: 'godaddy', error: 'credenciais inválidas' };
      if (status === 403) return { provider: 'godaddy', error: 'conta sem acesso à API GoDaddy (ACCESS_DENIED) — habilite a Production API no painel da conta' };
      if (status !== 200) return { provider: 'godaddy', error: `HTTP ${status}` };
      return {
        provider: 'godaddy',
        configured: true,
        ticketIds: json?.ticketIds ?? [],
        total: json?.pagination?.total ?? (json?.ticketIds ?? []).length,
      };
    } catch (e) {
      return { provider: 'godaddy', error: String(e) };
    }
  }

  async createTicket(input: {
    type: string;
    source: string;
    target?: string;
    proxy?: string;
  }): Promise<Record<string, unknown>> {
    const auth = await this.authHeader();
    if (!auth) return { provider: 'godaddy', configured: false };
    if (!ABUSE_TYPES.includes(input.type)) return { provider: 'godaddy', error: 'tipo inválido' };
    try {
      const { status, json } = await fetchJson<any>(`${BASE}/v1/abuse/tickets`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: input.type,
          source: input.source,
          ...(input.target ? { target: input.target } : {}),
          ...(input.proxy ? { proxy: input.proxy } : {}),
        }),
      });
      if (status === 401) return { provider: 'godaddy', error: 'credenciais inválidas' };
      if (status === 403) return { provider: 'godaddy', error: 'conta sem acesso à API GoDaddy (ACCESS_DENIED) — habilite a Production API no painel da conta' };
      if (status >= 400) return { provider: 'godaddy', error: json?.message || `HTTP ${status}` };
      return { provider: 'godaddy', ok: true, ticketId: json?.ticketId, status };
    } catch (e) {
      return { provider: 'godaddy', error: String(e) };
    }
  }
}
