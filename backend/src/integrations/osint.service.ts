import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { fetchJson } from './http.util';
import { ProviderKeysService } from './provider-keys.service';

/**
 * Inteligência baseada em e-mail/domínio: Hunter.io, Gravatar, Leak-Lookup,
 * ProxyNova COMB (sem chave). Cada método retorna objeto normalizado;
 * { configured: false } quando falta a chave; { error } em falha de rede.
 */
@Injectable()
export class OsintService {
  constructor(private readonly keys: ProviderKeysService) {}

  // ── Hunter.io ───────────────────────────────────────────────────────────────
  async hunterDomain(domain: string): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('hunter');
    if (!key) return { provider: 'hunter', configured: false };
    try {
      const { status, json } = await fetchJson<any>(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${key}`,
      );
      if (status !== 200) return { provider: 'hunter', error: json?.errors?.[0]?.details || `HTTP ${status}` };
      const d = json?.data ?? {};
      return {
        provider: 'hunter',
        configured: true,
        domain: d.domain,
        organization: d.organization,
        pattern: d.pattern,
        total: d.emails?.length ?? 0,
        emails: (d.emails ?? []).map((e: any) => ({
          value: e.value,
          type: e.type,
          confidence: e.confidence,
          firstName: e.first_name,
          lastName: e.last_name,
          position: e.position,
          sources: (e.sources ?? []).length,
        })),
      };
    } catch (e) {
      return { provider: 'hunter', error: String(e) };
    }
  }

  async hunterEmail(email: string): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('hunter');
    if (!key) return { provider: 'hunter', configured: false };
    try {
      const { status, json } = await fetchJson<any>(
        `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${key}`,
      );
      if (status !== 200) return { provider: 'hunter', error: json?.errors?.[0]?.details || `HTTP ${status}` };
      const d = json?.data ?? {};
      return {
        provider: 'hunter',
        configured: true,
        result: d.result,
        score: d.score,
        deliverable: d.result === 'deliverable',
        disposable: d.disposable,
        webmail: d.webmail,
        mxRecords: d.mx_records,
        smtpCheck: d.smtp_check,
        sources: (d.sources ?? []).length,
      };
    } catch (e) {
      return { provider: 'hunter', error: String(e) };
    }
  }

  // ── Gravatar ────────────────────────────────────────────────────────────────
  async gravatar(email: string): Promise<Record<string, unknown>> {
    const value = await this.keys.getKey('gravatar');
    const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    // A chave pode vir como "id:gk-xxxx" — o bearer é a parte gk-...
    const token = value?.includes(':') ? value.split(':').pop() : value;
    try {
      const { status, json } = await fetchJson<any>(
        `https://api.gravatar.com/v3/profiles/${hash}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      );
      if (status === 404) return { provider: 'gravatar', found: false, hash };
      if (status !== 200) return { provider: 'gravatar', error: `HTTP ${status}`, hash };
      return {
        provider: 'gravatar',
        found: true,
        hash,
        displayName: json?.display_name,
        profileUrl: json?.profile_url,
        avatarUrl: json?.avatar_url,
        location: json?.location,
        jobTitle: json?.job_title,
        company: json?.company,
        pronunciation: json?.pronunciation,
        verifiedAccounts: (json?.verified_accounts ?? []).map((a: any) => ({
          service: a.service_label,
          url: a.url,
          username: a.service_icon ? undefined : a.url,
        })),
      };
    } catch (e) {
      return { provider: 'gravatar', error: String(e), hash };
    }
  }

  // ── Leak-Lookup ───────────────────────────────────────────────────────────────
  async leaklookup(query: string, type = 'email_address'): Promise<Record<string, unknown>> {
    const key = await this.keys.getKey('leaklookup');
    if (!key) return { provider: 'leaklookup', configured: false };
    try {
      const body = new URLSearchParams({ key, type, query }).toString();
      const { status, json } = await fetchJson<any>('https://leak-lookup.com/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        timeoutMs: 25000,
      });
      if (status !== 200) return { provider: 'leaklookup', error: `HTTP ${status}` };
      if (json?.error === 'true' || json?.error === true) {
        return { provider: 'leaklookup', configured: true, message: json?.message, sources: [], n: 0 };
      }
      const msg = json?.message ?? {};
      const sources = typeof msg === 'object'
        ? Object.entries(msg).map(([breach, rows]) => ({
            breach,
            count: Array.isArray(rows) ? rows.length : 0,
          }))
        : [];
      return {
        provider: 'leaklookup',
        configured: true,
        n: sources.length,
        sources,
      };
    } catch (e) {
      return { provider: 'leaklookup', error: String(e) };
    }
  }

  // ── ProxyNova COMB (sem chave) ────────────────────────────────────────────────
  async comb(query: string, limit = 100): Promise<Record<string, unknown>> {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { provider: 'comb', count: 0, records: [] };
    const hasAt = q.includes('@');
    try {
      // buscamos mais linhas do que exibimos p/ ter margem, pois a API retorna
      // muito ruído e o `count` dela é o total GLOBAL de matches (até 10000),
      // não a contagem deste alvo — por isso filtramos e recontamos localmente.
      const { status, json } = await fetchJson<any>(
        `https://api.proxynova.com/comb?query=${encodeURIComponent(query)}&start=0&limit=${limit}`,
        { timeoutMs: 20000 },
      );
      if (status !== 200) return { provider: 'comb', error: `HTTP ${status}` };
      const lines: string[] = json?.lines ?? [];
      const records: { email: string; passwordMasked: string }[] = [];
      for (const l of lines) {
        const i = l.indexOf(':'); // formato email:senha → split no PRIMEIRO ':'
        const rawEmail = (i >= 0 ? l.slice(0, i) : l).trim();
        const email = rawEmail.toLowerCase();
        if (!email.includes('@')) continue; // descarta lixo sem e-mail
        // só mantém quem casa com o alvo: e-mail completo, ou a parte antes do @ (username)
        const match = hasAt ? email === q : email.split('@')[0] === q;
        if (!match) continue;
        const pw = i >= 0 ? l.slice(i + 1) : '';
        const masked = pw.length === 0 ? '(sem senha)' : pw.length <= 2 ? '••' : pw.slice(0, 2) + '•'.repeat(Math.max(2, pw.length - 2));
        records.push({ email: rawEmail, passwordMasked: masked });
      }
      // count = quantidade REAL para este alvo (não o total global da API)
      return { provider: 'comb', count: records.length, records, globalMatches: json?.count ?? null };
    } catch (e) {
      return { provider: 'comb', error: String(e) };
    }
  }
}
