import { Injectable, NotFoundException } from '@nestjs/common';
import { NotePriority, NoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NoteInput {
  operationId: string;
  engagementId?: string | null;
  title?: string;
  body?: string;
  priority?: NotePriority;
  status?: NoteStatus;
  dueAt?: string | null;
}

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista anotações: do engajamento (se informado) ou da operação (engagementId null). */
  list(operationId: string, engagementId?: string) {
    const where: Prisma.NoteWhereInput = engagementId
      ? { engagementId }
      : { operationId, engagementId: null };
    return this.prisma.note.findMany({
      where,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: NoteInput, authorId?: string) {
    return this.prisma.note.create({
      data: {
        operationId: dto.operationId,
        engagementId: dto.engagementId || null,
        title: dto.title?.trim() || '',
        body: dto.body?.trim() || '',
        priority: dto.priority ?? 'medium',
        status: dto.status ?? 'open',
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        authorId: authorId ?? null,
      },
    });
  }

  async update(id: string, dto: Partial<NoteInput>) {
    await this.ensure(id);
    return this.prisma.note.update({
      where: { id },
      data: {
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.body != null ? { body: dto.body.trim() } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.note.delete({ where: { id } });
  }

  private async ensure(id: string) {
    const n = await this.prisma.note.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Anotação não encontrada');
    return n;
  }
}
