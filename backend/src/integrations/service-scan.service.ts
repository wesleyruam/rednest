import { Injectable } from '@nestjs/common';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import * as tls from 'node:tls';

/**
 * Service Scan — identifica serviços em um host e os transforma em OBJETOS
 * ESTRUTURADOS (não banners crus). Tudo nativo (node net/tls/https), sem nmap.
 */

const UA = 'RedNest/0.2';
const DEFAULT_PORTS = [80, 443, 22, 21, 25];
const PORT_PROTO: Record<number, string> = {
  80: 'http', 8080: 'http', 443: 'https', 8443: 'https', 22: 'ssh', 21: 'ftp', 25: 'smtp', 587: 'smtp',
};

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
];

export interface ServiceInfo {
  port: number;
  protocol: string;
  open: boolean;
  http?: Record<string, unknown>;
  tls?: Record<string, unknown>;
  ssh?: Record<string, unknown>;
  ftp?: Record<string, unknown>;
  smtp?: Record<string, unknown>;
}

export interface ServiceScanResult {
  host: string;
  scannedPorts: number[];
  services: ServiceInfo[];
}

@Injectable()
export class ServiceScanService {
  async scan(host: string, opts: { ports?: number[]; timeoutMs?: number } = {}): Promise<ServiceScanResult> {
    const cleanHost = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].trim();
    const ports = (opts.ports?.length ? opts.ports : DEFAULT_PORTS).slice(0, 20);
    const timeoutMs = opts.timeoutMs ?? 6000;

