import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PersonInput {
  operationId: string;
  engagementId?: string | null;
  name?: string;
  photo?: string | null;
  data?: any;
}

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  list(operationId: string, engagementId?: string) {
    const where: Prisma.PersonWhereInput = engagementId ? { engagementId } : { operationId };
    return this.prisma.person.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }

  async get(id: string) {
    const p = await this.prisma.person.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Pessoa não encontrada');
    return p;
  }

  create(dto: PersonInput) {
    return this.prisma.person.create({
      data: {
        operationId: dto.operationId,
        engagementId: dto.engagementId || null,
        name: dto.name?.trim() || 'Sem nome',
        photo: dto.photo ?? null,
        data: (dto.data ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: Partial<PersonInput>) {
    await this.get(id);
    return this.prisma.person.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() || 'Sem nome' } : {}),
        ...(dto.photo !== undefined ? { photo: dto.photo } : {}),
        ...(dto.data !== undefined ? { data: (dto.data ?? {}) as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.person.delete({ where: { id } });
  }
}
