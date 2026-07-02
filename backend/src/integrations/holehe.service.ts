import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// remove códigos ANSI de cor da saída do holehe
const ANSI = /\[[0-9;]*m/g;

/**
 * Executa o holehe (CLI já instalado no container) para descobrir em quais
 * sites um e-mail está registrado. Parseia as linhas "[+] site".
 */
@Injectable()
export class HoleheService {
  private readonly logger = new Logger(HoleheService.name);

  async check(email: string): Promise<Record<string, unknown>> {
    email = (email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { provider: 'holehe', error: 'e-mail inválido' };

    return new Promise((resolve) => {
      execFile(
        'holehe',
        ['--only-used', email],
        { timeout: 90_000, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const out = (stdout || '').replace(ANSI, '');
          if (err && !out) {
            this.logger.warn(`holehe falhou: ${String(err)} ${stderr}`);
            return resolve({ provider: 'holehe', error: 'holehe indisponível ou tempo esgotado' });
          }
          const sites: string[] = [];
          for (const line of out.split('\n')) {
            const m = /\[\+\]\s*(\S+)/.exec(line);
            if (m) sites.push(m[1].trim());
          }
          resolve({ provider: 'holehe', email, used: sites.length, sites });
        },
      );
    });
  }
}