    const services = await Promise.all(ports.map((p) => this.probePort(cleanHost, p, timeoutMs)));
    return {
      host: cleanHost,
      scannedPorts: ports,
      services: services.filter((s): s is ServiceInfo => s !== null),
    };
  }

  private async probePort(host: string, port: number, timeoutMs: number): Promise<ServiceInfo | null> {
    const proto = PORT_PROTO[port] ?? 'unknown';
    try {
      switch (proto) {
        case 'http': {
          const info = await this.probeHttp(host, port, false, timeoutMs);
          return info ? { port, protocol: 'http', open: true, ...info } : null;
        }
        case 'https': {
          const [info, tlsInfo] = await Promise.all([
            this.probeHttp(host, port, true, timeoutMs),
            this.probeTls(host, port, timeoutMs),
          ]);
          if (!info && !tlsInfo) return null;
          const merged: any = info ?? { http: null };
          if (tlsInfo) {
            merged.tls = tlsInfo;
            if (merged.http) merged.http.tls = tlsInfo;
          }
          return { port, protocol: 'https', open: true, ...merged };
        }
        case 'ssh': {
          const ssh = await this.probeSsh(host, port, timeoutMs);
          return ssh ? { port, protocol: 'ssh', open: true, ssh } : null;
        }
        case 'ftp': {
          const ftp = await this.probeBanner(host, port, timeoutMs);
          return ftp ? { port, protocol: 'ftp', open: true, ftp: this.parseFtp(ftp) } : null;
        }
        case 'smtp': {
          const smtp = await this.probeBanner(host, port, timeoutMs, 'EHLO rednest.local\r\n');
          return smtp ? { port, protocol: 'smtp', open: true, smtp: this.parseSmtp(smtp) } : null;
        }
        default: {
          const open = await this.portOpen(host, port, timeoutMs);
          return open ? { port, protocol: 'unknown', open: true } : null;
        }
      }
    } catch {
      return null;
    }
  }

  // ── TCP helpers ────────────────────────────────────────────────────────────
  private portOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const s = net.connect({ host, port });
      const done = (v: boolean) => {
        s.destroy();
        resolve(v);
      };
      s.setTimeout(timeoutMs);
      s.once('connect', () => done(true));
      s.once('timeout', () => done(false));
      s.once('error', () => done(false));
    });
  }

  /** Conecta, opcionalmente envia algo, e lê o banner (texto). */
  private probeBanner(host: string, port: number, timeoutMs: number, send?: string): Promise<string | null> {
    return new Promise((resolve) => {
      const s = net.connect({ host, port });
      let buf = '';
      let timer: NodeJS.Timeout | undefined;
      let connected = false;
      const done = () => {
        if (timer) clearTimeout(timer);
        s.destroy();
        resolve(connected ? buf : null);
      };
      s.setTimeout(timeoutMs);
      s.once('connect', () => {
        connected = true;
        if (send) s.write(send);
        timer = setTimeout(done, 1500);
      });
      s.on('data', (d) => {
        buf += d.toString('utf8');
        if (buf.length > 4096) done();
      });
      s.once('timeout', done);
      s.once('error', () => {
        if (timer) clearTimeout(timer);
        s.destroy();
        resolve(connected ? buf : null);
      });
    });
  }

  // ── HTTP / HTTPS + TLS ───────────────────────────────────────────────────────
  private probeHttp(host: string, port: number, secure: boolean, timeoutMs: number): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const mod = secure ? https : http;
      let settled = false;
      const finish = (v: Record<string, unknown> | null) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      const req = mod.request(
        { host, port, method: 'GET', path: '/', timeout: timeoutMs, rejectUnauthorized: false, headers: { 'User-Agent': UA } },
        (resp) => {
          let body = '';
          resp.on('data', (d) => {
            if (body.length < 24000) body += d.toString('utf8');
            else resp.destroy();
          });
          const build = () => finish(this.buildHttp(resp, body, secure));
          resp.on('end', build);
          resp.on('close', build);
        },
      );
      req.on('timeout', () => {
        req.destroy();
        finish(null);
      });
      req.on('error', () => finish(null));
      req.end();
    });
  }

  private buildHttp(resp: http.IncomingMessage, body: string, secure: boolean): Record<string, unknown> {
    const headers = resp.headers;
    const titleMatch = body.match(/<title[^>]*>([^<]*)<\/title>/i);

    const securityHeaders: Record<string, string | null> = {};
    for (const h of SECURITY_HEADERS) securityHeaders[h] = (headers[h] as string) ?? null;

    const setCookie = (resp.headers['set-cookie'] as string[] | undefined) ?? [];
    const cookies = setCookie.map((c) => {
      const [pair, ...attrs] = c.split(';');
      const name = pair.split('=')[0].trim();
      const flags = attrs.map((a) => a.trim().toLowerCase());
      return {
        name,
        httpOnly: flags.includes('httponly'),
        secure: flags.includes('secure'),
        sameSite: flags.find((f) => f.startsWith('samesite='))?.split('=')[1] ?? null,
      };
    });

    const http: Record<string, unknown> = {
      status: resp.statusCode,
      httpVersion: resp.httpVersion,
      server: headers['server'] ?? null,
      poweredBy: headers['x-powered-by'] ?? null,
      title: titleMatch ? titleMatch[1].trim().slice(0, 200) : null,
      contentType: headers['content-type'] ?? null,
      securityHeaders,
      securityScore: SECURITY_HEADERS.filter((h) => securityHeaders[h]).length,
      cookies,
      technologies: this.detectTech(headers, body),
    };

    void secure;
    return { http };
  }

  /** Conexão TLS dedicada para extrair protocolo, cifra e certificado de forma confiável. */
  private probeTls(host: string, port: number, timeoutMs: number): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v: Record<string, unknown> | null) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      const socket = tls.connect(
        { host, port, servername: host, rejectUnauthorized: false, timeout: timeoutMs },
        () => {
          try {
            const cert = socket.getPeerCertificate(true) as any;
            const cipher = socket.getCipher();
            const protocol = socket.getProtocol();
            socket.end();
            finish({
              protocol,
              cipher: cipher ? { name: cipher.name, version: cipher.version } : null,
              certificate:
                cert && cert.subject
                  ? {
                      subject: cert.subject?.CN ?? null,
                      issuer: cert.issuer?.O ?? cert.issuer?.CN ?? null,
                      validFrom: cert.valid_from ?? null,
                      validTo: cert.valid_to ?? null,
                      serialNumber: cert.serialNumber ?? null,
                      fingerprint256: cert.fingerprint256 ?? null,
                      altNames: cert.subjectaltname
                        ? String(cert.subjectaltname).replace(/DNS:/g, '').split(', ')
                        : [],
                    }
                  : null,
            });
          } catch {
            socket.destroy();
            finish(null);
          }
        },
      );
      socket.setTimeout(timeoutMs);
      socket.once('timeout', () => {
        socket.destroy();
        finish(null);
      });
      socket.once('error', () => finish(null));
    });
  }

  /** Detecção leve de tecnologias por headers + corpo (heurística, não Wappalyzer completo). */
  private detectTech(headers: http.IncomingHttpHeaders, body: string): string[] {
    const tech = new Set<string>();
    const server = String(headers['server'] ?? '').toLowerCase();
    const powered = String(headers['x-powered-by'] ?? '').toLowerCase();
    if (server.includes('nginx')) tech.add('Nginx');
    if (server.includes('apache')) tech.add('Apache');
    if (server.includes('cloudflare') || headers['cf-ray']) tech.add('Cloudflare');
    if (server.includes('litespeed')) tech.add('LiteSpeed');
    if (server.includes('iis')) tech.add('IIS');
    if (powered.includes('php') || headers['set-cookie']?.some((c) => /PHPSESSID/i.test(c))) tech.add('PHP');
    if (powered.includes('express')) tech.add('Express');
    if (powered.includes('asp.net') || headers['x-aspnet-version']) tech.add('ASP.NET');
    if (headers['x-drupal-cache'] || /Drupal/i.test(body)) tech.add('Drupal');
    if (/wp-content|wp-includes/i.test(body)) tech.add('WordPress');
    if (/<meta[^>]+generator[^>]+joomla/i.test(body)) tech.add('Joomla');
    if (/__NEXT_DATA__/.test(body)) tech.add('Next.js');
    if (/ng-version=/.test(body)) tech.add('Angular');
    if (/data-reactroot|react/i.test(body) && /__react/i.test(body)) tech.add('React');
    const gen = body.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
    if (gen) tech.add(gen[1].split(' ')[0]);
    return [...tech].slice(0, 12);
  }

  // ── SSH ───────────────────────────────────────────────────────────────────────
  private probeSsh(host: string, port: number, timeoutMs: number): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const s = net.connect({ host, port });
      const chunks: Buffer[] = [];
      let timer: NodeJS.Timeout | undefined;
      let connected = false;
      const done = () => {
        if (timer) clearTimeout(timer);
        s.destroy();
        resolve(connected ? this.parseSsh(Buffer.concat(chunks)) : null);
      };
      s.setTimeout(timeoutMs);
      s.once('connect', () => {
        connected = true;
        timer = setTimeout(done, 1800);
      });
      s.on('data', (d) => {
        chunks.push(d);
        if (Buffer.concat(chunks).length > 8192) done();
      });
      s.once('timeout', done);
      s.once('error', () => {
        if (timer) clearTimeout(timer);
        s.destroy();
        resolve(connected ? this.parseSsh(Buffer.concat(chunks)) : null);
      });
    });
  }

  private parseSsh(buf: Buffer): Record<string, unknown> | null {
    const text = buf.toString('latin1');
    const m = text.match(/^SSH-([\d.]+)-([^\r\n]+)/);
    if (!m) return null;
    const result: Record<string, unknown> = { banner: m[0].trim(), protocolVersion: m[1], software: m[2].trim() };

    // KEXINIT (msg 20) → name-lists de algoritmos suportados
    try {
      const nl = buf.indexOf(0x0a); // fim da linha do banner
      let p = nl + 1;
      if (p + 6 < buf.length) {
        p += 4; // packet_length
        p += 1; // padding_length
        const msg = buf.readUInt8(p);
        p += 1;
        if (msg === 20) {
          p += 16; // cookie
          const lists: string[] = [];
          for (let i = 0; i < 10 && p + 4 <= buf.length; i++) {
            const len = buf.readUInt32BE(p);
            p += 4;
            lists.push(buf.toString('latin1', p, p + len));
            p += len;
          }
          result.algorithms = {
            kex: lists[0]?.split(',').filter(Boolean) ?? [],
            hostKeys: lists[1]?.split(',').filter(Boolean) ?? [],
            encryption: lists[2]?.split(',').filter(Boolean) ?? [],
            mac: lists[4]?.split(',').filter(Boolean) ?? [],
            compression: lists[6]?.split(',').filter(Boolean) ?? [],
          };
        }
      }
    } catch {
      /* KEXINIT opcional */
    }
    return result;
  }

  // ── FTP / SMTP parsing ─────────────────────────────────────────────────────────
  private parseFtp(banner: string): Record<string, unknown> {
    const line = banner.split(/\r?\n/).find((l) => l.startsWith('220')) ?? banner.trim();
    const sw = line.match(/\(([^)]+)\)/)?.[1] ?? line.replace(/^220[-\s]*/, '').trim();
    return { banner: banner.trim().slice(0, 300), software: sw || null };
  }

  private parseSmtp(banner: string): Record<string, unknown> {
    const lines = banner.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const hello = lines.find((l) => l.startsWith('220')) ?? '';
    const features = lines.filter((l) => /^250[ -]/.test(l)).map((l) => l.replace(/^250[ -]/, '').trim()).filter((f) => !/^\S+\.\S+$/.test(f));
    return { banner: hello.replace(/^220[-\s]*/, '').trim().slice(0, 300), features: [...new Set(features)].slice(0, 20) };
  }
}
