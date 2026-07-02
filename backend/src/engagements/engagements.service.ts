import { Injectable, NotFoundException, MessageEvent } from '@nestjs/common';
import { EngagementStatus, Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { serializeEngagement } from '../common/engagement-data.util';
import { PrismaService } from '../prisma/prisma.service';
import { CorrelationEngine } from '../engines/correlation.engine';
import { OsintEngine } from '../engines/osint.engine';
import { ReconEngine } from '../engines/recon.engine';
import { ThreatIntelEngine } from '../engines/threatintel.engine';
import { FindingsService } from '../findings/findings.service';
import { TimelineService, type EmitEvent } from '../timeline/timeline.service';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { QueryEngagementDto } from './dto/query-engagement.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';

const WITH_DATA = { data: true } satisfies Prisma.EngagementInclude;

type TargetKind = 'ip' | 'email' | 'domain' | 'username' | 'unknown';

function detectKind(v: string): TargetKind {
  const s = (v || '').trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return 'ip';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'email';
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return 'domain';
  if (/^@?[a-z0-9_.\-]{2,}$/i.test(s)) return 'username';
  return 'unknown';
}

/** Quebra o campo "alvo" em múltiplos valores (vírgula, ponto-e-vírgula, espaço, quebra de linha). */
function splitTargets(target: string): string[] {
  return [...new Set((target || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}

/** Escreve `val` em `obj` seguindo um caminho com pontos (ex.: "email.gravatar"). */
function setPath(obj: Record<string, any>, path: string, val: unknown): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

/** Estado de um alvo no resultado do enriquecimento. */
interface TokenState {
  value: string;
  kind: TargetKind;
  note?: string;
  [k: string]: unknown;
}

/** Um passo do pipeline: uma chamada de integração para um alvo. */
interface EnrichStep {
  tokenIdx: number;
  key: string; // único, ex.: "0:threat"
  label: string; // rótulo amigável exibido no pipeline
  field: string; // caminho dentro do TokenState onde grava o resultado
  run: (onProgress?: (p: unknown) => void) => Promise<unknown>;
}

@Injectable()
export class EngagementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recon: ReconEngine,
    private readonly osintEngine: OsintEngine,
    private readonly threatEngine: ThreatIntelEngine,
    private readonly correlation: CorrelationEngine,
    private readonly timeline: TimelineService,
    private readonly findings: FindingsService,
  ) {}

  /** Nome do "módulo Recon-ng-like" por tipo de alvo (para a timeline). */
  private static MODULE: Record<string, string> = {
    domain: 'Domain Intelligence',
    ip: 'Host Intelligence',
    email: 'Email Intelligence',
    username: 'Username Intelligence',
    unknown: 'Investigation',
  };

  /** Deriva um evento de "descoberta" a partir de um passo concluído. */
  private findingFor(field: string, value: unknown): { title: string; engine: string; icon: string; severity?: 'critical' | 'high' | 'medium' | 'low' } | null {
    const v = value as any;
    if (v?.error) return null;
    switch (field) {
      case 'subdomains': {
        const n = v?.names?.length ?? 0;
        return n ? { title: `${n} subdomínio(s) encontrado(s)`, engine: 'recon', icon: 'network' } : null;
      }
      case 'whois': {
        const ips = [...(v?.dns?.A ?? []), ...(v?.dns?.AAAA ?? [])];
        return { title: ips.length ? `WHOIS/DNS resolvido — ${ips.length} host(s)` : 'WHOIS/DNS resolvido', engine: 'recon', icon: 'globe' };
      }
      case 'threatIntel': {
        const verdict = v?.verdict;
        const sev = verdict === 'malicious' ? 'high' : verdict === 'suspicious' ? 'medium' : undefined;
        return { title: `Threat intel: ${verdict ?? 'sem veredito'}`, engine: 'threatintel', icon: 'shield', severity: sev };
      }
      case 'hunter': {
        const n = v?.total ?? 0;
        return n ? { title: `${n} e-mail(s) corporativo(s) (Hunter)`, engine: 'osint', icon: 'mail' } : null;
      }
      case 'asn':
        return v?.asn ? { title: `ASN AS${v.asn} — ${v.org ?? ''}`.trim(), engine: 'recon', icon: 'server' } : null;
      case 'email': {
        const leaks = (v?.leaklookup?.n ?? 0) + (v?.comb?.count ?? 0);
        const grav = v?.gravatar?.found ? ' · Gravatar' : '';
        return { title: `Email Intel: ${v?.hunter?.result ?? 'verificado'}${grav}${leaks ? ` · ${leaks} vazamento(s)` : ''}`, engine: 'osint', icon: 'at-sign', severity: leaks ? 'medium' : undefined };
      }
      case 'leaklookup':
        return (v?.n ?? 0) ? { title: `${v.n} fonte(s) de vazamento (Leak-Lookup)`, engine: 'threatintel', icon: 'database', severity: 'medium' } : null;
      case 'comb':
        return (v?.count ?? 0) ? { title: `${v.count} registro(s) em dumps (COMB)`, engine: 'threatintel', icon: 'database', severity: 'medium' } : null;
      case 'whatsmyname': {
        const n = v?.found?.length ?? 0;
        return n ? { title: `${n} perfil(is) público(s) encontrado(s)`, engine: 'osint', icon: 'user' } : null;
      }
      case 'userintel': {
        const hits = (v?.platforms ?? []).filter((p: any) => p.found);
        if (!hits.length) return null;
        const names = hits.map((p: any) => p.platform).join(', ');
        return { title: `Perfil identificado em ${names}`, engine: 'osint', icon: 'user' };
      }
      case 'servicescan': {
        const svcs = v?.services ?? [];
        if (!svcs.length) return null;
        const protos = [...new Set(svcs.map((s: any) => s.protocol.toUpperCase()))].join(', ');
        return { title: `${svcs.length} serviço(s) ativo(s): ${protos}`, engine: 'recon', icon: 'server' };
      }
      case 'googleintel': {
        if (!v?.found) return null;
        return { title: `Conta Google encontrada${v.name ? `: ${v.name}` : ''}`, engine: 'osint', icon: 'user' };
      }
      default:
        return null;
    }
  }

  /**
   * Monta o plano de enriquecimento: separa múltiplos alvos, detecta o tipo de
   * cada um e gera a lista de passos (uma chamada de integração por passo).
   * Compartilhado entre a rota síncrona e o stream SSE.
   */
  private buildPlan(target: string): { tokens: TokenState[]; steps: EnrichStep[] } {
    const values = splitTargets(target);
    const tokens: TokenState[] = [];
    const steps: EnrichStep[] = [];

    values.forEach((value, i) => {
      const kind = detectKind(value);
      tokens.push({ value, kind });
      const add = (
        key: string,
        label: string,
        field: string,
        run: (onProgress?: (p: unknown) => void) => Promise<unknown>,
      ) => steps.push({ tokenIdx: i, key: `${i}:${key}`, label, field, run });

      if (kind === 'ip') {
        add('threat', 'Threat Intel', 'threatIntel', () => this.threatEngine.ip(value));
        add('asn', 'ASN / Rede', 'asn', () => this.recon.asn(value));
        add('servicescan', 'Service Scan', 'servicescan', () => this.recon.serviceScan(value));
      } else if (kind === 'email') {
        add('gravatar', 'Gravatar', 'email.gravatar', () => this.osintEngine.gravatar(value));
        add('hunter', 'Hunter', 'email.hunter', () => this.osintEngine.hunterEmail(value));
        add('leaklookup', 'Leak-Lookup', 'email.leaklookup', () => this.osintEngine.leaklookup(value, 'email_address'));
        add('comb', 'COMB', 'email.comb', () => this.osintEngine.comb(value));
        add('googleintel', 'Google Intelligence', 'googleintel', () => this.osintEngine.googleEmail(value));
      } else if (kind === 'domain') {
        add('whois', 'WHOIS / DNS', 'whois', () => this.recon.dns(value));
        add('subdomains', 'Subdomínios', 'subdomains', () => this.recon.subdomains(value));
        add('threat', 'Threat Intel', 'threatIntel', () => this.threatEngine.domain(value));
        add('hunter', 'Hunter (e-mails)', 'hunter', () => this.osintEngine.hunterDomain(value));
        add('servicescan', 'Service Scan', 'servicescan', () => this.recon.serviceScan(value));
      } else if (kind === 'username') {
        const handle = value.replace(/^@/, '');
        add('userintel', 'Username Intelligence', 'userintel', () => this.osintEngine.userIntel(handle));
        add('leaklookup', 'Leak-Lookup', 'leaklookup', () => this.osintEngine.leaklookup(handle, 'username'));
        add('comb', 'COMB', 'comb', () => this.osintEngine.comb(handle));
        add('whatsmyname', 'Presença em sites (WhatsMyName)', 'whatsmyname', (onProgress) =>
          this.osintEngine
            .whatsmyname(handle, { onProgress: onProgress as (p: any) => void })
            .then((r) => ({ checked: r.checked, total: r.total, errors: r.errors, found: r.found })),
        );
      } else {
        tokens[i].note = 'não reconhecido como IP, domínio, e-mail ou usuário';
      }
    });

    return { tokens, steps };
  }

  /** Persiste o resultado em `enrichment`, registra timeline e devolve o engagement serializado. */
  private async persistEnrichment(
    eng: { id: string; name: string; target: string; operationId: string },
    tokens: TokenState[],
    extra?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {
      ranAt: new Date().toISOString(),
      target: eng.target,
      targets: tokens,
      ...extra,
    };
    await this.prisma.engagement.update({
      where: { id: eng.id },
      data: { enrichment: out as Prisma.InputJsonValue },
    });
    // Persiste achados navegáveis (subdomínios, e-mails, perfis, serviços, IOCs…)
    await this.findings
      .save(eng.id, eng.operationId, this.findings.extractEnrichment(tokens))
      .catch(() => undefined);
    await this.prisma.timelineEvent.create({
      data: {
        type: 'note_added',
        title: `Engajamento enriquecido — ${eng.name}`,
        description: `Auto-enriquecimento executado para ${eng.target}`,
        operationId: eng.operationId,
        engagementId: eng.id,
        severity: 'informational',
      },
    });
    const row = await this.prisma.engagement.findFirst({
      where: { id: eng.id },
      include: WITH_DATA,
    });
    return serializeEngagement(row!);
  }

  /** Auto-enriquecimento síncrono (fallback): roda todos os passos e persiste. */
  async enrich(id: string): Promise<Record<string, unknown>> {
    const eng = await this.ensureExists(id);
    const { tokens, steps } = this.buildPlan(eng.target);
    const results = await Promise.allSettled(steps.map((s) => s.run()));
    steps.forEach((s, i) => {
      const r = results[i];
      setPath(
        tokens[s.tokenIdx],
        s.field,
        r.status === 'fulfilled' ? r.value : { error: String((r.reason as Error)?.message ?? r.reason) },
      );
    });
    const corr = await this.correlation.correlate(tokens, () => undefined);
    return this.persistEnrichment(eng, tokens, this.corrExtra(corr));
  }

  /** Monta o objeto extra de correlação para persistir em `enrichment`. */
  private corrExtra(corr: { hosts: unknown[]; feedMatches: unknown[]; techMatches: unknown[] }): Record<string, unknown> | undefined {
    const extra: Record<string, unknown> = {};
    if (corr.hosts.length) extra.correlations = corr.hosts;
    if (corr.feedMatches.length) extra.feedMatches = corr.feedMatches;
    if (corr.techMatches.length) extra.techMatches = corr.techMatches;
    return Object.keys(extra).length ? extra : undefined;
  }

  /**
   * Auto-enriquecimento via SSE: emite o plano (`start`), o estado de cada passo
   * (`running`/`done`/`error`) conforme as integrações respondem e, ao final,
   * persiste e emite o engagement atualizado (`complete`).
   */
  enrichStream(id: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((sub) => {
      let cancelled = false;
      const emit = (data: unknown) => {
        if (!cancelled) sub.next({ data } as MessageEvent);
      };

      void (async () => {
        try {
          const eng = await this.ensureExists(id);
          const { tokens, steps } = this.buildPlan(eng.target);

          // Investigation Event Bus → timeline em tempo real
          const bus = (e: Omit<EmitEvent, 'operationId' | 'engagementId'>) =>
            void this.timeline
              .emit({ operationId: eng.operationId, engagementId: eng.id, ...e })
              .catch(() => undefined);

          emit({
            type: 'start',
            target: eng.target,
            tokens: tokens.map((t, idx) => ({ idx, value: t.value, kind: t.kind, note: t.note })),
            steps: steps.map((s) => ({ key: s.key, tokenIdx: s.tokenIdx, label: s.label })),
          });
          bus({ type: 'engine_started', engine: 'investigation', category: 'system', icon: 'play', title: `Investigação iniciada — ${tokens.length} alvo(s)` });
          // um "módulo iniciado" por alvo
          for (const t of tokens) {
            const mod = EngagementsService.MODULE[t.kind] ?? EngagementsService.MODULE.unknown;
            bus({ type: 'engine_started', engine: 'investigation', category: 'discovery', icon: 'search', title: `${mod} iniciado`, description: t.value, details: { target: t.value, kind: t.kind } });
          }

          await Promise.all(
            steps.map(async (s) => {
              emit({ type: 'step', key: s.key, status: 'running' });
              try {
                const value = await s.run((progress) =>
                  emit({ type: 'step', key: s.key, status: 'running', progress }),
                );
                setPath(tokens[s.tokenIdx], s.field, value);
                emit({ type: 'step', key: s.key, status: 'done', result: value });
                const f = this.findingFor(s.field, value);
                if (f)
                  bus({ type: 'asset_found', engine: f.engine, category: 'finding', icon: f.icon, severity: f.severity, title: f.title, description: tokens[s.tokenIdx].value, details: { target: tokens[s.tokenIdx].value, field: s.field } });
              } catch (e) {
                const error = String((e as Error)?.message ?? e);
                setPath(tokens[s.tokenIdx], s.field, { error });
                emit({ type: 'step', key: s.key, status: 'error', error });
                bus({ type: 'engine_failed', engine: 'investigation', category: 'system', icon: 'x', title: `${s.label} falhou`, description: error });
              }
            }),
          );

          if (cancelled) return;
          // Correlation Engine — engines conversando: hosts derivados + cruzamento com Threat Feeds
          const corr = await this.correlation.correlate(tokens, bus);
          if (cancelled) return;
          const engagement = await this.persistEnrichment(eng, tokens, this.corrExtra(corr));
          bus({ type: 'engine_finished', engine: 'investigation', category: 'system', icon: 'check', title: 'Investigação concluída' });
          emit({ type: 'complete', engagement });
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

  async findAll(query: QueryEngagementDto): Promise<Record<string, unknown>[]> {
    const where: Prisma.EngagementWhereInput = { deletedAt: null };
    if (query.operationId) where.operationId = query.operationId;
    if (query.type) where.type = query.type;

    const rows = await this.prisma.engagement.findMany({
      where,
      include: WITH_DATA,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(serializeEngagement);
  }

  async findByOperation(operationId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.engagement.findMany({
      where: { operationId, deletedAt: null },
      include: WITH_DATA,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(serializeEngagement);
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.engagement.findFirst({
      where: { id, deletedAt: null },
      include: WITH_DATA,
    });
    if (!row) throw new NotFoundException('Engagement não encontrado');
    return serializeEngagement(row);
  }

  async create(dto: CreateEngagementDto): Promise<Record<string, unknown>> {
    const op = await this.prisma.operation.findFirst({
      where: { id: dto.operationId, deletedAt: null },
    });
    if (!op) throw new NotFoundException('Operação não encontrada');

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.engagement.create({
        data: {
          operationId: dto.operationId,
          name: dto.name,
          target: dto.target,
          type: dto.type,
          tags: dto.tags ?? [],
          ...(dto.data
            ? { data: { create: { data: dto.data as Prisma.InputJsonValue } } }
            : {}),
        },
        include: WITH_DATA,
      });
      await tx.operation.update({
        where: { id: dto.operationId },
        data: { engagementCount: { increment: 1 } },
      });
      await tx.timelineEvent.create({
        data: {
          type: 'engagement_created',
          title: `Engagement criado — ${created.name}`,
          description: `Novo engagement do tipo ${created.type} para ${created.target}`,
          operationId: created.operationId,
          engagementId: created.id,
          severity: 'informational',
        },
      });
      return created;
    });
    return serializeEngagement(row);
  }

  async update(
    id: string,
    dto: UpdateEngagementDto,
  ): Promise<Record<string, unknown>> {
    await this.ensureExists(id);
    const row = await this.prisma.engagement.update({
      where: { id },
      data: {
        name: dto.name,
        target: dto.target,
        type: dto.type,
        tags: dto.tags,
        status: dto.status,
        ...(dto.data
          ? {
              data: {
                upsert: {
                  create: { data: dto.data as Prisma.InputJsonValue },
                  update: { data: dto.data as Prisma.InputJsonValue },
                },
              },
            }
          : {}),
      },
      include: WITH_DATA,
    });
    return serializeEngagement(row);
  }

  async updateStatus(
    id: string,
    status: EngagementStatus,
  ): Promise<Record<string, unknown>> {
    await this.ensureExists(id);
    const row = await this.prisma.engagement.update({
      where: { id },
      data: { status },
      include: WITH_DATA,
    });
    return serializeEngagement(row);
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    const eng = await this.ensureExists(id);
    await this.prisma.$transaction([
      this.prisma.engagement.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy },
      }),
      this.prisma.operation.update({
        where: { id: eng.operationId },
        data: { engagementCount: { decrement: 1 } },
      }),
    ]);
  }

  private async ensureExists(id: string) {
    const eng = await this.prisma.engagement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!eng) throw new NotFoundException('Engagement não encontrado');
    return eng;
  }
}
