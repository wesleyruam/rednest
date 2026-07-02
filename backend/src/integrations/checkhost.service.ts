import { Injectable } from '@nestjs/common';
import { fetchJson } from './http.util';

const BASE = 'https://check-host.net';
const ALLOWED = new Set(['ping', 'http', 'tcp', 'dns']);
const TARGET_RE = /^[A-Za-z0-9._\-:/]+$/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Checagens distribuídas via check-host.net (ping/http/tcp/dns), portado da v1. */
@Injectable()
export class CheckHostService {
  private parsePing(node: any): Record<string, unknown> {
    if (!node || !Array.isArray(node) || !node[0])
      return { ok: false, ms: null, loss: 100 };
    const attempts = node[0];
    const oks = attempts.filter(
      (a: any) => Array.isArray(a) && a[0] === 'OK' && a.length > 1,
    );
    if (!oks.length) return { ok: false, ms: null, loss: 100 };
    const avg = (oks.reduce((s: number, a: any) => s + a[1], 0) / oks.length) * 1000;
    return {
      ok: true,
      ms: Math.round(avg * 10) / 10,
      loss: Math.round((1 - oks.length / attempts.length) * 100),
    };
  }

  private parseHttp(node: any): Record<string, unknown> {
    if (!node || !Array.isArray(node) || !node[0])
      return { ok: false, ms: null };
    const r = node[0];
    return {
      ok: r ? Boolean(r[0]) : false,
      ms: r.length > 1 && r[1] ? Math.round(r[1] * 1000 * 10) / 10 : null,
      detail: r.length > 2 ? r[2] : null,
      code: r.length > 3 ? r[3] : null,
    };
  }

  async check(
    target: string,
    kind = 'ping',
    maxNodes = 12,
  ): Promise<Record<string, unknown>> {
    target = (target || '').trim();
    if (!target || !TARGET_RE.test(target)) return { error: 'alvo inválido' };
    if (!ALLOWED.has(kind)) kind = 'ping';

    let init: any;
    try {
      const qs = new URLSearchParams({ host: target, max_nodes: String(maxNodes) });
      const r = await fetchJson<any>(`${BASE}/check-${kind}?${qs}`, {
        timeoutMs: 15000,
      });
      init = r.json;
    } catch (e) {
      return { error: `falha ao contatar check-host.net: ${String(e)}` };
    }
    if (!init || !init.ok)
      return { error: init?.error || 'check-host.net recusou a requisição' };

    const rid = init.request_id;
    const nodesMeta = init.nodes ?? {};
    let results: Record<string, any> = {};
    for (let i = 0; i < 12; i++) {
      await sleep(1000);
      try {
        const r = await fetchJson<any>(`${BASE}/check-result/${rid}`, {
          timeoutMs: 15000,
        });
        results = r.json ?? {};
      } catch {
        continue;
      }
      if (
        Object.keys(results).length &&
        Object.values(results).every((v) => v !== null)
      )
        break;
    }

    const parsed: Array<Record<string, unknown>> = [];
    for (const [node, metaRaw] of Object.entries(nodesMeta)) {
      const meta = (metaRaw as any[]) || [];
      const res = results[node];
      let p: Record<string, unknown>;
      if (kind === 'ping') p = this.parsePing(res);
      else if (kind === 'http') p = this.parseHttp(res);
      else p = { ok: res != null, ms: null };
      parsed.push({
        node,
        cc: (meta[0] ?? '').toLowerCase(),
        country: meta[1] ?? node,
        city: meta[2] ?? '',
        ...p,
      });
    }
    parsed.sort(
      (a, b) =>
        Number(!a.ok) - Number(!b.ok) ||
        ((a.ms as number) ?? 9999) - ((b.ms as number) ?? 9999),
    );

    return {
      request_id: rid,
      permanent_link: init.permanent_link,
      kind,
      reachable: parsed.filter((n) => n.ok).length,
      total: parsed.length,
      nodes: parsed,
    };
  }
}
