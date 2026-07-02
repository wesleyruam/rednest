import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AlertSeverity, IOCThreatLevel, Monitor, MonitorKind } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenshotService } from '../integrations/screenshot.service';
import { ThreatIntelService } from '../integrations/threatintel.service';
import { TelegramService } from '../notifications/telegram.service';
import { ProxyService } from '../proxy/proxy.service';

/** Converte HTML em texto com quebras nos limites de bloco (p/ diff legível). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|ul|ol|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** Diff por linha (set-based): o que entrou/saiu entre dois textos. */
function diffText(oldText: string, newText: string) {
  const oldLines = oldText.split('\n').filter(Boolean);
  const newLines = newText.split('\n').filter(Boolean);
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const added = newLines.filter((l) => !oldSet.has(l));
  const removed = oldLines.filter((l) => !newSet.has(l));
  return {
    addedLines: added.length,
    removedLines: removed.length,
    addedSample: added.slice(0, 20),
    removedSample: removed.slice(0, 20),
  };
}

export const MONITOR_QUEUE = 'monitors';

export interface CreateMonitorInput {
  operationId: string;
  engagementId?: string;
  iocId?: string;
  kind: MonitorKind;
  target: string;
  intervalMinutes?: number;
  useProxy?: boolean;
}

const sevToThreat: Record<AlertSeverity, IOCThreatLevel> = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low',
};

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly threat: ThreatIntelService,
    private readonly screenshot: ScreenshotService,
    private readonly telegram: TelegramService,
    private readonly proxy: ProxyService,
    @InjectQueue(MONITOR_QUEUE) private readonly queue: Queue,
  ) {}

  /** Histórico de execuções de um monitor (timeline). */
  listRuns(id: string) {
    return this.prisma.monitorRun.findMany({
      where: { monitorId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Registra o job repetível de varredura (a cada 60s) via BullMQ. */
  async onModuleInit(): Promise<void> {
    await this.splitLegacyMonitors().catch((e) => this.logger.warn(`split legado falhou: ${String(e)}`));
    try {
      await this.queue.upsertJobScheduler('monitor-scan', { every: 60_000 }, { name: 'scan', data: {} });
      this.logger.log('Scheduler de monitores registrado (BullMQ, 60s).');
    } catch (e) {
      this.logger.warn(`Não foi possível registrar o scheduler: ${String(e)}`);
    }
  }

  /** Migração idempotente: divide monitores com alvo múltiplo em um por alvo. */
  private async splitLegacyMonitors(): Promise<void> {
    const all = await this.prisma.monitor.findMany();
    let split = 0;
    for (const m of all) {
      const tokens = [...new Set((m.target || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
      if (tokens.length <= 1) continue;
      // mantém o 1º alvo no monitor existente (preserva runs/histórico)
      await this.prisma.monitor.update({ where: { id: m.id }, data: { target: tokens[0] } });
      for (const t of tokens.slice(1)) {
        const exists = await this.prisma.monitor.findFirst({ where: { operationId: m.operationId, target: t, kind: m.kind } });
        if (exists) continue;
        await this.prisma.monitor.create({
          data: { operationId: m.operationId, engagementId: m.engagementId, iocId: m.iocId, kind: m.kind, target: t, intervalMinutes: m.intervalMinutes },
        });
      }
      split++;
    }
    if (split) this.logger.log(`Monitores com alvo múltiplo divididos: ${split}`);
  }

  /** Enfileira um job `run` por monitor vencido (chamado pelo job `scan`). */
  async scanAndEnqueue(): Promise<number> {
    const now = Date.now();
    const monitors = await this.prisma.monitor.findMany({ where: { active: true } });
    let n = 0;
    for (const m of monitors) {
      if (m.lastRunAt && now - m.lastRunAt.getTime() < m.intervalMinutes * 60_000) continue;
      await this.queue.add(
        'run',
        { id: m.id },
        { jobId: `run-${m.id}-${Math.floor(now / 60_000)}`, attempts: 2, backoff: { type: 'fixed', delay: 5000 }, removeOnComplete: true, removeOnFail: 50 },
      );
      n++;
    }
    return n;
  }

  async runById(id: string): Promise<Monitor | null> {
    const m = await this.prisma.monitor.findUnique({ where: { id } });
    if (!m || !m.active) return null;
    return this.runOne(m);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  /** Cria um monitor por alvo (alvos múltiplos vêm separados por vírgula/espaço). */
  async create(dto: CreateMonitorInput): Promise<Monitor> {
    const tokens = [...new Set((dto.target || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
    const targets = tokens.length ? tokens : [dto.target.trim()];
    let first: Monitor | null = null;
    for (const t of targets) {
      const m = await this.prisma.monitor.create({
        data: {
          operationId: dto.operationId,
          engagementId: dto.engagementId || null,
          iocId: dto.iocId || null,
          kind: dto.kind,
          target: t,
          intervalMinutes: dto.intervalMinutes ?? 60,
          useProxy: dto.useProxy ?? false,
        },
      });
      if (!first) first = m;
    }
    return first!;
  }

  list(operationId?: string): Promise<Monitor[]> {
    return this.prisma.monitor.findMany({
      where: operationId ? { operationId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string): Promise<Monitor> {
    const m = await this.prisma.monitor.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Monitor não encontrado');
    return m;
  }

  async toggle(id: string): Promise<Monitor> {
    const m = await this.get(id);
    return this.prisma.monitor.update({ where: { id }, data: { active: !m.active } });
  }

  async update(id: string, data: { intervalMinutes?: number; active?: boolean; useProxy?: boolean }): Promise<Monitor> {
    await this.get(id);
    return this.prisma.monitor.update({
      where: { id },
      data: {
        ...(data.intervalMinutes != null ? { intervalMinutes: data.intervalMinutes } : {}),
        ...(data.active != null ? { active: data.active } : {}),
        ...(data.useProxy != null ? { useProxy: data.useProxy } : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.monitor.delete({ where: { id } });
  }

  // ── Execução ──────────────────────────────────────────────────────────────
  async runOne(m: Monitor): Promise<Monitor> {
    if (m.kind === 'http_content') return this.checkHttp(m);
    return this.checkIoc(m);
  }

  private async checkHttp(m: Monitor): Promise<Monitor> {
    // normaliza: usa o 1º alvo válido (monitores antigos podem ter vários no mesmo campo)
    const firstTarget = (m.target || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean)[0] || m.target;
    const url = firstTarget.startsWith('http') ? firstTarget : `https://${firstTarget}`;
    let hash: string | null = null;
    let status = 'ok';
    let httpStatus: number | null = null;
    let text = '';
    let rawLen = 0;
    let changed = false;
    let diff: ReturnType<typeof diffText> | null = null;
    let errored = false;
    let errorReason = '';

    try {
      let body: string;
      if (m.useProxy) {
        // monitora pela rede de proxies (anonimiza a origem; fallback direto se o pool estiver vazio)
        const { result } = await this.proxy.fetchThrough(url, { tries: 2, timeoutMs: 15000, maxBytes: 2_000_000, fallbackDirect: true });
        httpStatus = result.status;
        body = result.body;
      } else {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'RedNest-Monitor/1.0' } });
        clearTimeout(t);
        httpStatus = res.status;
        body = await res.text();
      }
      rawLen = body.length;
      text = htmlToText(body);
      hash = createHash('sha256').update(text).digest('hex');
    } catch (e) {
      status = 'error';
      errored = true;
      errorReason = (e as Error)?.name === 'AbortError' ? 'tempo esgotado (15s)' : String((e as Error)?.message ?? e);
    }

    if (errored) {
      // notifica só na transição p/ erro (evita spam a cada ciclo)
      if (m.lastStatus !== 'error') {
        await this.raiseAlert(m, 'high', `Monitor falhou ao capturar — ${m.target}`,
          `Não foi possível acessar o alvo${errorReason ? `: ${errorReason}` : '.'}`);
      }
    } else {
      if (m.lastValue && hash !== m.lastValue) {
        changed = true;
        status = 'changed';
        diff = diffText(m.lastContent ?? '', text);
        await this.raiseAlert(m, 'medium', `Mudança de conteúdo — ${m.target}`,
          `Página mudou: +${diff.addedLines} / -${diff.removedLines} linha(s).`);
      } else if (!m.lastValue) {
        status = 'ok'; // primeira execução = baseline
      } else if (m.lastStatus === 'error') {
        // alvo voltou a responder — avisa a recuperação
        await this.raiseAlert(m, 'low', `Monitor recuperado — ${m.target}`,
          `O alvo voltou a responder (HTTP ${httpStatus ?? '—'}).`);
      }
    }

    // screenshot por execução (viewport) — só quando a página respondeu
    let shot: string | null = null;
    if (!errored) {
      shot = (await this.screenshot.capture(url).catch(() => null))?.screenshot ?? null;
    }

    await this.prisma.monitorRun.create({
      data: {
        monitorId: m.id, status, httpStatus, contentHash: hash, contentLength: rawLen,
        changed, diff: (diff ?? undefined) as any, screenshot: shot,
        content: errored ? null : text.slice(0, 200_000),
      },
    });
    await this.pruneRuns(m.id);

    return this.prisma.monitor.update({
      where: { id: m.id },
      data: {
        lastValue: hash ?? m.lastValue,
        lastContent: errored ? m.lastContent : text.slice(0, 300_000),
        lastRunAt: new Date(),
        lastStatus: status,
      },
    });
  }

  private async checkIoc(m: Monitor): Promise<Monitor> {
    const v = m.target.trim();
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(v);
    const res = isIp ? await this.threat.enrichIp(v) : await this.threat.enrichDomain(v);
    const verdict = (res?.verdict as string) ?? 'unknown';
    let changed = false;
    if (m.lastValue && verdict !== m.lastValue && (verdict === 'malicious' || verdict === 'suspicious')) {
      changed = true;
      const sev: AlertSeverity = verdict === 'malicious' ? 'high' : 'medium';
      await this.raiseAlert(m, sev, `IOC mudou para ${verdict} — ${m.target}`, `Veredito de threat intel passou de ${m.lastValue} para ${verdict}.`);
    }
    await this.prisma.monitorRun.create({
      data: { monitorId: m.id, status: changed ? 'changed' : 'ok', changed, note: `verdict: ${verdict}` },
    });
    await this.pruneRuns(m.id);
    return this.prisma.monitor.update({
      where: { id: m.id },
      data: { lastValue: verdict, lastRunAt: new Date(), lastStatus: changed ? 'changed' : 'ok' },
    });
  }

  /** Mantém apenas os 50 runs mais recentes por monitor. */
  private async pruneRuns(monitorId: string): Promise<void> {
    const old = await this.prisma.monitorRun.findMany({
      where: { monitorId }, orderBy: { createdAt: 'desc' }, skip: 50, select: { id: true },
    });
    if (old.length) await this.prisma.monitorRun.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  }

  private async raiseAlert(m: Monitor, severity: AlertSeverity, title: string, description: string): Promise<void> {
    this.telegram.notify(`[${severity.toUpperCase()}] ${title}`, `${description}\nAlvo: ${m.target}`);
    await this.prisma.alert.create({
      data: { monitorId: m.id, title, description, severity, operationId: m.operationId, acknowledged: false },
    });
    await this.prisma.operation.update({ where: { id: m.operationId }, data: { alertCount: { increment: 1 } } }).catch(() => undefined);
    await this.prisma.timelineEvent.create({
      data: {
        type: 'monitoring_alert', title, description,
        operationId: m.operationId, engagementId: m.engagementId,
        severity: sevToThreat[severity],
      },
    });
  }
}
