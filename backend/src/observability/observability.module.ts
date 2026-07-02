import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MONITOR_QUEUE } from '../monitoring/monitoring.service';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [BullModule.registerQueue({ name: MONITOR_QUEUE })],
  controllers: [HealthController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule {}
