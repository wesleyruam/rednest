import { Injectable, NotFoundException } from '@nestjs/common';
import { Alert, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAlertDto } from './dto/query-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QueryAlertDto): Promise<Alert[]> {
    const where: Prisma.AlertWhereInput = {};
    if (query.operationId) where.operationId = query.operationId;
    if (query.severity) where.severity = query.severity;
    if (query.acknowledged !== undefined) where.acknowledged = query.acknowledged;
    return this.prisma.alert.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async markRead(id: string): Promise<Alert> {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alerta não encontrado');
    if (alert.acknowledged) return alert;

    const [updated] = await this.prisma.$transaction([
      this.prisma.alert.update({
        where: { id },
        data: { acknowledged: true },
      }),
      this.prisma.operation.update({
        where: { id: alert.operationId },
        data: { alertCount: { decrement: 1 } },
      }),
    ]);
    return updated;
  }

  async markAllRead(operationId?: string): Promise<{ updated: number }> {
    const where: Prisma.AlertWhereInput = { acknowledged: false };
    if (operationId) where.operationId = operationId;

    const pending = await this.prisma.alert.findMany({ where });
    if (pending.length === 0) return { updated: 0 };

    const perOperation = new Map<string, number>();
    for (const a of pending) {
      perOperation.set(a.operationId, (perOperation.get(a.operationId) ?? 0) + 1);
    }

    await this.prisma.$transaction([
      this.prisma.alert.updateMany({ where, data: { acknowledged: true } }),
      ...[...perOperation.entries()].map(([opId, count]) =>
        this.prisma.operation.update({
          where: { id: opId },
          data: { alertCount: { decrement: count } },
        }),
      ),
    ]);
    return { updated: pending.length };
  }
}
