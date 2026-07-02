import { Injectable, NotFoundException } from '@nestjs/common';
import { Operation, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { QueryOperationDto } from './dto/query-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QueryOperationDto): Promise<Operation[]> {
    const where: Prisma.OperationWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }
    return this.prisma.operation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Operation> {
    const op = await this.prisma.operation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!op) throw new NotFoundException('Operação não encontrada');
    return op;
  }

  create(dto: CreateOperationDto): Promise<Operation> {
    return this.prisma.operation.create({
      data: {
        name: dto.name,
        description: dto.description ?? '',
        status: dto.status,
        priority: dto.priority,
        tags: dto.tags ?? [],
        progress: dto.progress ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateOperationDto): Promise<Operation> {
    await this.findOne(id);
    return this.prisma.operation.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        tags: dto.tags,
        progress: dto.progress,
      },
    });
  }

  async remove(id: string, deletedBy: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.operation.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy },
    });
  }
}
