import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProxyModule } from '../proxy/proxy.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringProcessor } from './monitoring.processor';
import { MonitoringService, MONITOR_QUEUE } from './monitoring.service';

@Module({
  imports: [IntegrationsModule, NotificationsModule, ProxyModule, BullModule.registerQueue({ name: MONITOR_QUEUE })],
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringProcessor],
  exports: [MonitoringService],
})
export class MonitoringModule {}
