import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records an audit log entry. Never throws — auditing must not break the request. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          oldValue: (entry.oldValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          newValue: (entry.newValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          ip: entry.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao registrar auditoria: ${String(err)}`);
    }
  }
}
