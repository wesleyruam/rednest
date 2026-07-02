import { Injectable, Logger } from '@nestjs/common';
import { ProxyService } from '../proxy/proxy.service';
import { NvdService } from './nvd.service';
import { ThreatFeedsService } from './threat-feeds.service';

/**
 * WordPress Engine — scanner nativo (motor estilo WPScan, reimplementado em TS).
 * Coleta: detecção+versão do core, usuários, plugins/temas (passivo + brute por
 * wordlist), "interesting findings", config backups e dumps de DB. As versões
 * encontradas são correlacionadas com CVE via NVD + CISA KEV (engines internas).
 *
 * Sem chamar o binário do WPScan e sem a Vulnerability DB paga.
 */

// UA de navegador real — tokens como "WPScan"/"RedNest" são bloqueados por WAFs.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Regexes (extraídos do código real do WPScan) ────────────────────────────────
const RE_WP_MARKER = /wp-(?:content|includes)\//i;
const RE_META_GENERATOR = /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s+([0-9][0-9.]*)/i;
const RE_FEED_GENERATOR = /<generator>https?:\/\/wordpress\.[a-z]+\/\?v=([0-9][0-9.]*)/i;
const RE_README_VERSION = /[Vv]ersion\s+([0-9][0-9.]+)/;
// Captura cada referência a wp-content/{plugins|mu-plugins|themes}/{slug}... com o ?ver= do mesmo asset.
const RE_WP_ASSET = /wp-content\/(plugins|mu-plugins|themes)\/([a-z0-9][a-z0-9._-]*)[^"'\s>)]*/gi;
const RE_ASSET_VER = /[?&]ver=([0-9a-z][0-9a-z._-]*)/i;
const RE_README_TXT_VERSION = /\b(?:stable tag|version):\s*(?!trunk)([0-9a-z.-]+)/i;
const RE_AUTHOR_PATH = /\/author\/([^/?#"'\s]+)/i;
const RE_BODY_AUTHOR_CLASS = /<body[^>]*\bclass="[^"]*\bauthor-([a-z0-9_-]+)/i;
const RE_PINGBACK_LINK = /<link[^>]+rel=["']pingback["'][^>]+href=["']([^"']+)["']/i;
const RE_DB_NAME = /DB_NAME/;
const RE_SQL_DUMP = /(?:DROP|(?:UN)?LOCK|CREATE|ALTER) (?:TABLE|DATABASE)|INSERT INTO/i;
const RE_DIR_LISTING = /<title>Index of|Directory listing for/i;
const RE_FPD = /(?:Fatal error|<b>Fatal error<\/b>)[^]*?in\s+(\/[^\s<:]+\.php)/i;

// ── Wordlists embutidas (curadas dos tops do WPScan) ────────────────────────────
const CONFIG_BACKUPS = [
  'wp-config.php~', 'wp-config.php.bak', 'wp-config.php.old', 'wp-config.php.save',
  'wp-config.php.swp', 'wp-config.php.swo', '.wp-config.php.swp', 'wp-config.php.orig',
  'wp-config.php.original', 'wp-config.php.txt', 'wp-config.php.inc', 'wp-config.php.dist',
  'wp-config.php_orig', 'wp-config.php.1', 'wp-config.php.2', 'wp-config.bak', 'wp-config.old',
  'wp-config.txt', 'wp-config.inc', 'wp-config.orig', 'wp-config.save', '#wp-config.php#',
  'wp-config.php-backup', 'wp-config.copy.php', 'wp-config-backup.txt', 'wp-config.php.zip',
  'wp-config.zip', 'wp-config.php.tar', 'wp-config.php.tar.gz', 'wp-config.php.bak.txt',
];

const DB_EXPORTS_STATIC = [
  'dump.sql', 'database.sql', 'backup.sql', 'wordpress.sql', 'wp.sql', 'mysql.sql', 'db.sql',
  'data.sql', 'db_backup.sql', 'sql.sql', 'localhost.sql', 'site.sql', 'backup/db.sql',
  'backup.sql.gz', 'database.sql.gz', 'dump.sql.zip', 'backup.zip', 'db.zip', 'sql/backup.sql',
];

const POPULAR_PLUGINS = [
  'akismet', 'contact-form-7', 'wordpress-seo', 'elementor', 'woocommerce', 'jetpack',
  'wpforms-lite', 'classic-editor', 'wordfence', 'all-in-one-seo-pack', 'updraftplus',
  'really-simple-ssl', 'wp-super-cache', 'w3-total-cache', 'litespeed-cache', 'wp-rocket',
  'duplicate-post', 'redirection', 'mailchimp-for-wp', 'google-site-kit', 'tablepress',
  'wp-mail-smtp', 'autoptimize', 'wpforms', 'ninja-forms', 'gravityforms', 'wp-fastest-cache',
  'sucuri-scanner', 'all-in-one-wp-migration', 'duplicator', 'loginizer', 'wps-hide-login',
  'limit-login-attempts-reloaded', 'health-check', 'query-monitor', 'advanced-custom-fields',
  'wp-optimize', 'smush', 'imagify', 'shortpixel-image-optimiser', 'ewww-image-optimizer',
  'wpml', 'polylang', 'translatepress-multilingual', 'cookie-law-info', 'gdpr-cookie-consent',
  'complianz-gdpr', 'wp-sitemap-page', 'broken-link-checker', 'better-wp-security', 'ithemes-security',
  'seo-by-rank-math', 'wp-statistics', 'wp-google-maps', 'wp-pagenavi', 'disable-comments',
  'classic-widgets', 'wordpress-importer', 'regenerate-thumbnails', 'enable-media-replace',
  'custom-post-type-ui', 'wp-user-avatar', 'simple-tags', 'wp-crontrol', 'code-snippets',
  'insert-headers-and-footers', 'header-footer-elementor', 'elementskit-lite', 'essential-addons-for-elementor-lite',
  'woocommerce-gateway-stripe', 'woocommerce-paypal-payments', 'mailpoet', 'newsletter',
  'popup-maker', 'wp-store-locator', 'the-events-calendar', 'event-tickets', 'bbpress', 'buddypress',
  'wpdiscuz', 'disqus-comment-system', 'amp', 'pwa', 'wp-rest-api', 'wp-graphql', 'advanced-cron-manager',
  'really-simple-captcha', 'recaptcha', 'google-captcha', 'antispam-bee', 'wp-spamshield',
  'cf7-redirect', 'flamingo', 'contact-form-cfdb7', 'forminator', 'caldera-forms', 'happyforms',
  'wp-smtp', 'easy-wp-smtp', 'post-smtp', 'fluent-smtp', 'simple-history', 'activity-log',
  'user-role-editor', 'members', 'profile-builder', 'ultimate-member', 'paid-memberships-pro',
  'restrict-content', 'woocommerce-subscriptions', 'wpforms-form-templates-pack', 'elementor-pro',
  'js-composer', 'revslider', 'layerslider', 'slider-revolution', 'master-slider', 'soliloquy-lite',
  'metaslider', 'smart-slider-3', 'yith-woocommerce-wishlist', 'woo-variation-swatches',
  'wp-fastest-cache-premium', 'hummingbird-performance', 'nitropack', 'perfmatters', 'asset-cleanup',
];

const POPULAR_THEMES = [
  'twentyten', 'twentyeleven', 'twentytwelve', 'twentythirteen', 'twentyfourteen', 'twentyfifteen',
  'twentysixteen', 'twentyseventeen', 'twentynineteen', 'twentytwenty', 'twentytwentyone',
  'twentytwentytwo', 'twentytwentythree', 'twentytwentyfour', 'astra', 'oceanwp', 'generatepress',
  'hello-elementor', 'kadence', 'neve', 'storefront', 'divi', 'avada', 'flatsome', 'enfold',
  'betheme', 'the7', 'bridge', 'salient', 'jupiter', 'x', 'porto', 'woodmart', 'sydney',
  'colormag', 'newspaper', 'soledad', 'hueman', 'customizr', 'zerif-lite', 'hestia', 'sparkling',
  'spacious', 'shapely', 'virtue', 'mesmerize', 'go', 'blocksy', 'phlox', 'popularfx',
];

// Namespaces REST registrados → slug do plugin (descoberta passiva via /wp-json/).
const NS_TO_PLUGIN: Record<string, string> = {
  'contact-form-7': 'contact-form-7', 'akismet': 'akismet', 'jetpack': 'jetpack',
  'wordfence': 'wordfence', 'yoast': 'wordpress-seo', 'rankmath': 'seo-by-rank-math',
  'elementor': 'elementor', 'wc': 'woocommerce', 'wc-analytics': 'woocommerce',
  'wc-admin': 'woocommerce', 'wc-blocks': 'woocommerce', 'woocommerce': 'woocommerce',
  'gf': 'gravityforms', 'gravityforms': 'gravityforms', 'ninja-forms': 'ninja-forms',
  'wpforms': 'wpforms-lite', 'mailpoet': 'mailpoet', 'litespeed': 'litespeed-cache',
  'wp-rocket': 'wp-rocket', 'updraftplus': 'updraftplus', 'pods': 'pods',
  'wpml': 'sitepress-multilingual-cms', 'pll': 'polylang', 'polylang': 'polylang',
  'redirection': 'redirection', 'wp-statistics': 'wp-statistics', 'duplicator': 'duplicator',
  'wpcf7-recaptcha': 'contact-form-7', 'oembed': '', 'wp': '', 'wp-site-health': '',
  'wp-block-editor': '', 'batch': '', 'wp/v2': '',
};
// Namespaces do core a ignorar na heurística genérica.
const CORE_NS = new Set(['wp', 'wp/v2', 'oembed', 'wp-site-health', 'wp-block-editor', 'batch', 'wp-json']);

export interface WpUser { id?: number | null; login: string | null; displayName?: string | null; source: string }
export interface WpItem { slug: string; version: string | null; source: string; url?: string }
export interface WpFindingEntry { type: string; url: string; description: string; severity?: string }
export interface WpVuln { product: string; version: string | null; cve: string; source: string; severity?: string; score?: number | null }

export interface WpScanResult {
  target: string;
  baseUrl: string | null;
  isWordPress: boolean;
  confidence: number;
  version: { number: string | null; confidence: number; source: string | null } | null;
  users: WpUser[];
  plugins: WpItem[];
  themes: WpItem[];
  interesting: WpFindingEntry[];
  configBackups: { url: string }[];
  dbExports: { url: string }[];
  vulns: WpVuln[];
  error?: string;
}

export interface WpScanProgress { phase: string; status?: string; done?: number; total?: number; label?: string }
export interface WpScanOptions {
  aggressive?: boolean;
  proxy?: boolean;
  onProgress?: (p: WpScanProgress) => void;
  onPartial?: (patch: Partial<WpScanResult>) => void;
  signal?: { cancelled: boolean };
}

interface Resp { status: number; body: string; headers: Record<string, string>; finalUrl: string; contentType: string }

@Injectable()
export class WpscanService {
  private readonly logger = new Logger(WpscanService.name);
  private proxyMode = false; // roteia GETs do scan corrente por proxy rotativo
  constructor(
    private readonly nvd: NvdService,
    private readonly feeds: ThreatFeedsService,
    private readonly proxy: ProxyService,
  ) {}

  private normalize(target: string): string {
    const t = (target || '').trim().replace(/\/+$/, '');
    return /^https?:\/\//.test(t) ? t : `https://${t}`;
  }

  private async req(url: string, opts: { method?: string; body?: string; timeoutMs?: number } = {}): Promise<Resp | null> {
    // modo proxy: roteia GETs por proxy rotativo (com fallback direto). POSTs vão diretos.
    if (this.proxyMode && (opts.method ?? 'GET') === 'GET') {
      try {
        const { result } = await this.proxy.fetchThrough(url, { tries: 2, timeoutMs: opts.timeoutMs ?? 12000, maxBytes: 2_000_000, fallbackDirect: true });
        return { status: result.status, body: result.body, headers: result.headers, finalUrl: result.finalUrl, contentType: result.headers['content-type'] ?? '' };
      } catch {
        return null;
      }
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12000);
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: '*/*', ...(opts.body ? { 'Content-Type': 'text/xml' } : {}) },
        body: opts.body,
      });
      const ct = res.headers.get('content-type') ?? '';
      // corpos potencialmente enormes (dumps): lê só o suficiente p/ confirmar
      const body = await res.text().catch(() => '');
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      return { status: res.status, body, headers, finalUrl: res.url || url, contentType: ct };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let idx = 0;
    const worker = async () => {
      for (;;) {
        const i = idx++;
        if (i >= items.length) return;
        await fn(items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  }

  async scan(target: string, opts: WpScanOptions = {}): Promise<WpScanResult> {
    this.proxyMode = !!opts.proxy;
    const base = this.normalize(target);
    const host = base.replace(/^https?:\/\//, '').split('/')[0];
    const prog = (p: WpScanProgress) => opts.onProgress?.(p);
    const cancelled = () => !!opts.signal?.cancelled;

    const result: WpScanResult = {
      target, baseUrl: base, isWordPress: false, confidence: 0, version: null,
      users: [], plugins: [], themes: [], interesting: [], configBackups: [], dbExports: [], vulns: [],
    };
    const u = (path: string) => `${base}/${path.replace(/^\/+/, '')}`;
    const rget = this.makeRestGetter(base);

    // ── 1. Detecção + versão do core ──────────────────────────────────────────────
    prog({ phase: 'detect', status: 'running' });
    const home = await this.req(base);
    if (!home) {
      result.error = 'Alvo inacessível.';
      return result;
    }
    const homeBody = home.body;
    if (RE_WP_MARKER.test(homeBody) || home.headers['x-pingback'] || /wordpress/i.test(home.headers['link'] ?? '')) {
      result.isWordPress = true;
      result.confidence = 80;
    }
    // versão: meta generator → feed → readme.html
    let version: string | null = null;
    let versionSource: string | null = null;
    const mGen = RE_META_GENERATOR.exec(homeBody);
    if (mGen) { version = mGen[1]; versionSource = 'meta generator'; result.isWordPress = true; result.confidence = 100; }
    if (!version) {
      const feed = await this.req(u('feed/'));
      const mFeed = feed && RE_FEED_GENERATOR.exec(feed.body);
      if (mFeed) { version = mFeed[1]; versionSource = 'rss generator'; result.isWordPress = true; result.confidence = 100; }
    }
    if (!version) {
      const readme = await this.req(u('readme.html'));
      if (readme && readme.status === 200 && /wordpress/i.test(readme.body)) {
        const mR = RE_README_VERSION.exec(readme.body);
        if (mR) { version = mR[1]; versionSource = 'readme.html'; }
        result.isWordPress = true;
        result.confidence = Math.max(result.confidence, 90);
      }
    }
    if (version) result.version = { number: version, confidence: 100, source: versionSource };

    // REST API (com fallback ?rest_route=): sinal forte de WP + revela plugins por namespace
    const restRoot = await rget('', '');
    if (restRoot?.json) {
      result.isWordPress = true;
      result.confidence = Math.max(result.confidence, 95);
      if (Array.isArray(restRoot.json.namespaces)) this.pluginsFromNamespaces(restRoot.json.namespaces, result.plugins);
      result.interesting.push({ type: 'rest_api', url: u('wp-json/'), description: 'REST API acessível (enumeração de usuários/conteúdo)', severity: 'low' });
    }

    prog({ phase: 'detect', status: 'done', label: result.isWordPress ? `WordPress${version ? ' ' + version : ''}` : 'não é WordPress' });
    opts.onPartial?.({ isWordPress: result.isWordPress, version: result.version, confidence: result.confidence });

    if (!result.isWordPress) return result;
    if (cancelled()) return result;

    // ── 2. Usuários ───────────────────────────────────────────────────────────────
    prog({ phase: 'users', status: 'running' });
    await this.enumerateUsers(base, rget, result, opts.aggressive !== false);
    prog({ phase: 'users', status: 'done', total: result.users.length });
    opts.onPartial?.({ users: result.users });
    if (cancelled()) return result;

    // ── 3. Plugins (passivo + brute) ────────────────────────────────────────────────
    prog({ phase: 'plugins', status: 'running' });
    this.passiveAssets(homeBody, result); // extrai plugins E temas do HTML (com ?ver=)
    if (opts.aggressive !== false) {
      let done = 0;
      await this.pool(POPULAR_PLUGINS, 20, async (slug) => {
        if (cancelled()) return;
        if (!result.plugins.find((p) => p.slug === slug)) {
          const r = await this.req(`${base}/wp-content/plugins/${slug}/`);
          if (r && [200, 401, 403, 500].includes(r.status)) result.plugins.push({ slug, version: null, source: 'known location', url: `${base}/wp-content/plugins/${slug}/` });
        }
        done++;
        if (done % 15 === 0) prog({ phase: 'plugins', status: 'running', done, total: POPULAR_PLUGINS.length });
      });
    }
    await this.resolveVersions(base, 'plugins', result.plugins);
    prog({ phase: 'plugins', status: 'done', total: result.plugins.length });
    opts.onPartial?.({ plugins: result.plugins });
    if (cancelled()) return result;

    // ── 4. Temas (passivo já feito acima + brute) ────────────────────────────────────
    prog({ phase: 'themes', status: 'running' });
    if (opts.aggressive !== false) {
      let done = 0;
      await this.pool(POPULAR_THEMES, 20, async (slug) => {
        if (cancelled()) return;
        if (!result.themes.find((t) => t.slug === slug)) {
          const r = await this.req(`${base}/wp-content/themes/${slug}/`);
          if (r && [200, 401, 403, 500].includes(r.status)) result.themes.push({ slug, version: null, source: 'known location', url: `${base}/wp-content/themes/${slug}/` });
        }
        done++;
        if (done % 15 === 0) prog({ phase: 'themes', status: 'running', done, total: POPULAR_THEMES.length });
      });
    }
    await this.resolveVersions(base, 'themes', result.themes);
    prog({ phase: 'themes', status: 'done', total: result.themes.length });
    opts.onPartial?.({ themes: result.themes });
    if (cancelled()) return result;

    // ── 5. Interesting findings ──────────────────────────────────────────────────────
    prog({ phase: 'interesting', status: 'running' });
    await this.interestingFindings(base, u, home, result);
    prog({ phase: 'interesting', status: 'done', total: result.interesting.length });
    opts.onPartial?.({ interesting: result.interesting });
    if (cancelled()) return result;

    // ── 6. Config backups + DB exports (brute por wordlist) ──────────────────────────
    if (opts.aggressive !== false) {
      prog({ phase: 'leaks', status: 'running' });
      await this.pool(CONFIG_BACKUPS, 15, async (name) => {
        if (cancelled()) return;
        const url = u(name);
        const r = await this.req(url);
        if (r && r.status === 200 && RE_DB_NAME.test(r.body)) result.configBackups.push({ url });
      });
      const dbList = [...DB_EXPORTS_STATIC, `${host}.sql`, `${host.replace(/\..*$/, '')}.sql`, `${host}.sql.gz`];
      await this.pool([...new Set(dbList)], 15, async (name) => {
        if (cancelled()) return;
        const url = u(name);
        const r = await this.req(url);
        if (!r || r.status !== 200) return;
        const isZip = /\.(zip|gz)$/i.test(name) ? /application\/(zip|gzip|x-gzip)/i.test(r.contentType) : RE_SQL_DUMP.test(r.body);
        if (isZip) result.dbExports.push({ url });
      });
      prog({ phase: 'leaks', status: 'done', total: result.configBackups.length + result.dbExports.length });
      opts.onPartial?.({ configBackups: result.configBackups, dbExports: result.dbExports });
      if (cancelled()) return result;
    }

    // ── 7. Correlação de CVE (NVD + KEV) ─────────────────────────────────────────────
    prog({ phase: 'vuln', status: 'running' });
    await this.correlateVulns(result);
    prog({ phase: 'vuln', status: 'done', total: result.vulns.length });
    opts.onPartial?.({ vulns: result.vulns });

    return result;
  }

  // ── helpers de coleta ──────────────────────────────────────────────────────────
  /**
   * Extração passiva do HTML: varre todos os assets href/src/url() que apontam para
   * wp-content/{plugins|mu-plugins|themes}/{slug} e pega a versão do ?ver= do mesmo
   * asset (técnica do HackTricks). Preenche plugins e temas com versão quando houver.
   */
  private passiveAssets(body: string, result: WpScanResult): void {
    RE_WP_ASSET.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_WP_ASSET.exec(body))) {
      const kind = m[1].toLowerCase() === 'themes' ? 'themes' : 'plugins';
      const slug = m[2].toLowerCase();
      if (slug.length < 2) continue;
      const verMatch = RE_ASSET_VER.exec(m[0]);
      let ver = verMatch ? verMatch[1] : null;
      // descarta cache-busters (hash hex longo / sem dígito) — não é versão real
      if (ver && (/^[a-f0-9]{8,}$/i.test(ver) || !/[0-9]/.test(ver))) ver = null;
      const into = kind === 'themes' ? result.themes : result.plugins;
      const ex = into.find((i) => i.slug === slug);
      if (ex) { if (!ex.version && ver) ex.version = ver; }
      else into.push({ slug, version: ver, source: 'passive (HTML)' });
    }
  }

  private async resolveVersions(base: string, kind: 'plugins' | 'themes', items: WpItem[]): Promise<void> {
    await this.pool(items.filter((i) => !i.version), 15, async (item) => {
      const r = await this.req(`${base}/wp-content/${kind}/${item.slug}/readme.txt`);
      if (r && r.status === 200) {
        const m = RE_README_TXT_VERSION.exec(r.body);
        if (m) item.version = m[1];
      }
      if (!item.version && kind === 'themes') {
        const s = await this.req(`${base}/wp-content/themes/${item.slug}/style.css`);
        const m = s && /Version:\s*([0-9a-z.-]+)/i.exec(s.body);
        if (m) item.version = m[1];
      }
    });
  }

  /**
   * Getter da REST API com fallback: tenta `/wp-json{route}` e, se falhar
   * (permalinks "plain"), cai para `/?rest_route={route}`. Lembra o modo que
   * funcionou. Retorna o JSON parseado + headers, ou null.
   */
  private restUrls(base: string, route: string, query: string): string[] {
    return [
      `${base}/wp-json${route}${query ? `?${query}` : ''}`,
      `${base}/?rest_route=${route || '/'}${query ? `&${query}` : ''}`,
    ];
  }

  private makeRestGetter(base: string) {
    // tenta SEMPRE os dois estilos (WAFs às vezes bloqueiam só /wp-json/...); 1º JSON válido vence
    return async (route: string, query = ''): Promise<{ json: any; headers: Record<string, string> } | null> => {
      for (const url of this.restUrls(base, route, query)) {
        const r = await this.req(url);
        if (r && r.status === 200 && /^\s*[[{]/.test(r.body)) {
          try { return { json: JSON.parse(r.body), headers: r.headers }; } catch { /* tenta próximo */ }
        }
      }
      return null;
    };
  }

  /** Descobre plugins ativos pelos namespaces registrados na REST API. */
  private pluginsFromNamespaces(namespaces: string[], into: WpItem[]): void {
    for (const ns of namespaces ?? []) {
      const prefix = String(ns).split('/')[0].toLowerCase();
      if (CORE_NS.has(prefix) || CORE_NS.has(ns)) continue;
      const slug = prefix in NS_TO_PLUGIN ? NS_TO_PLUGIN[prefix] : prefix;
      if (!slug) continue;
      if (!into.find((p) => p.slug === slug)) into.push({ slug, version: null, source: 'REST namespace' });
    }
  }

  private async enumerateUsers(base: string, rget: ReturnType<WpscanService['makeRestGetter']>, result: WpScanResult, aggressive: boolean): Promise<void> {
    const seen = new Set<string>();
    const add = (login: string | null, source: string, id?: number | null, displayName?: string | null) => {
      const key = (login || `id:${id}`).toLowerCase();
      if (!login && id == null) return;
      if (seen.has(key)) {
        if (displayName) { const ex = result.users.find((x) => (x.login || '').toLowerCase() === key); if (ex && !ex.displayName) ex.displayName = displayName; }
        return;
      }
      seen.add(key);
      result.users.push({ id: id ?? null, login, displayName: displayName ?? null, source });
    };

    // 2a. REST API: /wp/v2/users. Muitos WAFs (Hostinger/Imunify, etc.) bloqueiam
    // a URL com params (?per_page=&page=) com 403, mas a URL "limpa" passa (200).
    // Por isso testamos primeiro as variantes limpas e só depois paginamos.
    const parseUsers = async (url: string): Promise<{ arr: any[]; pages: number } | null> => {
      const r = await this.req(url);
      if (!r || r.status !== 200) return null;
      try {
        const arr = JSON.parse(r.body);
        if (!Array.isArray(arr)) return null;
        return { arr, pages: parseInt(r.headers['x-wp-totalpages'] ?? '1', 10) || 1 };
      } catch { return null; }
    };
    let maxPages = 1;
    let gotFirst = false;
    // página 1: limpa → com per_page (nos dois estilos), primeira que responder vence
    const firstVariants = [
      ...this.restUrls(base, '/wp/v2/users', ''),
      ...this.restUrls(base, '/wp/v2/users', 'per_page=100'),
    ];
    for (const url of firstVariants) {
      const res = await parseUsers(url);
      if (!res) continue;
      for (const x of res.arr) add(x.slug ?? null, 'REST API', x.id ?? null, x.name ?? null);
      maxPages = res.pages;
      gotFirst = true;
      break;
    }
    // páginas seguintes (se o site expôs mais de uma)
    for (let page = 2; gotFirst && page <= maxPages && page <= 10; page++) {
      for (const url of [...this.restUrls(base, '/wp/v2/users', `page=${page}`), ...this.restUrls(base, '/wp/v2/users', `per_page=100&page=${page}`)]) {
        const res = await parseUsers(url);
        if (!res) continue;
        for (const x of res.arr) add(x.slug ?? null, 'REST API', x.id ?? null, x.name ?? null);
        break;
      }
    }

    // 2b. oEmbed API (também revela autor)
    const oembed = await rget('/oembed/1.0/embed', `url=${encodeURIComponent(base)}&format=json`);
    if (oembed?.json?.author_name) {
      const slug = (oembed.json.author_url || '').match(RE_AUTHOR_PATH)?.[1] ?? null;
      add(slug, 'oEmbed API', null, oembed.json.author_name);
    }

    if (!aggressive) return;

    // 2c. Author ID brute forcing (?author=N)
    await this.pool([...Array(10).keys()].map((i) => i + 1), 5, async (id) => {
      const r = await this.req(`${base}/?author=${id}`);
      if (!r) return;
      let login = r.finalUrl.match(RE_AUTHOR_PATH)?.[1] ?? null;
      if (!login) login = r.body.match(RE_BODY_AUTHOR_CLASS)?.[1] ?? null;
      const display = r.body.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>\s*(?:<span[^>]*>)?\s*([^<]+?)\s*</i)?.[1] ?? null;
      if (login || display) add(login, 'author id brute force', id, display);
    });

    // 2d. Author sitemap (WP 5.5+)
    const sm = await this.req(`${base}/wp-sitemap-users-1.xml`);
    if (sm && sm.status === 200) {
      const re = RE_AUTHOR_PATH;
      let m: RegExpExecArray | null;
      const g = new RegExp(re.source, 'gi');
      while ((m = g.exec(sm.body))) add(m[1], 'author sitemap');
    }
  }

  private async interestingFindings(base: string, u: (p: string) => string, home: Resp, result: WpScanResult): Promise<void> {
    const push = (type: string, url: string, description: string, severity?: string) => result.interesting.push({ type, url, description, severity });

    // XML-RPC: confirma via system.listMethods e enumera métodos sensíveis (HackTricks)
    const pingHeader = home.headers['x-pingback'];
    const pingLink = RE_PINGBACK_LINK.exec(home.body)?.[1];
    const xr = await this.req(u('xmlrpc.php'), { method: 'POST', body: '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName><params></params></methodCall>' });
    if (xr && /<methodResponse>/i.test(xr.body)) {
      const methods = [...xr.body.matchAll(/<string>([^<]+)<\/string>/g)].map((x) => x[1]);
      const risky = ['pingback.ping', 'system.multicall', 'wp.getUsersBlogs'].filter((x) => methods.includes(x));
      const sev = methods.includes('pingback.ping') || methods.includes('system.multicall') ? 'high' : 'medium';
      const desc = risky.length
        ? `XML-RPC habilitado — métodos sensíveis: ${risky.join(', ')} (pingback=SSRF/DDoS, system.multicall+wp.getUsersBlogs=brute force amplificado)`
        : `XML-RPC habilitado (${methods.length} métodos)`;
      push('xmlrpc', u('xmlrpc.php'), desc, sev);
    } else if (pingHeader || pingLink) {
      push('xmlrpc', pingHeader || pingLink || u('xmlrpc.php'), 'XML-RPC habilitado (X-Pingback) — permite pingback/brute force', 'medium');
    }

    // readme.html
    const readme = await this.req(u('readme.html'));
    if (readme && readme.status === 200 && /wordpress/i.test(readme.body)) push('readme', u('readme.html'), 'readme.html acessível (expõe versão do WordPress)', 'low');

    // license.txt (confirma WordPress — HackTricks)
    const lic = await this.req(u('license.txt'));
    if (lic && lic.status === 200 && /wordpress/i.test(lic.body)) push('license', u('license.txt'), 'license.txt acessível (confirma WordPress)', 'low');

    // debug.log
    const dbg = await this.req(u('wp-content/debug.log'));
    if (dbg && dbg.status === 200 && dbg.body.length > 0 && /text|octet/i.test(dbg.contentType) && !RE_WP_MARKER.test(dbg.body.slice(0, 200))) {
      push('debug_log', u('wp-content/debug.log'), 'debug.log exposto — pode vazar caminhos, erros e dados', 'high');
    }

    // wp-cron
    const cron = await this.req(u('wp-cron.php'));
    if (cron && [200, 408].includes(cron.status)) push('wp_cron', u('wp-cron.php'), 'wp-cron.php acessível (possível abuso/DoS)', 'low');

    // registro aberto
    const reg = await this.req(u('wp-login.php?action=register'));
    if (reg && reg.status === 200 && /(registerform|user_login|reg_passmail|action=["']?register)/i.test(reg.body)) {
      push('registration', u('wp-login.php?action=register'), 'Registro de usuários habilitado', 'low');
    }

    // listagem do diretório de uploads
    const up = await this.req(u('wp-content/uploads/'));
    if (up && up.status === 200 && RE_DIR_LISTING.test(up.body)) push('upload_listing', u('wp-content/uploads/'), 'Listagem de diretório habilitada em wp-content/uploads/', 'medium');

    // robots.txt
    const robots = await this.req(u('robots.txt'));
    if (robots && robots.status === 200 && /wp-/i.test(robots.body)) push('robots', u('robots.txt'), 'robots.txt presente (revela paths)', 'low');

    // Full Path Disclosure
    const fpd = await this.req(u('wp-includes/rss-functions.php'));
    const fpdMatch = fpd && RE_FPD.exec(fpd.body);
    if (fpdMatch) push('fpd', u('wp-includes/rss-functions.php'), `Full Path Disclosure: ${fpdMatch[1]}`, 'medium');

    // headers interessantes
    const interestingHeaders = ['server', 'x-powered-by', 'x-redirect-by', 'x-generator'];
    const hdrs = interestingHeaders.filter((h) => home.headers[h]).map((h) => `${h}: ${home.headers[h]}`);
    if (hdrs.length) push('headers', base, `Headers: ${hdrs.join(' · ')}`, 'low');
  }

  private async correlateVulns(result: WpScanResult): Promise<void> {
    const targets: { product: string; version: string | null; keyword: string }[] = [];
    if (result.version?.number) targets.push({ product: 'WordPress core', version: result.version.number, keyword: `wordpress ${result.version.number}` });
    for (const p of result.plugins) targets.push({ product: `plugin: ${p.slug}`, version: p.version, keyword: p.version ? `${p.slug} ${p.version}` : p.slug });
    for (const t of result.themes) targets.push({ product: `theme: ${t.slug}`, version: t.version, keyword: t.version ? `${t.slug} ${t.version}` : t.slug });

    await this.pool(targets.slice(0, 30), 4, async (t) => {
      const [kev, nvd] = await Promise.all([
        this.feeds.matchProduct(t.keyword).catch(() => []),
        this.nvd.forProduct(t.keyword).catch(() => []),
      ]);
      const seen = new Set<string>();
      for (const k of (kev as any[])) {
        const cid = k.indicator ?? k.key;
        if (!cid || seen.has(cid)) continue;
        seen.add(cid);
        result.vulns.push({ product: t.product, version: t.version, cve: cid, source: 'KEV', severity: 'high' });
      }
      for (const c of (nvd as any[]).slice(0, 8)) {
        if (!c.cveId || seen.has(c.cveId)) continue;
        seen.add(c.cveId);
        result.vulns.push({ product: t.product, version: t.version, cve: c.cveId, source: 'NVD', severity: (c.cvssSeverity || '').toLowerCase() || undefined, score: c.cvssScore ?? null });
      }
    });
  }
}
