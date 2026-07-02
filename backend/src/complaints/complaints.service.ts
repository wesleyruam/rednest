import { Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus, OperationPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ComplaintInput {
  operationId: string;
  engagementId?: string | null;
  title?: string;
  target: string;
  platform: string;
  ticketId?: string | null;
  ticketUrl?: string | null;
  category?: string | null;
  status?: ComplaintStatus;
  priority?: OperationPriority;
  notes?: string | null;
  submittedAt?: string | null;
  resolvedAt?: string | null;
}

const OPEN_ORDER: ComplaintStatus[] = ['submitted', 'acknowledged', 'in_review', 'draft', 'rejected', 'resolved', 'closed'];

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(operationId: string) {
    const rows = await this.prisma.complaint.findMany({
      where: { operationId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    // ordena por "abertas primeiro" mantendo o desempate por prioridade/data
    return rows.sort((a, b) => OPEN_ORDER.indexOf(a.status) - OPEN_ORDER.indexOf(b.status));
  }

  async stats(operationId: string) {
    const rows = await this.prisma.complaint.findMany({ where: { operationId }, select: { status: true } });
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const resolved = (byStatus.resolved ?? 0) + (byStatus.closed ?? 0);
    const open = rows.length - resolved - (byStatus.rejected ?? 0);
    return { total: rows.length, resolved, open, rejected: byStatus.rejected ?? 0, byStatus };
  }

  create(dto: ComplaintInput, authorId?: string) {
    return this.prisma.complaint.create({
      data: {
        operationId: dto.operationId,
        engagementId: dto.engagementId || null,
        title: dto.title?.trim() || '',
        target: dto.target.trim(),
        platform: dto.platform.trim(),
        ticketId: dto.ticketId?.trim() || null,
        ticketUrl: dto.ticketUrl?.trim() || null,
        category: dto.category?.trim() || null,
        status: dto.status ?? 'submitted',
        priority: dto.priority ?? 'medium',
        notes: dto.notes?.trim() || null,
        submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : new Date(),
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
        authorId: authorId ?? null,
      },
    });
  }

  async update(id: string, dto: Partial<ComplaintInput>) {
    await this.ensure(id);
    // ao marcar resolvida/encerrada, carimba resolvedAt se ainda não tiver
    const resolvedPatch =
      dto.status && ['resolved', 'closed'].includes(dto.status) && dto.resolvedAt === undefined
        ? { resolvedAt: new Date() }
        : dto.resolvedAt !== undefined
          ? { resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null }
          : {};
    return this.prisma.complaint.update({
      where: { id },
      data: {
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.target != null ? { target: dto.target.trim() } : {}),
        ...(dto.platform != null ? { platform: dto.platform.trim() } : {}),
        ...(dto.ticketId !== undefined ? { ticketId: dto.ticketId?.trim() || null } : {}),
        ...(dto.ticketUrl !== undefined ? { ticketUrl: dto.ticketUrl?.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.submittedAt !== undefined ? { submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : null } : {}),
        ...resolvedPatch,
      },
    });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.complaint.delete({ where: { id } });
  }

  private async ensure(id: string) {
    const c = await this.prisma.complaint.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Denúncia não encontrada');
    return c;
  }
}
