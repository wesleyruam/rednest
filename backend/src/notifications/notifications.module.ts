import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsController } from './notifications.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [NotificationsController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class NotificationsModule {}
