import { Injectable, NotFoundException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ReconEngine } from '../engines/recon.engine';
import { FindingsService, NewFinding } from '../findings/findings.service';
import { NvdService } from '../integrations/nvd.service';
import { ScreenshotService } from '../integrations/screenshot.service';
import { ServiceScanService } from '../integrations/service-scan.service';
import { ThreatFeedsService } from '../integrations/threat-feeds.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmitEvent, TimelineService } from '../timeline/timeline.service';

/**
 * Recon Pipeline (Investigation Engine) — encadeia as engines:
 * Subdomínios → HTTP Discovery → Service Scan → Screenshot → Vuln Correlation.
 * Cada etapa alimenta a próxima; tudo é salvo como achado e emitido no bus.
 */

const MAX_HOSTS_SCAN = 20;
const MAX_SHOTS = 8;

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recon: ReconEngine,
    private readonly serviceScan: ServiceScanService,
    private readonly screenshot: ScreenshotService,
    private readonly nvd: NvdService,
    private readonly feeds: ThreatFeedsService,
    private readonly findings: FindingsService,
    private readonly timeline: TimelineService,
  ) {}

  stream(id: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((sub) => {
      let cancelled = false;
      const emit = (data: unknown) => {
        if (!cancelled) sub.next({ data } as MessageEvent);
      };

      void (async () => {
        try {
          const eng = await this.prisma.engagement.findFirst({ where: { id, deletedAt: null } });
          if (!eng) throw new NotFoundException('Engagement não encontrado');
          const bus = (e: Omit<EmitEvent, 'operationId' | 'engagementId'>) =>
            void this.timeline.emit({ operationId: eng.operationId, engagementId: id, ...e }).catch(() => undefined);
          const save = (items: NewFinding[]) => this.findings.save(id, eng.operationId, items).catch(() => 0);

          // alvos de domínio
          const domains = [...new Set((eng.target || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))]
            .filter((t) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t) && !/^\d+\.\d+\.\d+\.\d+$/.test(t));
          if (domains.length === 0) {
            emit({ type: 'error', error: 'Pipeline requer ao menos um domínio no alvo.' });
            return sub.complete();
          }

          emit({ type: 'start', phases: ['subdomains', 'http', 'servicescan', 'screenshot', 'vuln'], domains });
          bus({ type: 'engine_started', engine: 'investigation', category: 'system', icon: 'play', title: `Recon Pipeline iniciado — ${domains.join(', ')}` });

          // ── 1. Subdomínios ────────────────────────────────────────────────────────
          emit({ type: 'phase', phase: 'subdomains', status: 'running' });
          const hosts = new Set<string>();
          for (const d of domains) {
            hosts.add(d);
            const sub2 = await this.recon.subdomains(d).catch(() => null);
            for (const n of (sub2 as any)?.names ?? []) hosts.add(n);
          }
          const hostList = [...hosts];
          await save(hostList.map((h) => ({ type: 'subdomain', value: h, source: 'pipeline' })));
          emit({ type: 'phase', phase: 'subdomains', status: 'done', count: hostList.length });
          bus({ type: 'asset_found', engine: 'recon', category: 'finding', icon: 'network', title: `${hostList.length} subdomínio(s) descoberto(s)` });
          if (cancelled) return;

          // ── 2. HTTP Discovery ───────────────────────────────────────────────────────
          emit({ type: 'phase', phase: 'http', status: 'running' });
          const candidates = hostList.slice(0, 80);
          const live: { host: string; url: string; status: number }[] = [];
          let checked = 0;
          await this.pool(candidates, 25, async (h) => {
            const r = await this.httpAlive(h);
            checked++;
            if (r) live.push(r);
            if (checked % 10 === 0 || checked === candidates.length) emit({ type: 'progress', phase: 'http', done: checked, total: candidates.length, found: live.length });
          });
          await save(live.map((l) => ({ type: 'url', value: l.url, label: String(l.status), source: 'pipeline' })));
          emit({ type: 'phase', phase: 'http', status: 'done', count: live.length });
          bus({ type: 'asset_found', engine: 'recon', category: 'finding', icon: 'globe', title: `${live.length} host(s) HTTP ativo(s)` });
          if (cancelled) return;

          // ── 3. Service Scan ──────────────────────────────────────────────────────────
          emit({ type: 'phase', phase: 'servicescan', status: 'running' });
          const scanHosts = live.slice(0, MAX_HOSTS_SCAN);
          const techs = new Set<string>();
          let scanned = 0;
          for (const l of scanHosts) {
            if (cancelled) return;
            const res = await this.serviceScan.scan(l.host).catch(() => null);
            scanned++;
            if (res) {
              await save(this.findings.extract('servicescan', l.host, res));
              for (const s of res.services) for (const t of (s.http?.technologies as string[]) ?? []) techs.add(t);
            }
            emit({ type: 'progress', phase: 'servicescan', done: scanned, total: scanHosts.length });
          }
          emit({ type: 'phase', phase: 'servicescan', status: 'done', count: scanHosts.length, techs: [...techs] });
          bus({ type: 'asset_found', engine: 'recon', category: 'finding', icon: 'server', title: `Service scan em ${scanHosts.length} host(s); ${techs.size} tecnologia(s)` });
          if (cancelled) return;

          // ── 4. Screenshot ────────────────────────────────────────────────────────────
          emit({ type: 'phase', phase: 'screenshot', status: 'running' });
          const shotHosts = live.slice(0, MAX_SHOTS);
          let shots = 0;
          for (const l of shotHosts) {
            if (cancelled) return;
            const shot = await this.screenshot.capture(l.url).catch(() => null);
            shots++;
            if (shot?.ok) {
              await save([{ type: 'screenshot', value: shot.finalUrl ?? shot.url, label: shot.title ?? undefined, source: 'pipeline', data: { status: shot.status, title: shot.title, screenshot: shot.screenshot } }]);
            }
            emit({ type: 'progress', phase: 'screenshot', done: shots, total: shotHosts.length });
          }
          emit({ type: 'phase', phase: 'screenshot', status: 'done', count: shots });
          if (cancelled) return;

          // ── 5. Vuln Correlation ──────────────────────────────────────────────────────
          emit({ type: 'phase', phase: 'vuln', status: 'running' });
          const cveFindings: NewFinding[] = [];
          let kevCount = 0;
          for (const tech of [...techs].slice(0, 12)) {
            const [kev, nvd] = await Promise.all([
              this.feeds.matchProduct(tech).catch(() => []),
              this.nvd.forProduct(tech).catch(() => []),
            ]);
            const seen = new Set<string>();
            for (const k of kev) {
              const cid = k.indicator ?? k.key;
              if (seen.has(cid)) continue;
              seen.add(cid);
              kevCount++;
              cveFindings.push({ type: 'cve', value: cid, label: `${tech} · KEV`, source: 'kev', severity: 'high', target: tech, data: { vendor: k.vendor, product: k.product } });
            }
            for (const c of nvd) {
              if (seen.has(c.cveId)) continue;
              seen.add(c.cveId);
              cveFindings.push({ type: 'cve', value: c.cveId, label: `${tech} · CVSS ${c.cvssScore ?? '?'}`, source: 'nvd', severity: c.cvssSeverity?.toLowerCase(), target: tech, data: { score: c.cvssScore } });
            }
            if (seen.size) bus({ type: 'correlation', engine: 'threatintel', category: 'correlation', icon: 'shield', severity: 'medium', title: `${tech}: ${seen.size} CVE(s) correlacionada(s)`, description: tech });
          }
          await save(cveFindings);
          emit({ type: 'phase', phase: 'vuln', status: 'done', count: cveFindings.length, kev: kevCount });

          bus({ type: 'engine_finished', engine: 'investigation', category: 'system', icon: 'check', title: 'Recon Pipeline concluído' });
          emit({
            type: 'complete',
            summary: { subdomains: hostList.length, live: live.length, services: scanHosts.length, screenshots: shots, cves: cveFindings.length, techs: [...techs] },
          });
          sub.complete();
        } catch (e) {
          emit({ type: 'error', error: String((e as Error)?.message ?? e) });
          sub.complete();
        }
      })();

      return () => {
        cancelled = true;
      };
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
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

  private async httpAlive(host: string): Promise<{ host: string; url: string; status: number } | null> {
    for (const scheme of ['https', 'http']) {
      const url = `${scheme}://${host}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'RedNest/0.2' } });
        clearTimeout(timer);
        return { host, url, status: res.status };
      } catch {
        clearTimeout(timer);
      }
    }
    return null;
  }
}
