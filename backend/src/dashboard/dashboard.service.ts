import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlatformStats {
  operations: number;
  activeOperations: number;
  engagements: number;
  targetsMonitored: number;
  activeAlerts: number;
  reports: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<PlatformStats> {
    const [operations, activeOperations, engagements, activeAlerts, reportAgg] =
      await Promise.all([
        this.prisma.operation.count({ where: { deletedAt: null } }),
        this.prisma.operation.count({
          where: { deletedAt: null, status: 'active' },
        }),
        this.prisma.engagement.count({ where: { deletedAt: null } }),
        this.prisma.alert.count({ where: { acknowledged: false } }),
        this.prisma.operation.aggregate({
          where: { deletedAt: null },
          _sum: { reportCount: true },
        }),
      ]);

    return {
      operations,
      activeOperations,
      engagements,
      targetsMonitored: engagements,
      activeAlerts,
      reports: reportAgg._sum.reportCount ?? 0,
    };
  }
}
