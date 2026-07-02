import { Injectable, NotFoundException } from '@nestjs/common';
import { Ioc, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EnrichmentService } from '../integrations/enrichment.service';
import { OsintService } from '../integrations/osint.service';
import { ThreatIntelService } from '../integrations/threatintel.service';
import { CreateIocDto } from './dto/create-ioc.dto';
import { QueryIocDto } from './dto/query-ioc.dto';
import { UpdateIocDto } from './dto/update-ioc.dto';

function hostFromUrl(v: string): string {
  try {
    return new URL(v).hostname;
  } catch {
    return v;
  }
}

@Injectable()
export class IocsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threat: ThreatIntelService,
    private readonly enrichment: EnrichmentService,
    private readonly osint: OsintService,
  ) {}

  /** Enriquece o IOC pelas integrações e PERSISTE o resultado + evento na timeline. */
  async enrich(id: string): Promise<Ioc> {
    const ioc = await this.findOne(id);
    let result: Record<string, unknown> | null = null;

    switch (ioc.type) {
      case 'ip':
        result = await this.threat.enrichIp(ioc.value);
        break;
      case 'domain':
        result = await this.threat.enrichDomain(ioc.value);
        break;
      case 'url':
        result = await this.threat.enrichDomain(hostFromUrl(ioc.value));
        break;
      case 'cve':
        result = (await this.enrichment.cveLookup(ioc.value)) ?? { found: false };
        break;
      case 'email':
        result = {
          gravatar: await this.osint.gravatar(ioc.value),
          hunter: await this.osint.hunterEmail(ioc.value),
          leaklookup: await this.osint.leaklookup(ioc.value),
          comb: await this.osint.comb(ioc.value),
        };
        break;
      default:
        result = { unsupported: true };
    }

    const verdict = typeof result?.verdict === 'string' ? (result.verdict as string) : null;
    const tags = [...ioc.tags];
    if (verdict && !tags.includes(verdict)) tags.push(verdict);

    const updated = await this.prisma.ioc.update({
      where: { id },
      data: {
        enrichment: (result ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        tags,
        lastSeen: new Date(),
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        type: 'note_added',
        title: `IOC enriquecido — ${ioc.value}`,
        description: verdict
          ? `Veredito: ${verdict} (score ${String(result?.score ?? '—')})`
          : 'Enriquecimento executado',
        operationId: ioc.operationId,
        engagementId: ioc.engagementId,
        severity: ioc.threatLevel,
      },
    });

    return updated;
  }

  findAll(query: QueryIocDto): Promise<Ioc[]> {
    const where: Prisma.IocWhereInput = { deletedAt: null };
    if (query.type) where.type = query.type;
    if (query.threatLevel) where.threatLevel = query.threatLevel;
    if (query.operation) where.operationId = query.operation;
    if (query.engagement) where.engagementId = query.engagement;
    if (query.search) {
      where.OR = [
        { value: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }
    return this.prisma.ioc.findMany({
      where,
      orderBy: { lastSeen: 'desc' },
    });
  }

  async findOne(id: string): Promise<Ioc> {
    const ioc = await this.prisma.ioc.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ioc) throw new NotFoundException('IOC não encontrado');
    return ioc;
  }

  /** Related IOCs via the ioc_relations graph (both directions). */
  async findRelated(id: string): Promise<Ioc[]> {
    await this.findOne(id);
    const relations = await this.prisma.iocRelation.findMany({
      where: { OR: [{ sourceIocId: id }, { targetIocId: id }] },
    });
    const ids = relations.map((r) =>
      r.sourceIocId === id ? r.targetIocId : r.sourceIocId,
    );
    if (ids.length === 0) return [];
    return this.prisma.ioc.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }

  async create(dto: CreateIocDto): Promise<Ioc> {
    const ioc = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ioc.create({
        data: {
          value: dto.value,
          type: dto.type,
          threatLevel: dto.threatLevel,
          operationId: dto.operationId,
          engagementId: dto.engagementId,
          tags: dto.tags ?? [],
          source: dto.source ?? '',
          description: dto.description ?? '',
        },
      });
      await tx.operation.update({
        where: { id: dto.operationId },
        data: { iocCount: { increment: 1 } },
      });
      if (dto.engagementId) {
        await tx.engagement.update({
          where: { id: dto.engagementId },
          data: { iocCount: { increment: 1 } },
        });
      }
      await tx.timelineEvent.create({
        data: {
          type: 'ioc_added',
          title: `IOC adicionado — ${created.type}`,
          description: created.value,
          operationId: created.operationId,
          engagementId: created.engagementId,
          severity: created.threatLevel,
        },
      });
      return created;
    });
    return ioc;
  }

  async update(id: string, dto: UpdateIocDto): Promise<Ioc> {
    await this.findOne(id);
    return this.prisma.ioc.update({
      where: { id },
      data: {
        value: dto.value,
        type: dto.type,
        threatLevel: dto.threatLevel,
        engagementId: dto.engagementId,
        tags: dto.tags,
        source: dto.source,
        description: dto.description,
        lastSeen: new Date(),
      },
    });
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    const ioc = await this.findOne(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.ioc.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy },
      });
      await tx.operation.update({
        where: { id: ioc.operationId },
        data: { iocCount: { decrement: 1 } },
      });
      if (ioc.engagementId) {
        await tx.engagement.update({
          where: { id: ioc.engagementId },
          data: { iocCount: { decrement: 1 } },
        });
      }
    });
  }
}
