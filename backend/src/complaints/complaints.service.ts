import { Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus, OperationPriority, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
  result?: string | null;
  submittedAt?: string | null;
  resolvedAt?: string | null;
}

interface CEvent { id: string; at: string; type: string; title: string; description?: string; author?: string; meta?: string }
interface CData { events: CEvent[]; notes: { id: string; at: string; author?: string; text: string }[]; attachments: { id: string; at: string; author?: string; name: string; url?: string }[] }

const OPEN_ORDER: ComplaintStatus[] = ['submitted', 'acknowledged', 'in_review', 'draft', 'rejected', 'resolved', 'closed'];

const STATUS_EVENT: Record<ComplaintStatus, string> = {
  draft: 'Denúncia salva como rascunho',
  submitted: 'Denúncia enviada',
  acknowledged: 'Ticket recebido',
  in_review: 'Denúncia em análise',
  resolved: 'Denúncia resolvida',
  rejected: 'Denúncia rejeitada',
  closed: 'Denúncia encerrada',
};

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  private ev(type: string, title: string, author?: string, description?: string, meta?: string): CEvent {
    return { id: randomUUID(), at: new Date().toISOString(), type, title, description, author, meta };
  }
  private emptyData(): CData { return { events: [], notes: [], attachments: [] }; }
  private normData(raw: any): CData {
    const d = (raw && typeof raw === 'object') ? raw : {};
    return { events: Array.isArray(d.events) ? d.events : [], notes: Array.isArray(d.notes) ? d.notes : [], attachments: Array.isArray(d.attachments) ? d.attachments : [] };
  }

  async list(operationId: string) {
    const rows = await this.prisma.complaint.findMany({ where: { operationId }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
    return rows.sort((a, b) => OPEN_ORDER.indexOf(a.status) - OPEN_ORDER.indexOf(b.status));
  }

  async stats(operationId: string) {
    const rows = await this.prisma.complaint.findMany({ where: { operationId }, select: { status: true, submittedAt: true, resolvedAt: true } });
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const resolved = (byStatus.resolved ?? 0) + (byStatus.closed ?? 0);
    const rejected = byStatus.rejected ?? 0;
    const inReview = byStatus.in_review ?? 0;
    const open = rows.length - resolved - rejected;
    // tempo médio de resolução (dias) sobre os que têm submittedAt + resolvedAt
    const durs = rows.filter((r) => r.submittedAt && r.resolvedAt).map((r) => (+new Date(r.resolvedAt!) - +new Date(r.submittedAt!)) / 86400000);
    const avgResolutionDays = durs.length ? +(durs.reduce((a, b) => a + b, 0) / durs.length).toFixed(1) : null;
    return { total: rows.length, open, inReview, resolved, rejected, byStatus, avgResolutionDays };
  }

  create(dto: ComplaintInput, author?: string) {
    const data = this.emptyData();
    data.events.push(this.ev('created', 'Denúncia criada', author));
    const status = dto.status ?? 'submitted';
    if (status !== 'draft') {
      data.events.push(this.ev(`status:${status}`, `${STATUS_EVENT[status]}${status === 'submitted' ? ` para ${dto.platform}` : ''}`, author, undefined, dto.ticketId ? `ID do ticket: ${dto.ticketId}` : undefined));
    }
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
        status,
        priority: dto.priority ?? 'medium',
        notes: dto.notes?.trim() || null,
        result: dto.result?.trim() || null,
        data: data as unknown as Prisma.InputJsonValue,
        submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : new Date(),
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
      },
    });
  }

  async update(id: string, dto: Partial<ComplaintInput>, author?: string) {
    const cur = await this.ensure(id);
    const data = this.normData(cur.data);
    // evento automático na mudança de status
    if (dto.status && dto.status !== cur.status) {
      data.events.push(this.ev(`status:${dto.status}`, `${STATUS_EVENT[dto.status]}${dto.status === 'submitted' ? ` para ${dto.platform ?? cur.platform}` : ''}`, author, dto.result ? `Resultado: ${dto.result}` : undefined, (dto.ticketId ?? cur.ticketId) ? `ID do ticket: ${dto.ticketId ?? cur.ticketId}` : undefined));
    }
    const resolvedPatch =
      dto.status && ['resolved', 'closed'].includes(dto.status) && dto.resolvedAt === undefined && !cur.resolvedAt
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
        ...(dto.result !== undefined ? { result: dto.result?.trim() || null } : {}),
        ...(dto.submittedAt !== undefined ? { submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : null } : {}),
        data: data as unknown as Prisma.InputJsonValue,
        ...resolvedPatch,
      },
    });
  }

  async addNote(id: string, text: string, author?: string) {
    const cur = await this.ensure(id);
    const data = this.normData(cur.data);
    data.notes.push({ id: randomUUID(), at: new Date().toISOString(), author, text: text.trim() });
    return this.prisma.complaint.update({ where: { id }, data: { data: data as unknown as Prisma.InputJsonValue } });
  }
  async addAttachment(id: string, name: string, url: string | undefined, author?: string) {
    const cur = await this.ensure(id);
    const data = this.normData(cur.data);
    data.attachments.push({ id: randomUUID(), at: new Date().toISOString(), author, name: name.trim(), url: url?.trim() || undefined });
    return this.prisma.complaint.update({ where: { id }, data: { data: data as unknown as Prisma.InputJsonValue } });
  }
  async addEvent(id: string, title: string, description: string | undefined, author?: string) {
    const cur = await this.ensure(id);
    const data = this.normData(cur.data);
    data.events.push(this.ev('manual', title.trim(), author, description?.trim()));
    return this.prisma.complaint.update({ where: { id }, data: { data: data as unknown as Prisma.InputJsonValue } });
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
