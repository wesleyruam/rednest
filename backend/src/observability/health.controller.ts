import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MONITOR_QUEUE } from '../monitoring/monitoring.service';
import { MetricsService } from './metrics.service';

const startedAt = Date.now();

@ApiTags('observability')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    @InjectQueue(MONITOR_QUEUE) private readonly queue: Queue,
  ) {}

  /** Health check público (para load balancers / monitores externos). */
  @Public()
  @Get('health')
  async health() {
    const checks: Record<string, string> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }
    try {
      const client: any = await this.queue.client;
      await client.ping();
      checks.redis = 'up';
    } catch {
      checks.redis = 'down';
    }
    const status = Object.values(checks).every((v) => v === 'up') ? 'ok' : 'degraded';
    return { status, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), checks };
  }

  /** Métricas Prometheus (texto). */
  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  prometheus() {
    return this.metrics.render();
  }

  /** Estatísticas da fila de monitores (autenticado). */
  @ApiBearerAuth()
  @Get('admin/queue-stats')
  async queueStats() {
    let counts: Record<string, number> = {};
    let connected = true;
    try {
      counts = (await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')) as any;
    } catch {
      connected = false;
    }
    return { queue: MONITOR_QUEUE, connected, counts };
  }
}
