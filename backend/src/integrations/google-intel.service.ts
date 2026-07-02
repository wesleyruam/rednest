import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderKeysService } from './provider-keys.service';

/**
 * Google Intelligence — usa o GHunt internamente (o usuário nunca vê "GHunt").
 * Auth: o analista cola o base64 do GHunt Companion (login via extensão Google).
 * Um helper Python (scripts/ghunt_auth.py) importa as funções do próprio GHunt e
 * gera o creds.m sem menu/PTY. O base64 fica cifrado em provider_keys('ghunt')
 * para reaplicar após restart do container.
 */

const CREDS_PATH = join(homedir(), '.malfrats', 'ghunt', 'creds.m');
const AUTH_SCRIPT = join(process.cwd(), 'scripts', 'ghunt_auth.py');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class GoogleIntelligenceService {
  private readonly logger = new Logger(GoogleIntelligenceService.name);
  constructor(private readonly keys: ProviderKeysService) {}

  private credsLoaded(): boolean {
    try {
      return existsSync(CREDS_PATH) && statSync(CREDS_PATH).size > 0;
    } catch {
      return false;
    }
  }

  async status(): Promise<{ connected: boolean; stored: boolean }> {
    const stored = !!(await this.keys.getKey('ghunt'));
    if (!this.credsLoaded() && stored) await this.ensureAuth();
    return { connected: this.credsLoaded(), stored };
  }

  /** Conecta a conta Google colando o base64 do Companion. */
  async connect(base64: string): Promise<{ connected: boolean; email?: string; name?: string; error?: string }> {
    const b64 = (base64 || '').trim();
    if (!b64) return { connected: false, error: 'base64 vazio' };

    const res = await this.runAuth(b64);
    if (!res.ok) return { connected: false, error: res.error ?? 'falha ao autenticar' };
    if (!this.credsLoaded()) return { connected: false, error: 'GHunt não gerou as credenciais.' };

    await this.keys.setKey('ghunt', b64); // persiste cifrado p/ reaplicar
    return { connected: true, email: res.email, name: res.name };
  }

  async disconnect(): Promise<void> {
    await this.keys.setKey('ghunt', null);
    try {
      rmSync(CREDS_PATH, { force: true });
    } catch {
      /* ignore */
    }
  }

  private async ensureAuth(): Promise<boolean> {
    if (this.credsLoaded()) return true;
    const b64 = await this.keys.getKey('ghunt');
    if (!b64) return false;
    await this.runAuth(b64).catch(() => undefined);
    return this.credsLoaded();
  }

  /** Roda o helper Python passando o base64 via stdin → {ok,email,name,error}. */
  private runAuth(base64: string): Promise<{ ok: boolean; email?: string; name?: string; error?: string }> {
    return new Promise((resolve) => {
      const child = execFile(
        'python3',
        [AUTH_SCRIPT],
        { timeout: 90_000, maxBuffer: 4 * 1024 * 1024, env: process.env },
        (err, stdout, stderr) => {
          const line = (stdout || '').trim().split('\n').filter(Boolean).pop() ?? '';
          try {
            return resolve(JSON.parse(line));
          } catch {
            this.logger.warn(`ghunt_auth saída inesperada: ${stderr || stdout || err}`);
            return resolve({ ok: false, error: 'falha no login (saída inesperada)' });
          }
        },
      );
      child.stdin?.end(base64);
    });
  }

  /** Inteligência de e-mail Google (perfil, gaia ID, serviços, etc.). */
  async email(email: string): Promise<Record<string, unknown>> {
    const target = (email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(target)) return { provider: 'google-intel', error: 'e-mail inválido' };
    if (!(await this.ensureAuth())) return { provider: 'google-intel', configured: false };

    const dir = mkdtempSync(join(tmpdir(), 'gi-'));
    const outFile = join(dir, 'out.json');
    return new Promise((resolve) => {
      execFile(
        'ghunt',
        ['email', target, '--json', outFile],
        { timeout: 90_000, maxBuffer: 8 * 1024 * 1024, env: process.env },
        (err) => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(readFileSync(outFile, 'utf8'));
          } catch {
            parsed = null;
          }
          try {
            rmSync(dir, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
          if (!parsed) {
            return resolve({ provider: 'google-intel', configured: true, email: target, found: false, error: err ? 'sem dados / conta inexistente' : undefined });
          }
          resolve({ provider: 'google-intel', configured: true, email: target, found: true, ...this.summarize(parsed), raw: parsed });
        },
      );
    });
  }

  /** Extrai campos comuns do JSON do GHunt (estrutura varia → defensivo). */
  private summarize(j: any): Record<string, unknown> {
    const profile = j?.PROFILE_CONTAINER?.profile ?? j?.profile ?? j;
    const name = profile?.names?.[0]?.fullname ?? profile?.name ?? null;
    const gaiaId = profile?.personId ?? profile?.gaiaID ?? j?.gaiaID ?? null;
    const photo = profile?.profilePhotos?.[0]?.url ?? profile?.profilePhoto?.url ?? null;
    const lastEdit = profile?.sourceIds?.[0]?.lastUpdated ?? null;
    const services = j?.services ? Object.keys(j.services) : profile?.googleServices ?? [];
    return { name, gaiaId, photo, lastEdit, services };
  }
}
