import { Injectable, NotFoundException } from '@nestjs/common';
import { Evidence, Prisma } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';

export interface UploadMeta {
  operationId?: string;
  engagementId?: string;
  name?: string;
  description?: string;
  tags?: string[];
  userId?: string;
}

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(file: Express.Multer.File, meta: UploadMeta): Promise<Evidence> {
    const ev = await this.prisma.evidence.create({
      data: {
        operationId: meta.operationId || null,
        engagementId: meta.engagementId || null,
        name: meta.name?.trim() || file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storedPath: file.path,
        description: meta.description ?? '',
        tags: meta.tags ?? [],
        uploadedBy: meta.userId || null,
      },
    });

    if (meta.operationId)
      await this.prisma.operation
        .update({ where: { id: meta.operationId }, data: { evidenceCount: { increment: 1 } } })
        .catch(() => undefined);
    if (meta.engagementId)
      await this.prisma.engagement
        .update({ where: { id: meta.engagementId }, data: { evidenceCount: { increment: 1 } } })
        .catch(() => undefined);
    if (meta.operationId)
      await this.prisma.timelineEvent
        .create({
          data: {
            type: 'evidence_collected',
            title: `Evidência coletada — ${ev.name}`,
            description: `${(file.size / 1024).toFixed(1)} KB · ${file.mimetype}`,
            operationId: meta.operationId,
            engagementId: meta.engagementId || null,
            severity: 'informational',
          },
        })
        .catch(() => undefined);

    return ev;
  }

  list(filters: { operationId?: string; engagementId?: string }): Promise<Evidence[]> {
    const where: Prisma.EvidenceWhereInput = {};
    if (filters.operationId) where.operationId = filters.operationId;
    if (filters.engagementId) where.engagementId = filters.engagementId;
    return this.prisma.evidence.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async get(id: string): Promise<Evidence> {
    const ev = await this.prisma.evidence.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evidência não encontrada');
    return ev;
  }

  async remove(id: string): Promise<void> {
    const ev = await this.get(id);
    await unlink(ev.storedPath).catch(() => undefined);
    await this.prisma.evidence.delete({ where: { id } });
    if (ev.operationId)
      await this.prisma.operation
        .update({ where: { id: ev.operationId }, data: { evidenceCount: { decrement: 1 } } })
        .catch(() => undefined);
    if (ev.engagementId)
      await this.prisma.engagement
        .update({ where: { id: ev.engagementId }, data: { evidenceCount: { decrement: 1 } } })
        .catch(() => undefined);
  }
}
