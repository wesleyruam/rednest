import { Injectable, Logger } from '@nestjs/common';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { ProxyService } from '../proxy/proxy.service';

/**
 * Screenshot Engine — captura de tela de serviços web via Chromium headless
 * (motor estilo EyeWitness). Retorna a imagem (base64) + metadados estruturados.
 * Suporta captura via proxy: se um proxy falhar, tenta o próximo do pool até
 * conseguir a captura completa (fallback para conexão direta no fim).
 */

export interface ShotResult {
  url: string;
  finalUrl?: string;
  title?: string;
  status?: number | null;
  ok: boolean;
  width?: number;
  height?: number;
  server?: string | null;
  screenshot?: string; // data:image/png;base64,...
  via?: string; // proxy usado (ou "direto")
  error?: string;
}

export interface CaptureOpts {
  fullPage?: boolean;
  timeoutMs?: number;
  proxy?: boolean; // rotear por proxy do pool
  maxTries?: number; // quantos proxies tentar
  fallbackDirect?: boolean; // se todos falharem, tenta direto (default true)
}

const LAUNCH_ARGS = [
  '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer',
  '--disable-gpu-compositing', '--disable-accelerated-2d-canvas', '--disable-extensions', '--mute-audio', '--no-zygote',
  '--disable-blink-features=AutomationControlled', // some o sinal de automação p/ anti-bots
];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Init script "stealth": remove marcas óbvias de navegador automatizado (navigator.webdriver etc.)
const STEALTH = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR','pt','en-US','en'] });
  Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
  window.chrome = window.chrome || { runtime: {} };
  const _q = window.navigator.permissions && window.navigator.permissions.query;
  if (_q) window.navigator.permissions.query = (p) => p && p.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission }) : _q(p);
`;
// Marcas de páginas de desafio anti-bot (Imunify360, Cloudflare, Sucuri, etc.), multilíngue.
const CHALLENGE_RE = new RegExp([
  // EN
  'being verified', 'checking your browser', 'just a moment', 'verifying you are human',
  'attention required', 'verify you are human', 'ddos protection', 'please wait while',
  // PT
  'sendo verificada', 'aguarde enquanto', 'um momento, por favor', 'verificando sua', 'estamos verificando',
  // ES
  'un momento', 'verificando tu solicitud', 'espere mientras', 'comprobando tu navegador',
  // marcas específicas de desafio (evita casar menções em rodapés de sites normais)
  'imunify', 'cf-browser-verification', 'ddos-guard', 'challenge-platform',
].join('|'), 'i');

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);
  private browser: Browser | null = null;

  constructor(private readonly proxy: ProxyService) {}

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    this.browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
    this.browser.on('disconnected', () => { this.browser = null; });
    return this.browser;
  }

  private normalize(target: string): string {
    const t = target.trim();
    return /^https?:\/\//.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
  }

  private ctxOpts() {
    return {
      ignoreHTTPSErrors: true,
      viewport: { width: 1366, height: 900 },
      userAgent: UA,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    };
  }

  private async newContext(browser: Browser): Promise<BrowserContext> {
    const ctx = await browser.newContext(this.ctxOpts());
    await ctx.addInitScript(STEALTH).catch(() => undefined);
    return ctx;
  }

  /** Espera desafios anti-bot JS (Imunify360/Cloudflare/…) se resolverem sozinhos. */
  private async settleChallenge(page: import('playwright').Page, budgetMs: number): Promise<boolean> {
    const deadline = Date.now() + budgetMs;
    let wasChallenge = false;
    while (Date.now() < deadline) {
      let clear = false;
      try {
        const title = await page.title().catch(() => '');
        const body = (await page.textContent('body', { timeout: 1500 }).catch(() => '')) ?? '';
        clear = !CHALLENGE_RE.test(`${title} | ${body.slice(0, 800)}`);
      } catch { clear = false; } // provavelmente navegando (o desafio recarrega)
      if (clear) return wasChallenge;
      wasChallenge = true;
      await page.waitForTimeout(1500);
      await page.waitForLoadState('domcontentloaded', { timeout: 3500 }).catch(() => undefined);
    }
    return wasChallenge;
  }

  /** Grava a tela a partir de um contexto já criado. requireResponse=true rejeita
   *  quando o proxy não conseguiu carregar a página (para tentar o próximo). */
  private async grab(context: BrowserContext, url: string, opts: CaptureOpts & { requireResponse?: boolean }): Promise<ShotResult> {
    const page = await context.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs ?? 25000 }).catch(() => null);
      if (opts.requireResponse && !resp) throw new Error('sem resposta pelo proxy');
      // deixa o navegador real resolver desafios anti-bot JS (Imunify360, Cloudflare…)
      const passedChallenge = await this.settleChallenge(page, 28000);
      await page.waitForTimeout(passedChallenge ? 2000 : 1000);
      const buf = await page.screenshot({ fullPage: !!opts.fullPage, type: 'png' });
      const title = await page.title().catch(() => undefined);
      const headers = resp?.headers() ?? {};
      return {
        url, finalUrl: page.url(), title, status: resp?.status() ?? null, ok: !!resp,
        width: 1366, height: 900, server: headers['server'] ?? null,
        screenshot: `data:image/png;base64,${buf.toString('base64')}`,
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async capture(target: string, opts: CaptureOpts = {}): Promise<ShotResult> {
    const url = this.normalize(target);
    if (opts.proxy) return this.captureViaProxy(url, opts);
    let context: BrowserContext | undefined;
    try {
      const browser = await this.getBrowser();
      context = await this.newContext(browser);
      return await this.grab(context, url, opts);
    } catch (e) {
      this.logger.warn(`screenshot ${url} falhou: ${String(e)}`);
      return { url, ok: false, error: String((e as Error)?.message ?? e) };
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  /** Tenta capturar roteando por proxies do pool, um a um, até dar certo. */
  private async captureViaProxy(url: string, opts: CaptureOpts): Promise<ShotResult> {
    const tries = opts.maxTries ?? 6;
    const proxies = await this.proxy.pickWorking({ count: tries });
    if (proxies.length === 0) {
      if (opts.fallbackDirect !== false) {
        const r = await this.capture(url, { ...opts, proxy: false });
        return { ...r, via: r.ok ? 'direto (pool vazio)' : undefined };
      }
      return { url, ok: false, error: 'Nenhum proxy vivo no pool. Valide o pool na aba Proxies.' };
    }
    let lastErr = '';
    for (const p of proxies) {
      const server = `${p.protocol}://${p.host}:${p.port}`;
      let browser: Browser | null = null;
      try {
        browser = await chromium.launch({ headless: true, proxy: { server }, args: LAUNCH_ARGS });
        const context = await this.newContext(browser);
        const res = await this.grab(context, url, { ...opts, requireResponse: true });
        if (res.ok && res.screenshot) {
          this.logger.log(`screenshot ${url} capturado via ${server}`);
          return { ...res, via: server };
        }
        lastErr = res.error ?? 'sem resposta';
      } catch (e) {
        lastErr = String((e as Error)?.message ?? e);
        this.logger.debug(`proxy ${server} falhou p/ ${url}: ${lastErr}`);
      } finally {
        await browser?.close().catch(() => undefined);
      }
    }
    // todos os proxies falharam
    if (opts.fallbackDirect !== false) {
      const r = await this.capture(url, { ...opts, proxy: false });
      if (r.ok) return { ...r, via: 'direto (proxies falharam)' };
    }
    return { url, ok: false, error: `Nenhum proxy conseguiu capturar (${proxies.length} tentado(s)). Último erro: ${lastErr}` };
  }

  /** Captura várias URLs em série (browser reutilizado, sem proxy). */
  async captureMany(targets: string[], onProgress?: (done: number, total: number) => void): Promise<ShotResult[]> {
    const out: ShotResult[] = [];
    const list = targets.slice(0, 30);
    for (let i = 0; i < list.length; i++) {
      out.push(await this.capture(list[i]));
      onProgress?.(i + 1, list.length);
    }
    return out;
  }
}
